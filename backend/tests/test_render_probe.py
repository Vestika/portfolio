"""
Tests for render_probe endpoint — Markdown image render beacon.

Verifies each probe case returns the correct image payload and that
the logging captures request metadata (IP, UA, query/path data).
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.endpoints.render_probe import router, _TRANSPARENT_GIF, _TRANSPARENT_PNG


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


class TestImageCases:
    """Each case returns a valid image with the right content-type."""

    def test_gif(self, client):
        resp = client.get("/probe/gif/test.gif")
        assert resp.status_code == 200
        assert "image/gif" in resp.headers["content-type"]
        assert resp.content == _TRANSPARENT_GIF

    def test_png(self, client):
        resp = client.get("/probe/png/test.png")
        assert resp.status_code == 200
        assert "image/png" in resp.headers["content-type"]
        assert resp.content == _TRANSPARENT_PNG

    def test_svg(self, client):
        resp = client.get("/probe/svg/test.svg")
        assert resp.status_code == 200
        assert "image/svg+xml" in resp.headers["content-type"]
        assert b"<svg" in resp.content

    def test_no_extension(self, client):
        resp = client.get("/probe/ne/test-noext")
        assert resp.status_code == 200
        assert "image/gif" in resp.headers["content-type"]

    def test_404_status(self, client):
        resp = client.get("/probe/404/test.gif")
        assert resp.status_code == 404
        # Still returns a GIF body
        assert resp.content == _TRANSPARENT_GIF

    def test_catchall(self, client):
        resp = client.get("/probe/anything-unmatched")
        assert resp.status_code == 200
        assert "image/gif" in resp.headers["content-type"]


class TestRedirectCase:
    def test_redirect_returns_302(self, client):
        resp = client.get("/probe/r/test-marker", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "/probe/gif/test-marker-redirected"


class TestRTRedirectCase:
    def test_default_redirect_to_metadata(self, client):
        """Default target is AWS EC2 metadata endpoint."""
        resp = client.get("/probe/rt/test.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://169.254.169.254/latest/meta-data/"

    def test_custom_target_via_query_param(self, client):
        """?to= overrides the redirect destination."""
        resp = client.get(
            "/probe/rt/test.gif?to=http://10.0.0.1:8080/",
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://10.0.0.1:8080/"

    def test_rt_hit_logged_with_target(self, client):
        """The rt redirect logs the initial hit with the redirect target."""
        client.get("/probe/rt/rt-marker.gif?to=http://internal.local:9000/")
        logs = client.get("/probe/logs").json()
        entry = [e for e in logs["entries"] if e["marker"] == "rt-marker.gif"][0]
        assert entry["case"] == "rt"
        assert entry["redirect_to"] == "http://internal.local:9000/"


class TestDataExfiltrationCapture:
    def test_query_data_logged(self, client):
        client.get("/probe/q/exfil.gif?secret=my-data&other=123")
        logs = client.get("/probe/logs").json()
        entry = [e for e in logs["entries"] if e["marker"] == "exfil.gif"]
        assert len(entry) == 1
        assert entry[0]["captured_query_data"]["secret"] == "my-data"
        assert entry[0]["captured_query_data"]["other"] == "123"

    def test_path_data_logged(self, client):
        client.get("/probe/p/c29tZS1iYXNlNjQtZGF0YQ")
        logs = client.get("/probe/logs").json()
        entry = [e for e in logs["entries"] if e["case"] == "p"]
        assert len(entry) >= 1
        assert entry[0]["captured_path_data"] == "c29tZS1iYXNlNjQtZGF0YQ"


class TestLogging:
    def test_logs_endpoint(self, client):
        client.get("/probe/gif/logged.gif", headers={
            "User-Agent": "test-ua/1.0",
            "Referer": "https://example.com",
        })
        logs = client.get("/probe/logs").json()
        assert logs["count"] >= 1
        entry = logs["entries"][0]
        assert entry["case"] == "gif"
        assert entry["marker"] == "logged.gif"
        assert entry["user_agent"] == "test-ua/1.0"
        assert entry["referer"] == "https://example.com"

    def test_summary_endpoint(self, client):
        client.get("/probe/gif/summary.gif")
        client.get("/probe/png/summary.png")
        summary = client.get("/probe/summary").json()
        assert summary["total_hits"] >= 2
        assert "gif" in summary["by_case"]
        assert "png" in summary["by_case"]

    def test_html_logs(self, client):
        client.get("/probe/gif/html-view.gif")
        resp = client.get("/probe/logs?format=html")
        assert resp.status_code == 200
        assert "Render Probe Logs" in resp.text
        assert "html-view.gif" in resp.text

    def test_logs_filter_by_marker(self, client):
        client.get("/probe/gif/filter-target.gif")
        client.get("/probe/gif/other.gif")
        logs = client.get("/probe/logs?marker=filter-target").json()
        markers = [e["marker"] for e in logs["entries"]]
        assert all("filter-target" in m for m in markers)

    def test_sensitive_headers_redacted(self, client):
        client.get("/probe/gif/redact.gif", headers={
            "Authorization": "Bearer super-secret-token",
        })
        logs = client.get("/probe/logs").json()
        entry = [e for e in logs["entries"] if e["marker"] == "redact.gif"][0]
        assert entry["headers"]["authorization"] == "[redacted]"


class TestSlowCase:
    def test_slow_response(self, client):
        import time
        start = time.time()
        resp = client.get("/probe/slow/200/test-slow.gif")
        elapsed = time.time() - start
        assert resp.status_code == 200
        assert elapsed >= 0.18  # at least ~200ms

    def test_slow_caps_at_30s(self, client):
        resp = client.get("/probe/slow/999999/test-slow.gif")
        assert resp.status_code == 200
