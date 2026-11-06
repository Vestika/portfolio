"""
Tests for the /probe/follow calendar-invite follow probe.

Verifies the operator-configured redirect target is honored with fail-closed
validation, that every first-hop hit is logged even when no redirect is
issued, and that request parameters can never choose the destination.
"""
import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.endpoints.render_probe import router, _TRANSPARENT_GIF


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def _target_config(url="https://docs.example.com/pre-read", minutes=10):
    return {
        "url": url,
        "expires_at": int((datetime.now(timezone.utc) + timedelta(minutes=minutes)).timestamp()),
    }


def _set_target(monkeypatch, config):
    monkeypatch.setenv("PROBE_FOLLOW_TARGET", json.dumps(config))


def _log_entry(client, marker):
    entries = client.get("/probe/logs", params={"marker": marker}).json()["entries"]
    matches = [e for e in entries if e["case"] == "follow" and e["marker"] == marker]
    assert len(matches) == 1
    return matches[0]


class TestConfiguredFollow:
    def test_redirects_to_configured_target(self, client, monkeypatch):
        _set_target(monkeypatch, _target_config())
        response = client.get("/probe/follow/cal-invite-001", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "https://docs.example.com/pre-read"
        assert "no-store" in response.headers["cache-control"]

    def test_hit_logged_with_target_and_no_arrival_claim(self, client, monkeypatch):
        _set_target(monkeypatch, _target_config())
        marker = "cal-log-001"
        client.get(f"/probe/follow/{marker}")
        entry = _log_entry(client, marker)
        assert entry["event"] == "redirect_issued"
        assert entry["redirect_to"] == "https://docs.example.com/pre-read"
        assert "arrival not observed" in entry["note"]
        assert "proxy followed" not in entry["note"]

    def test_query_params_cannot_choose_target(self, client, monkeypatch):
        """Request parameters must never override the server-side destination."""
        _set_target(monkeypatch, _target_config())
        response = client.get(
            "/probe/follow/cal-override-001",
            params={
                "url": "https://evil.example/attacker",
                "target": "https://evil.example/attacker",
                "expires_at": 9999999999,
            },
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == "https://docs.example.com/pre-read"

    def test_self_control_chain_logs_both_hits(self, client, monkeypatch):
        """Redirect to this app's own GIF route: follow hit + arrival GIF hit."""
        _set_target(monkeypatch, _target_config(
            url="http://testserver/probe/gif/follow-self-control.gif"
        ))
        client.get("/probe/follow/cal-self-001", follow_redirects=True)
        follow_entry = _log_entry(client, "cal-self-001")
        gif_entries = client.get("/probe/logs", params={"marker": "follow-self-control"}).json()["entries"]
        assert follow_entry["event"] == "redirect_issued"
        assert any(e["case"] == "gif" for e in gif_entries)

    def test_valid_target_without_path_redirects(self, client, monkeypatch):
        _set_target(monkeypatch, _target_config(url="https://example.com"))
        response = client.get("/probe/follow/cal-hostonly-001", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "https://example.com"


class TestUnconfiguredAndExpired:
    def test_unconfigured_serves_logged_gif_beacon(self, client, monkeypatch):
        monkeypatch.delenv("PROBE_FOLLOW_TARGET", raising=False)
        response = client.get("/probe/follow/cal-unset-001")
        assert response.status_code == 200
        assert response.content == _TRANSPARENT_GIF
        assert "image/gif" in response.headers["content-type"]
        entry = _log_entry(client, "cal-unset-001")
        assert entry["note"] == "follow target not configured; served GIF beacon"
        assert "event" not in entry
        assert "redirect_to" not in entry

    def test_expired_returns_410_and_logs_hit(self, client, monkeypatch):
        _set_target(monkeypatch, _target_config(minutes=-1))
        response = client.get("/probe/follow/cal-expired-001", follow_redirects=False)
        assert response.status_code == 410
        assert "location" not in response.headers
        entry = _log_entry(client, "cal-expired-001")
        assert entry["note"] == "follow target expired; no redirect issued"

    @pytest.mark.parametrize("raw", ["{", "[]", "null", "{}", "not-json"])
    def test_malformed_configuration_fails_closed(self, client, monkeypatch, raw, request):
        marker = f"cal-malformed-{request.node.callspec.id}"
        monkeypatch.setenv("PROBE_FOLLOW_TARGET", raw)
        response = client.get(f"/probe/follow/{marker}", follow_redirects=False)
        assert response.status_code == 503
        assert "location" not in response.headers
        assert _log_entry(client, marker)["case"] == "follow"

    @pytest.mark.parametrize("change", [
        {"url": "javascript:alert(1)"},
        {"url": "https://"},
        {"url": "ftp://example.com/doc"},
        {"url": "http://exa mple.com/doc"},
        {"url": "https://example.com/doc extra"},
        {"url": "https://example.com/\u0000bad"},
        {"url": "https://" + "a" * 3000},
        {"url": 123},
        {"expires_at": "tomorrow"},
        {"expires_at": True},
        {"expires_at": -1},
        {"extra": 1},
    ], ids=[
        "javascript-url", "empty-host", "ftp-scheme", "space-in-url",
        "trailing-space", "control-char", "too-long", "non-string-url",
        "string-expiry", "bool-expiry", "negative-expiry", "extra-field",
    ])
    def test_invalid_configuration_fails_closed(self, client, monkeypatch, change, request):
        marker = f"cal-invalid-{request.node.callspec.id}"
        config = _target_config()
        config.update(change)
        _set_target(monkeypatch, config)
        response = client.get(f"/probe/follow/{marker}", follow_redirects=False)
        assert response.status_code == 503
        assert "location" not in response.headers
        assert _log_entry(client, marker)["case"] == "follow"

    def test_never_redirects_after_expiry_window(self, client, monkeypatch):
        """A once-valid configuration stops redirecting once expired."""
        _set_target(monkeypatch, _target_config())
        assert client.get("/probe/follow/cal-window-001", follow_redirects=False).status_code == 302
        _set_target(monkeypatch, _target_config(minutes=-1))
        response = client.get("/probe/follow/cal-window-001", follow_redirects=False)
        assert response.status_code == 410
        assert "location" not in response.headers
