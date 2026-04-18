import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import plaid

import token_store
import plaid_client
import market_data
import tax_engine
import insights as insights_module


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")


@dataclass
class PortfolioData:
    accounts: list[dict] = field(default_factory=list)
    transactions: list[dict] = field(default_factory=list)
    holdings: list[dict] = field(default_factory=list)
    securities: list[dict] = field(default_factory=list)
    investment_transactions: list[dict] = field(default_factory=list)

    @property
    def unique_securities(self) -> list[dict]:
        return list({s["security_id"]: s for s in self.securities}.values())

    @property
    def enriched_holdings(self) -> list[dict]:
        if not hasattr(self, "_enriched"):
            self._enriched = market_data.enrich_holdings(self.holdings, self.unique_securities)
        return self._enriched


def _fetch_one_item(entry: dict, want_investments: bool, want_transactions: bool) -> dict:
    access_token = entry["access_token"]
    institution = entry.get("institution_name", "Unknown")
    result = {"accounts": [], "transactions": [], "investments": None}
    try:
        accounts = plaid_client.fetch_accounts(access_token)
        for a in accounts:
            a["institution_name"] = institution
        result["accounts"] = accounts
    except plaid.ApiException as e:
        print(f"[accounts] {e}")
    if want_transactions:
        try:
            result["transactions"] = plaid_client.fetch_transactions(access_token)
        except plaid.ApiException as e:
            print(f"[transactions] {e}")
    if want_investments:
        try:
            result["investments"] = plaid_client.fetch_investments(access_token)
        except plaid.ApiException as e:
            print(f"[investments] {e}")
    return result


def fetch_portfolio(want_investments: bool = True, want_transactions: bool = True) -> PortfolioData:
    tokens = token_store.get_all_tokens()
    data = PortfolioData()
    if not tokens:
        return data

    with ThreadPoolExecutor(max_workers=max(1, len(tokens))) as pool:
        results = list(pool.map(
            lambda t: _fetch_one_item(t, want_investments, want_transactions),
            tokens,
        ))

    for r in results:
        data.accounts.extend(r["accounts"])
        data.transactions.extend(r["transactions"])
        inv = r["investments"]
        if inv:
            data.holdings.extend(inv["holdings"])
            data.securities.extend(inv["securities"])
            data.investment_transactions.extend(inv["investment_transactions"])
    return data


def aggregate_spending(transactions: list[dict]) -> dict:
    spending = [t for t in transactions if not t["pending"] and t["amount"] > 0]

    by_category: dict[str, float] = {}
    monthly: dict[str, float] = {}
    for t in spending:
        cat = t["category"][0] if t["category"] else "Other"
        by_category[cat] = round(by_category.get(cat, 0) + t["amount"], 2)
        key = t["date"][:7]
        monthly[key] = round(monthly.get(key, 0) + t["amount"], 2)

    by_category = dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True))
    monthly = dict(sorted(monthly.items()))
    avg_monthly = round(sum(monthly.values()) / max(len(monthly), 1), 2)

    return {
        "by_category": by_category,
        "monthly_totals": monthly,
        "avg_monthly_spend": avg_monthly,
    }


