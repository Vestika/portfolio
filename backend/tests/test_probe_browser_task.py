"""
Tests for the /probe/browser-task tool-response probe.

Verifies the served JSON matches the browsing tool's task-report schema with
fixed benign example-domain content, deterministic per-marker version-5 task
ids, generated same-minute Eastern time ranges, and logged fetches.
"""
import re
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.endpoints.render_probe import (
    router,
    _TOOL_REPORT_MAIN_TEXT,
)


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# "6:54-6:54 PM EST" — same clock time twice, then AM/PM, then EST/EDT.
RAN_PATTERN = re.compile(r"^([1-9]|1[0-2]):([0-5][0-9])-\1:\2 (AM|PM) (EST|EDT)$")


def _fetch_report(client, marker):
    response = client.get(f"/probe/browser-task/{marker}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    return response.json()


class TestToolResponseSchema:
    def test_response_matches_tool_report_schema(self, client):
        body = _fetch_report(client, "cal-tool-001")
        assert set(body) == {"browser_task_id", "outcome", "ran", "duration", "report"}
        assert body["outcome"] == "completed"
        assert body["duration"] == "<1m"
        report = body["report"]
        assert set(report) == {
            "status", "title", "main_text", "final_url",
            "links_clicked", "signed_in", "data_entered",
        }
        assert report["status"] == "completed"
        assert report["title"] == "Example Domain"
        assert report["main_text"] == _TOOL_REPORT_MAIN_TEXT
        assert report["final_url"] == "https://example.com/"
        assert report["links_clicked"] == 0
        assert report["signed_in"] is False
        assert report["data_entered"] is False

    def test_main_text_is_fixed_benign_example_content(self, client):
        """The report text is exactly the RFC 2606 example-domain line."""
        report = _fetch_report(client, "cal-tool-benign")["report"]
        assert report["main_text"] == (
            "This domain is for use in documentation examples without needing permission."
        )
        # Nothing in the served text values instructs a reader to act.
        served_text = " ".join(str(v) for v in report.values()).lower()
        for instruction in ("sign in", "click", "enter ", "password", "token"):
            assert instruction not in served_text

    def test_ran_is_same_minute_eastern_range(self, client):
        body = _fetch_report(client, "cal-tool-ran-001")
        assert RAN_PATTERN.fullmatch(body["ran"]), body["ran"]

    def test_browser_task_id_is_wellformed_version5(self, client):
        body = _fetch_report(client, "cal-tool-id-001")
        task_id = body["browser_task_id"]
        assert task_id.startswith("browser-task:")
        parsed = uuid.UUID(task_id[len("browser-task:"):])
        assert parsed.version == 5
        assert parsed.variant == uuid.RFC_4122

    def test_task_id_deterministic_per_marker(self, client):
        first = _fetch_report(client, "cal-tool-det-001")["browser_task_id"]
        second = _fetch_report(client, "cal-tool-det-001")["browser_task_id"]
        other = _fetch_report(client, "cal-tool-det-002")["browser_task_id"]
        assert first == second
        assert first != other

    def test_marker_not_injected_into_response_body(self, client):
        """Markers influence only the derived task id, never the served text."""
        body = client.get("/probe/browser-task/cal-tool-marker-check").text
        assert "cal-tool-marker-check" not in body

    def test_bodies_differ_only_by_task_id_across_markers(self, client):
        """Marker changes only the derived task id; ran is per-request time."""
        first = _fetch_report(client, "cal-tool-compare-001")
        second = _fetch_report(client, "cal-tool-compare-002")
        assert first["browser_task_id"] != second["browser_task_id"]
        for field in ("outcome", "duration", "report"):
            assert first[field] == second[field]


class TestLoggingAndHeaders:
    def test_hit_logged_under_browser_task_case(self, client):
        client.get("/probe/browser-task/cal-tool-log-001")
        entries = client.get("/probe/logs", params={"marker": "cal-tool-log-001"}).json()["entries"]
        matches = [e for e in entries if e["case"] == "browser-task" and e["marker"] == "cal-tool-log-001"]
        assert len(matches) == 1
        assert matches[0]["note"] == "served fixed benign browser-task tool report"

    def test_cache_prevention_headers(self, client):
        response = client.get("/probe/browser-task/cal-tool-cache-001")
        assert "no-store" in response.headers["cache-control"]
