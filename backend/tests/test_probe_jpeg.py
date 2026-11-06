"""HTTP contract for the external-PDF-image receiver fixture."""
import struct

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.endpoints.render_probe import router


def test_jpeg_fixture_is_baseline_rgb_and_logs_marker():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    marker = "jpeg-baseline-regression.jpg"
    response = client.get(f"/probe/jpeg/{marker}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "no-store" in response.headers["cache-control"]
    data = response.content
    assert data[:2] == b"\xff\xd8" and data[-2:] == b"\xff\xd9"
    position = 2
    frames = []
    while position < len(data):
        assert data[position] == 0xff
        kind = data[position + 1]
        length = int.from_bytes(data[position + 2:position + 4], "big")
        assert length >= 2 and position + 2 + length <= len(data)
        payload = data[position + 4:position + 2 + length]
        if kind == 0xc0:
            frames.append(struct.unpack(">BHHB", payload[:6]))
        assert kind != 0xc2, "Progressive JPEG is not the PDF control format"
        if kind == 0xda:
            assert frames == [(8, 64, 96, 3)]
            assert position + 2 + length < len(data) - 2
            break
        position += 2 + length
    else:
        raise AssertionError("No image scan")
    assert marker.encode() not in data
    other = client.get("/probe/jpeg/another-marker.jpg")
    assert other.content == data
    entries = client.get("/probe/logs", params={"marker": marker, "case": "jpeg"}).json()["entries"]
    assert len(entries) == 1
    assert entries[0]["marker"] == marker
    assert entries[0]["method"] == "GET"
    assert entries[0]["path"] == f"/probe/jpeg/{marker}"
