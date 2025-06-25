from enum import StrEnum


class SecurityType(StrEnum):
    CASH = "cash"
    STOCK = "stock"
    ETF = "etf"
    BOND = "bond"
    REAL_ESTATE = "real-estate"
    CRYPTO = "crypto"
