from typing import Callable, Iterable

from backend.models.account import Account
from backend.utils.filters import Filter

type AccountFilter = Callable[[Account], bool]


def by_name(name: str) -> Filter[Account]:
    return lambda a: a.name == name


def by_names(names: Iterable[str] | None) -> Filter[Account]:
    return lambda a: a.name in names if names is not None else True


def by_property(property_name: str, expected_value: str) -> Filter[Account]:
    return lambda a: a.properties.get(property_name) == expected_value
