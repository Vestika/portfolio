import yfinance as yf

tickers = ["AAPL", "IS-FF302.TA"]

data = yf.download(tickers, period="5d", group_by="ticker", rounding=True)
print(data)

closing_prices = {ticker: float(data[ticker]["Close"].iloc[-1]) for ticker in tickers}

print(closing_prices)
