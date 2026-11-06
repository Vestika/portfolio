"""HTTP-boundary checks for fixed image bytes and declared MIME types."""
import struct
import zlib
from xml.etree import ElementTree as ET

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.endpoints.render_probe import router


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def decode_png_rows(data):
    """Validate PNG framing/checksums and decompress its scanlines independently."""
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    position = 8
    chunks = []
    compressed = b""
    while position < len(data):
        size = struct.unpack(">I", data[position:position + 4])[0]
        kind = data[position + 4:position + 8]
        payload = data[position + 8:position + 8 + size]
        crc = struct.unpack(">I", data[position + 8 + size:position + 12 + size])[0]
        assert crc == zlib.crc32(kind + payload) & 0xffffffff, kind
        chunks.append(kind)
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            assert (depth, compression, filtering, interlace) == (8, 0, 0, 0)
            assert color in (2, 6)
        if kind == b"IDAT":
            compressed += payload
        position += size + 12
        if kind == b"IEND":
            break
    assert chunks[0] == b"IHDR" and chunks[-1] == b"IEND"
    assert position == len(data)
    rows = zlib.decompress(compressed)
    channels = 3 if color == 2 else 4
    assert len(rows) == height * (1 + width * channels)
    return width, height, rows


def test_existing_png_beacon_is_decodable(client):
    response = client.get("/probe/png/png-validity.svg")
    assert response.status_code == 200
    width, height, rows = decode_png_rows(response.content)
    assert (width, height) == (1, 1)
    assert rows == b"\x00\x00\x00\x00\x00"  # filter byte, transparent RGBA pixel


@pytest.mark.parametrize("payload", ["png", "svg"])
def test_mime_matrix_keeps_bytes_constant_and_logs_headers(client, payload):
    responses = []
    types = {"png": "image/png", "svg": "image/svg+xml", "binary": "application/octet-stream"}
    for declared, content_type in types.items():
        marker = f"mime-{payload}-{declared}.img"
        response = client.get(f"/probe/mime/{payload}/{declared}/{marker}")
        assert response.status_code == 200
        assert response.headers["content-type"] == content_type
        assert response.headers["x-content-type-options"] == "nosniff"
        assert "no-store" in response.headers["cache-control"]
        assert marker.encode() not in response.content
        entry = client.get("/probe/logs", params={"marker": marker}).json()["entries"][0]
        assert entry["case"] == "mime"
        assert entry["payload_kind"] == payload
        assert entry["declared_content_type"] == content_type
        responses.append(response.content)
    assert responses[0] == responses[1] == responses[2]
    if payload == "png":
        width, height, rows = decode_png_rows(responses[0])
        assert (width, height) == (96, 64)
        assert len(set(rows)) > 2  # visible multicolor control, not transparent/empty
    else:
        root = ET.fromstring(responses[0])
        ns = {"s": "http://www.w3.org/2000/svg"}
        assert root.find("s:script", ns) is None
        assert root.find("s:text", ns).text == "NOT_EXECUTED"
        assert responses[0] == client.get("/probe/svg-control/static-comparison.img").content


@pytest.mark.parametrize("payload,declared", [("script", "png"), ("svg", "html"), ("png", "javascript")])
def test_mime_matrix_rejects_unlisted_payloads_and_types(client, payload, declared):
    response = client.get(f"/probe/mime/{payload}/{declared}/invalid.img")
    assert response.status_code == 422
