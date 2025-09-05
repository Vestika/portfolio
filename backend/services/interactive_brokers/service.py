import httpx
import asyncio
from typing import Optional, Any
from loguru import logger
from urllib.parse import urljoin

import xml.etree.ElementTree as ET



class IBFlexWebServiceClient:
    """Client for IBKR Flex Web Service (SendRequest/GetStatement)"""

    BASE_URL = "https://gdcdyn.interactivebrokers.com/Universal/servlet/"

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=20.0)

    async def __aenter__(self):
        return self

    async def __aexit__(self, _, __, ___):
        await self.client.aclose()

    async def send_request(self, access_token: str, query_id: str) -> str:
        """
        Generate a report and return the reference code.
        Endpoint: FlexStatementService.SendRequest?t={token}&q={queryId}&v=3
        """
        params = {"t": access_token, "q": query_id, "v": "3"}
        url = urljoin(self.BASE_URL, "FlexStatementService.SendRequest")
        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        # Parse small XML with ReferenceCode
        try:
            root = ET.fromstring(resp.text)
            ref_code_elem = root.find("ReferenceCode")
            if ref_code_elem is None or not ref_code_elem.text:
                raise ValueError("Missing ReferenceCode in SendRequest response")
            return ref_code_elem.text
        except ET.ParseError as e:
            logger.error(f"Failed parsing SendRequest XML: {e}\n{resp.text}")
            raise

    async def get_statement(self, access_token: str, reference_code: str) -> str:
        """
        Retrieve a generated statement as XML.
        Endpoint: FlexStatementService.GetStatement?t={token}&q={referenceCode}&v=3
        Returns XML text for further parsing.
        """
        params = {"t": access_token, "q": reference_code, "v": "3"}
        url = urljoin(self.BASE_URL, "FlexStatementService.GetStatement")
        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        return resp.text

    async def fetch_statement(self, access_token: str, query_id: str, retries: int = 6, delay_seconds: float = 2.0) -> str:
        """Send request and then retrieve the statement with brief retries."""
        ref_code = await self.send_request(access_token, query_id)
        last_exc: Optional[Exception] = None
        for attempt in range(retries):
            try:
                xml_text = await self.get_statement(access_token, ref_code)
                # Some failures return error XML; detect basic error tag
                if "FlexQueryResponse" in xml_text or "<FlexStatement" in xml_text:
                    return xml_text
                # else try next
            except Exception as e:
                last_exc = e
            await asyncio.sleep(delay_seconds)
        if last_exc:
            raise last_exc
        raise RuntimeError("Failed to fetch Flex statement after retries")

    @staticmethod
    def parse_holdings_from_flex(xml_text: str) -> list[dict[str, Any]]:
        """
        Parse Flex XML OpenPositions, aggregate units by symbol.
        Returns list of {symbol, units}.
        """
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            logger.error(f"Failed to parse Flex statement XML: {e}")
            raise

        aggregates: dict[str, float] = {}

        # Find all OpenPosition nodes regardless of nesting
        for pos in root.findall('.//OpenPosition'):
            try:
                symbol = pos.attrib.get('symbol')
                position_str = pos.attrib.get('position', '0')
                if not symbol:
                    continue
                units = float(position_str)
                if units == 0:
                    continue
                aggregates[symbol] = aggregates.get(symbol, 0.0) + units
            except Exception as e:
                logger.warning(f"Skipping position due to parse error: {e}; raw={pos.attrib}")
                continue

        return [{"symbol": s, "units": round(u, 6)} for s, u in aggregates.items()]