def compute_optimization(data: PortfolioData) -> dict:
    cfg = token_store.load_config()
    target_alloc = cfg.get("target_allocation", {})
    conc_threshold = cfg.get("concentration_threshold_pct", 10)
    sector_threshold = cfg.get("sector_concentration_threshold_pct", 40)
    cash_threshold = cfg.get("cash_drag_threshold_pct", 5)
    high_er_threshold = cfg.get("high_expense_ratio_threshold", 0.005)
    employer_tickers = [e.upper() for e in cfg.get("employer_tickers", ["INTU"])]

    enriched = data.enriched_holdings
    total_value = sum(h.get("institution_value") or 0 for h in enriched)

    ticker_values: dict[str, float] = {}
    sector_values: dict[str, float] = {}
    asset_class_values: dict[str, float] = {}
    for h in enriched:
        val = h.get("institution_value") or 0
        label = h.get("ticker") or h.get("security_name") or "Unknown"
        ticker_values[label] = ticker_values.get(label, 0) + val
        sector_values[h.get("sector") or "Unknown"] = sector_values.get(h.get("sector") or "Unknown", 0) + val
        cls = market_data.get_asset_class(h.get("ticker", ""), h.get("quote_type", ""), h.get("sector", ""))
        asset_class_values[cls] = asset_class_values.get(cls, 0) + val

    conc_flags = []
    sector_flags = []
    if total_value > 0:
        for ticker, val in ticker_values.items():
            pct = val / total_value * 100
            if pct >= conc_threshold:
                conc_flags.append({
                    "ticker": ticker,
                    "value": round(val, 2),
                    "pct": round(pct, 1),
                    "is_employer": ticker.upper() in employer_tickers,
                })
        conc_flags.sort(key=lambda x: x["pct"], reverse=True)
        for sector, val in sector_values.items():
            pct = val / total_value * 100
            if pct >= sector_threshold:
                sector_flags.append({"sector": sector, "pct": round(pct, 1)})

    high_cost_funds = []
    for h in enriched:
        er = h.get("expense_ratio")
        if er and er > high_er_threshold:
            high_cost_funds.append({
                "ticker": h.get("ticker", ""),
                "security_name": h.get("security_name", ""),
                "expense_ratio": er,
                "institution_value": h.get("institution_value", 0),
                "annual_drag": round(er * (h.get("institution_value") or 0), 2),
            })
    high_cost_funds.sort(key=lambda x: x["annual_drag"], reverse=True)

    cash_tickers = {"spaxx", "vmfxx", "fdrxx", "swvxx", "sprxx", "fdic"}
    brokerage_value = sum(
        (a.get("balances", {}).get("current") or 0)
        for a in data.accounts
        if (a.get("type") or "").lower() in ("investment", "brokerage")
        or (a.get("subtype") or "").lower() in ("brokerage", "investment")
    )
    total_cash = sum(
        h.get("institution_value") or 0
        for h in enriched
        if (h.get("ticker") or "").lower() in cash_tickers
        or (h.get("quote_type") or "").lower() == "cash"
        or "money market" in (h.get("security_name") or "").lower()
    )
    cash_pct = (total_cash / brokerage_value * 100) if brokerage_value > 0 else 0

    rebalance_suggestion = {}
    if total_value > 0 and target_alloc:
        for cls, target_pct in target_alloc.items():
            current_pct = asset_class_values.get(cls, 0) / total_value * 100
            diff = current_pct - target_pct
            rebalance_suggestion[cls] = {
                "current_pct": round(current_pct, 1),
                "target_pct": target_pct,
                "diff_pct": round(diff, 1),
                "action": "reduce" if diff > 3 else ("increase" if diff < -3 else "on target"),
                "suggested_trade_usd": round(abs(diff / 100 * total_value), 0),
            }

    return {
        "concentration_flags": conc_flags,
        "sector_flags": sector_flags,
        "high_cost_funds": high_cost_funds,
        "cash_drag": {
            "total_cash": round(total_cash, 2),
            "pct": round(cash_pct, 1),
            "flagged": cash_pct >= cash_threshold,
        },
        "rebalance_suggestion": rebalance_suggestion,
        "total_portfolio_value": round(total_value, 2),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def index():
    return FileResponse("static/dashboard.html")


class ExchangeRequest(BaseModel):
    public_token: str
    institution: dict = {}


@app.post("/api/create_link_token")
def create_link_token():
    try:
        return {"link_token": plaid_client.create_link_token()}
    except plaid.ApiException as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/exchange_public_token")
def exchange_public_token(body: ExchangeRequest):
    try:
        result = plaid_client.exchange_public_token(body.public_token)
        institution_name = (body.institution or {}).get("name", "Unknown")
        token_store.append_token(result["access_token"], result["item_id"], institution_name)
        return {"status": "ok", "institution": institution_name}
    except plaid.ApiException as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/accounts")
def get_accounts():
    data = fetch_portfolio(want_investments=False, want_transactions=False)
    return {"accounts": data.accounts}


@app.get("/api/transactions")
def get_transactions():
    data = fetch_portfolio(want_investments=False, want_transactions=True)
    summary = aggregate_spending(data.transactions)
    recent = sorted(data.transactions, key=lambda x: x["date"], reverse=True)[:50]
    return {"transactions": recent, **summary}


@app.get("/api/investments")
def get_investments():
    data = fetch_portfolio(want_investments=True, want_transactions=False)
    enriched = data.enriched_holdings

    allocation: dict[str, float] = {}
    ticker_qty: dict[str, float] = {}
    for h in enriched:
        label = h.get("ticker") or h.get("security_name") or "Unknown"
        allocation[label] = round(allocation.get(label, 0) + (h.get("institution_value") or 0), 2)
        if h.get("ticker"):
            ticker_qty[h["ticker"]] = ticker_qty.get(h["ticker"], 0) + (h.get("quantity") or 0)

    allocation = dict(sorted(allocation.items(), key=lambda x: x[1], reverse=True))
    net_worth = round(sum((a.get("balances", {}).get("current") or 0) for a in data.accounts), 2)
    portfolio_history = market_data.monthly_portfolio_value(ticker_qty)

    return {
        "holdings": enriched,
        "securities": data.unique_securities,
        "accounts": data.accounts,
        "allocation": allocation,
        "net_worth": net_worth,
        "portfolio_history": portfolio_history,
        "has_investments": len(data.holdings) > 0,
    }


@app.get("/api/tax")
def get_tax():
    data = fetch_portfolio(want_investments=True, want_transactions=False)
    cfg = token_store.load_config()
    employer_tickers = cfg.get("employer_tickers", ["INTU"])

    enriched = data.enriched_holdings
    gains_list = tax_engine.gains_and_losses(enriched, data.investment_transactions)

    return {
        "gains_and_losses": gains_list,
        "tax_loss_harvesting": tax_engine.tax_loss_harvesting(gains_list, data.investment_transactions),
        "realized_gains": tax_engine.realized_gains_this_year(data.investment_transactions),
        "asset_location_flags": tax_engine.asset_location_analysis(enriched, data.accounts),
        "espp_status": tax_engine.espp_disposition_status(data.investment_transactions, employer_tickers),
    }


@app.get("/api/optimization")
def get_optimization():
    data = fetch_portfolio(want_investments=True, want_transactions=False)
    return compute_optimization(data)


@app.get("/api/insights")
def get_insights():
    data = fetch_portfolio(want_investments=True, want_transactions=True)
    enriched = data.enriched_holdings

    gains_list = tax_engine.gains_and_losses(enriched, data.investment_transactions)
    tlh = tax_engine.tax_loss_harvesting(gains_list, data.investment_transactions)
    location_flags = tax_engine.asset_location_analysis(enriched, data.accounts)
    optimization = compute_optimization(data)
    spending_summary = aggregate_spending(data.transactions)

    return insights_module.get_insights(
        accounts=data.accounts,
        enriched_holdings=enriched,
        gains_list=gains_list,
        tax_loss_candidates=tlh,
        asset_location_flags=location_flags,
        optimization=optimization,
        spending_summary=spending_summary,
    )
