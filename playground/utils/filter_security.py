from typing import Callable

from playground.models.security import Security
from playground.utils.filters import AggregationKey, Filter, AggregationKeyFunc

type SecurityFilter = Callable[[Security], bool]


def by_symbol(s: Security) -> AggregationKey:
    return s.symbol


def by_name(s: Security) -> AggregationKey:
    return s.name


def by_type(s: Security) -> AggregationKey:
    return s.security_type


def by_currency(s: Security) -> AggregationKey:
    return s.currency


def by_tag(tag: str) -> AggregationKeyFunc:
    return lambda s: s.tags.get(tag)


def by_tag_value(tag: str, value: str) -> Filter[Security]:
    return lambda s: s.tags.get(tag) == value
