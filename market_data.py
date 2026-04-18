"""yfinance wrappers for historical prices, expense ratios, and sector data."""
import datetime
from functools import lru_cache
from typing import Optional
import yfinance as yf


def portfolio_value_history(ticker_quantities: dict[str, float]) -> dict[str, float]:
    """Return {date_str: total_value} for the last 12 months given {ticker: quantity}."""
    tickers = [t for t in ticker_quantities if t]
    if not tickers:
        return {}
    try:
        data = yf.download(
            tickers,
            period="1y",
            interval="1d",
            auto_adjust=True,
            progress=False,
        )
        closes = data["Close"] if len(tickers) > 1 else data["Close"].to_frame(tickers[0])
        result: dict[str, float] = {}
        for date, row in closes.iterrows():
            total = 0.0
            for ticker, qty in ticker_quantities.items():
                price = row.get(ticker)
                if price is not None and not (price != price):  # NaN check
                    total += float(price) * qty
            if total > 0:
                result[str(date.date())] = round(total, 2)
        return result
    except Exception:
        return {}


@lru_cache(maxsize=256)
def get_security_info(ticker: str) -> dict:
    """Return expense ratio, sector, quote type for a ticker. Cached."""
    try:
        info = yf.Ticker(ticker).info
        return {
            "expense_ratio": info.get("annualReportExpenseRatio") or info.get("expenseRatio"),
            "sector": info.get("sector"),
            "quote_type": info.get("quoteType"),
            "long_name": info.get("longName") or info.get("shortName"),
        }
    except Exception:
        return {"expense_ratio": None, "sector": None, "quote_type": None, "long_name": None}


_ASSET_CLASS_BY_TICKER = {
    "BND": "BONDS", "AGG": "BONDS", "TLT": "BONDS", "IEF": "BONDS", "SHY": "BONDS",
    "BNDX": "BONDS",
    "VXUS": "INTL_EQUITY", "IXUS": "INTL_EQUITY", "EFA": "INTL_EQUITY",
    "VEA": "INTL_EQUITY", "EEM": "INTL_EQUITY", "VWO": "INTL_EQUITY",
}


def get_asset_class(ticker: str, quote_type: str, sector: str) -> str:
    t = (ticker or "").upper()
    if t in _ASSET_CLASS_BY_TICKER:
        return _ASSET_CLASS_BY_TICKER[t]
    qt = (quote_type or "").lower()
    if qt in ("etf", "equity") and sector != "Real Estate":
        return "US_EQUITY"
    return "OTHER"


def enrich_holdings(holdings: list[dict], securities: list[dict]) -> list[dict]:
    """Add expense_ratio, sector, quote_type to each holding via yfinance."""
    sec_map = {s["security_id"]: s for s in securities}
    enriched = []
    for h in holdings:
        sec = sec_map.get(h.get("security_id"), {})
        ticker = sec.get("ticker_symbol") or ""
        info = get_security_info(ticker) if ticker else {}
        enriched.append({**h, **info, "ticker": ticker, "security_name": sec.get("name")})
    return enriched


def monthly_portfolio_value(ticker_quantities: dict[str, float]) -> dict[str, float]:
    """Aggregate daily portfolio values into monthly end-of-month values."""
    daily = portfolio_value_history(ticker_quantities)
    monthly: dict[str, float] = {}
    for date_str, value in daily.items():
        month_key = date_str[:7]  # YYYY-MM
        monthly[month_key] = value  # last day of each month wins
    return dict(sorted(monthly.items()))
