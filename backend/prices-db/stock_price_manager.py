import datetime

import redis
import yfinance as yf


def _today(minus: datetime.timedelta = datetime.timedelta()) -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC) - minus


class StockPriceManager:
    def __init__(self, redis_host: str = "localhost", redis_port: int = 6379, redis_db: int = 0) -> None:
        self._redis = redis.StrictRedis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)
        self._max_age = datetime.timedelta(days=3 * 365)  # 3 years

    @staticmethod
    def _key(stock: str) -> str:
        return f"stock:{stock}"

    def _cleanup_old_data(self, stock: str) -> None:
        """Remove data older than 3 years."""
        key = self._key(stock)
        cutoff_date = _today(minus=self._max_age)
        self._redis.zremrangebyscore(key, "-inf", cutoff_date.strftime("%Y%m%d"))

    def store_closing_prices(self, stock: str, prices: dict[str, float]) -> None:
        """Store closing prices in Redis.

        Args:
            stock (str): Stock symbol.
            prices (dict): Dictionary of date -> price.
        """
        key = self._key(stock)
        with self._redis.pipeline() as pipe:
            dates_to_prices = {}
            dates_to_scores = {}
            for date_str, price in prices.items():
                dates_to_prices[date_str] = price
                dates_to_scores[date_str] = date_str.replace("-", "")

                pipe.zadd(key, mapping=dates_to_scores)
                pipe.hset(key + ":prices", mapping=dates_to_prices)

            pipe.execute()
        self._cleanup_old_data(stock)

    def get_last_closing_price(self, stock: str) -> tuple[str, float] | None:
        """Retrieve the last closing price of a stock."""
        key = self._key(stock)
        if last_date := self._redis.zrange(key, -1, -1)[0]:
            return last_date, float(self._redis.hget(key + ":prices", last_date))
        return None

    def get_all_data(self, stock: str) -> dict[str, float]:
        """Retrieve all available data for a stock."""
        key = self._key(stock)
        dates = self._redis.zrange(key, 0, -1)
        return {date: float(self._redis.hget(key + ":prices", date)) for date in dates}

    def get_data_for_period(self, stocks: list[str], start_date: str, end_date: str) -> dict[str, dict[str, float]]:
        """Retrieve data for a list of stocks within a specified period."""
        result = {}
        for stock in stocks:
            key = self._key(stock)
            dates = self._redis.zrangebyscore(key, start_date.replace("-", ""), end_date.replace("-", ""))
            result[stock] = {date: float(self._redis.hget(key + ":prices", date)) for date in dates}
        return result

    def fetch_and_update(self, stock: str) -> None:
        """Fetch and update missing data from yfinance."""
        key = self._key(stock)
        last_date = self._redis.zrange(key, -1, -1)
        start_date = last_date[0] if last_date else _today(minus=self._max_age)
        end_date = _today()

        data = yf.download(stock, start=start_date, end=end_date, progress=False)
        if not data.empty:
            prices = data["Close"].dropna().round(2)
            prices.index = prices.index.strftime("%Y-%m-%d")
            self.store_closing_prices(stock, prices.to_dict()[stock])

    def fetch_and_update_all(self, stocks: list[str]) -> None:
        """Fetch and update data for all stocks."""
        for stock in stocks:
            self.fetch_and_update(stock)


# Example usage
if __name__ == "__main__":
    manager = StockPriceManager()
    stocks = ["AAPL", "MSFT"]

    for key in manager._redis.scan_iter("*"):
        manager._redis.delete(key)

    # Fetch and update stock data
    manager.fetch_and_update_all(stocks)

    # Get last closing price
    print(manager.get_last_closing_price("AAPL"))

    # Get all data for a stock
    print(manager.get_all_data("AAPL"))

    # Get data for a period
    print(manager.get_data_for_period(["AAPL", "MSFT"], "2023-01-01", "2023-12-31"))
