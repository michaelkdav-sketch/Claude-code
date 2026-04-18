"""Tax analysis: gains/losses, tax-loss harvesting, asset location, RSU/ESPP, realized gains."""
import datetime
from typing import Optional

_SHORT_TERM_RATE = 0.22
_LONG_TERM_RATE = 0.15

_TAX_ADVANTAGED_SUBTYPES = {"ira", "401k", "403b", "roth", "pension", "retirement"}
_TAX_INEFFICIENT_QUOTE_TYPES = {"etf", "mutualfund"}
_TAX_INEFFICIENT_SECTORS = {"Real Estate"}
_BOND_TICKERS = frozenset({"BND", "AGG", "TLT", "IEF", "SHY", "BNDX"})

TXN_BUY = "buy"
TXN_SELL = "sell"
TXN_REINVEST = "reinvestment"


def _holding_age_days(security_id: str, inv_transactions: list[dict]) -> Optional[int]:
    """Find the earliest buy date for a security from investment transactions."""
    buy_dates = []
    for t in inv_transactions:
        if (t.get("security_id") == security_id and
                t.get("type", "").lower() in (TXN_BUY, TXN_REINVEST)):
            d = t.get("date")
            if d:
                buy_dates.append(datetime.date.fromisoformat(str(d)[:10]))
    if not buy_dates:
        return None
    return (datetime.date.today() - min(buy_dates)).days


def gains_and_losses(enriched_holdings: list[dict], inv_transactions: list[dict]) -> list[dict]:
    results = []
    for h in enriched_holdings:
        qty = h.get("quantity") or 0
        cost_basis_per_share = h.get("cost_basis")
        institution_value = h.get("institution_value") or 0

        if not qty or cost_basis_per_share is None:
            continue

        total_cost = cost_basis_per_share * qty
        unrealized_gain = institution_value - total_cost
        age_days = _holding_age_days(h.get("security_id", ""), inv_transactions)
        is_long_term = age_days is not None and age_days >= 365
        tax_rate = _LONG_TERM_RATE if is_long_term else _SHORT_TERM_RATE
        estimated_tax = max(0.0, unrealized_gain * tax_rate)

        cost_basis_warning = (
            cost_basis_per_share < 0.01 or
            (institution_value > 0 and total_cost < institution_value * 0.1)
        )

        results.append({
            "security_id": h.get("security_id"),
            "ticker": h.get("ticker", ""),
            "security_name": h.get("security_name", ""),
            "quantity": qty,
            "cost_basis_per_share": cost_basis_per_share,
            "total_cost": round(total_cost, 2),
            "institution_value": round(institution_value, 2),
            "unrealized_gain": round(unrealized_gain, 2),
            "is_long_term": is_long_term,
            "age_days": age_days,
            "estimated_tax": round(estimated_tax, 2),
            "cost_basis_warning": cost_basis_warning,
        })
    return results


def tax_loss_harvesting(gains_list: list[dict], inv_transactions: list[dict]) -> list[dict]:
    """Return holdings with unrealized losses, flagging wash-sale risk."""
    cutoff = datetime.date.today() - datetime.timedelta(days=30)
    recently_bought = set()
    for t in inv_transactions:
        if t.get("type", "").lower() in (TXN_BUY, TXN_REINVEST):
            d = t.get("date")
            if d and datetime.date.fromisoformat(str(d)[:10]) >= cutoff:
                recently_bought.add(t.get("security_id"))

    candidates = [g for g in gains_list if g["unrealized_gain"] < 0]
    candidates.sort(key=lambda x: x["unrealized_gain"])

    for c in candidates:
        c["wash_sale_risk"] = c["security_id"] in recently_bought
    return candidates


