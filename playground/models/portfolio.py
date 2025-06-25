from pathlib import Path
from typing import Any, Self

import yaml

from playground.models.account import Account
from playground.models.currency import Currency
from playground.models.security import Security


class Portfolio:
    def __init__(self, config: dict[str, Any], securities: dict[str, Security], accounts: list[Account]):
        self.config = config
        self.securities = securities
        self.accounts = accounts
        self.base_currency = Currency(config["base_currency"])
        self.user_name = config.get("user_name", "User")
        self.exchange_rates = {Currency(k): v for k, v in config["exchange_rates"].items()}
        self.unit_prices = config.get("unit_prices", {})

    @classmethod
    def from_yaml(cls, yaml_path: Path) -> Self:
        with open(Path(yaml_path), "rt") as f:
            data = yaml.safe_load(f)

        return cls(
            config=data["config"],
            securities={
                symbol: Security.from_dict(symbol, security_data)
                for symbol, security_data in data["securities"].items()
            },
            accounts=[Account.from_dict(account_data) for account_data in data["accounts"]],
        )
