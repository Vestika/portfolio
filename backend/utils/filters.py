from typing import Callable

from models.security import Security

type AggregationKey = str | None
type AggregationKeyFunc = Callable[[Security], AggregationKey]
type Filter[T] = Callable[[T], bool]