def realized_gains_this_year(inv_transactions: list[dict]) -> dict:
    """Sum realized gains from sell transactions in the current calendar year."""
    year = datetime.date.today().year
    short_term = 0.0
    long_term = 0.0

    for t in inv_transactions:
        if t.get("type", "").lower() != TXN_SELL:
            continue
        d = t.get("date")
        if not d or datetime.date.fromisoformat(str(d)[:10]).year != year:
            continue
        amount = t.get("amount") or 0
        # Plaid: negative amount = proceeds received (sell); cost basis not always in transaction
        # Use price * quantity - cost as a best-effort calculation
        price = t.get("price") or 0
        qty = abs(t.get("quantity") or 0)
        cost = (t.get("cost_basis") or 0) * qty if t.get("cost_basis") else 0
        gain = (price * qty) - cost if cost else 0

        # Determine short vs long term via fees/holding data — default to short if unknown
        is_long = t.get("is_long_term", False)
        if is_long:
            long_term += gain
        else:
            short_term += gain

    return {
        "short_term_gains": round(short_term, 2),
        "long_term_gains": round(long_term, 2),
        "total_gains": round(short_term + long_term, 2),
        "estimated_tax_short": round(max(0, short_term) * _SHORT_TERM_RATE, 2),
        "estimated_tax_long": round(max(0, long_term) * _LONG_TERM_RATE, 2),
    }


def asset_location_analysis(enriched_holdings: list[dict], accounts: list[dict]) -> list[dict]:
    """Flag tax-inefficient assets sitting in taxable brokerage accounts."""
    account_map = {a["account_id"]: a for a in accounts}
    flags = []

    for h in enriched_holdings:
        acct = account_map.get(h.get("account_id"), {})
        subtype = (acct.get("subtype") or "").lower()
        is_taxable = subtype not in _TAX_ADVANTAGED_SUBTYPES and subtype in (
            "brokerage", "investment", ""
        )
        if not is_taxable:
            continue

        quote_type = (h.get("quote_type") or "").lower()
        sector = h.get("sector") or ""
        ticker = h.get("ticker", "")

        inefficient = (
            quote_type in _TAX_INEFFICIENT_QUOTE_TYPES or
            sector in _TAX_INEFFICIENT_SECTORS or
            ticker in _BOND_TICKERS
        )

        if inefficient:
            flags.append({
                "ticker": ticker,
                "security_name": h.get("security_name", ""),
                "account_name": acct.get("name", ""),
                "account_subtype": subtype,
                "institution_value": h.get("institution_value", 0),
                "reason": _inefficiency_reason(quote_type, sector, ticker),
            })

    return flags


def _inefficiency_reason(quote_type: str, sector: str, ticker: str) -> str:
    if sector == "Real Estate":
        return "REITs distribute taxable dividends — better held in tax-advantaged account"
    if quote_type == "mutualfund":
        return "Actively managed mutual funds generate taxable capital gain distributions"
    if ticker in _BOND_TICKERS:
        return "Bond funds produce ordinary income taxed at higher rates — better in IRA/401k"
    return "Tax-inefficient asset class — consider moving to tax-advantaged account"


def espp_disposition_status(inv_transactions: list[dict], employer_tickers: list[str]) -> list[dict]:
    """Flag ESPP purchases and whether qualifying disposition threshold is met."""
    results = []
    today = datetime.date.today()

    for t in inv_transactions:
        if t.get("type", "").lower() != TXN_BUY:
            continue
        ticker = (t.get("ticker_symbol") or "").upper()
        if ticker not in [e.upper() for e in employer_tickers]:
            continue
        if "espp" not in (t.get("name") or "").lower() and "espp" not in (t.get("subtype") or "").lower():
            continue

        purchase_date = datetime.date.fromisoformat(str(t["date"])[:10])
        days_held = (today - purchase_date).days
        qualifying = days_held >= 365  # simplified: 1yr from purchase (full rule: 2yr from offer + 1yr from purchase)

        results.append({
            "ticker": ticker,
            "purchase_date": str(purchase_date),
            "days_held": days_held,
            "qualifying_disposition": qualifying,
            "days_until_qualifying": max(0, 365 - days_held),
            "note": (
                "Qualifying disposition: gains taxed at preferential capital gains rates"
                if qualifying
                else f"{365 - days_held} days until qualifying disposition threshold"
            ),
        })
    return results
