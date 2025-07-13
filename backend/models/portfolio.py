from pathlib import Path
from typing import Any, Self

import yaml

from models.account import Account
from models.currency import Currency
from models.security import Security


class Portfolio:
    def __init__(self, portfolio_name: str, config: dict[str, Any], securities: dict[str, Security], accounts: list[Account]):
        self.portfolio_name = portfolio_name
        self.config = config
        self.securities = securities
        self.accounts = accounts
        self.base_currency = Currency(config["base_currency"])
        self.user_name = config.get("user_name", "User")
        self.user_id = config.get("user_id", "user_id")
        self.exchange_rates = {Currency(k): v for k, v in config["exchange_rates"].items()}
        self.unit_prices = config.get("unit_prices", {})

    @classmethod
    def from_yaml(cls, yaml_path: Path) -> Self:
        with open(Path(yaml_path), "rt") as f:
            data = yaml.safe_load(f)

        return cls(
            portfolio_name=data.get("portfolio_name", "Unknown Portfolio"),
            config=data["config"],
            securities={
                symbol: Security.from_dict(symbol, security_data)
                for symbol, security_data in data["securities"].items()
            },
            accounts=[Account.from_dict(account_data) for account_data in data["accounts"]],
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            portfolio_name=data.get("portfolio_name", "Unknown Portfolio"),
            config=data["config"],
            securities={
                symbol: Security.from_dict(symbol, security_data)
                for symbol, security_data in data["securities"].items()
            },
            accounts=[Account.from_dict(account_data) for account_data in data["accounts"]],
        )
