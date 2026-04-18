"""Claude API integration for personalized investment insights."""
import os
import json
from anthropic import Anthropic

_client = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _client


def _build_portfolio_summary(
    accounts: list[dict],
    enriched_holdings: list[dict],
    gains_list: list[dict],
    tax_loss_candidates: list[dict],
    asset_location_flags: list[dict],
    optimization: dict,
    spending_summary: dict,
) -> str:
    net_worth = sum(
        (a.get("balances", {}).get("current") or 0) for a in accounts
    )
    total_invested = sum(h.get("institution_value") or 0 for h in enriched_holdings)
    total_unrealized = sum(g["unrealized_gain"] for g in gains_list)

    top_holdings = sorted(enriched_holdings, key=lambda x: x.get("institution_value") or 0, reverse=True)[:8]
    holdings_str = "\n".join(
        f"  - {h.get('ticker') or h.get('security_name', 'Unknown')}: "
        f"${h.get('institution_value', 0):,.0f} ({h.get('sector') or h.get('quote_type', '')})"
        for h in top_holdings
    )

    tlh_str = ""
    if tax_loss_candidates:
        tlh_str = "\nTax-loss harvesting candidates:\n" + "\n".join(
            f"  - {c['ticker']}: ${c['unrealized_gain']:,.0f} loss"
            + (" [WASH SALE RISK]" if c.get("wash_sale_risk") else "")
            for c in tax_loss_candidates[:5]
        )

    loc_str = ""
    if asset_location_flags:
        loc_str = "\nAsset location issues (tax-inefficient assets in taxable accounts):\n" + "\n".join(
            f"  - {f['ticker']}: {f['reason']}" for f in asset_location_flags[:5]
        )

    conc_str = ""
    conc_flags = optimization.get("concentration_flags", [])
    if conc_flags:
        conc_str = "\nConcentration flags:\n" + "\n".join(
            f"  - {c['ticker']}: {c['pct']:.1f}% of portfolio{' [EMPLOYER STOCK]' if c.get('is_employer') else ''}"
            for c in conc_flags
        )

    cash_drag = optimization.get("cash_drag", {})
    cash_str = ""
    if cash_drag.get("flagged"):
        cash_str = f"\nCash drag: ${cash_drag.get('total_cash', 0):,.0f} ({cash_drag.get('pct', 0):.1f}% of brokerage) uninvested"

    expense_str = ""
    high_cost = optimization.get("high_cost_funds", [])
    if high_cost:
        total_drag = sum(f.get("annual_drag", 0) for f in high_cost)
        expense_str = f"\nHigh-cost funds (total annual drag: ${total_drag:,.0f}/yr):\n" + "\n".join(
            f"  - {f['ticker']}: {(f.get('expense_ratio') or 0)*100:.2f}% ER" for f in high_cost[:4]
        )

    monthly_spend = spending_summary.get("avg_monthly_spend", 0)
    top_cats = list(spending_summary.get("by_category", {}).items())[:5]
    spend_str = f"\nAvg monthly spending: ${monthly_spend:,.0f}"
    if top_cats:
        spend_str += "\nTop categories: " + ", ".join(f"{k} ${v:,.0f}" for k, v in top_cats)

    rebalance = optimization.get("rebalance_suggestion", {})
    rebalance_str = ""
    if rebalance:
        rebalance_str = "\nAllocation drift from target:\n" + "\n".join(
            f"  - {k}: {v['current_pct']:.1f}% actual vs {v['target_pct']:.1f}% target ({v['action']})"
            for k, v in rebalance.items()
        )

    return f"""Net worth: ${net_worth:,.0f}
Total invested: ${total_invested:,.0f}
Total unrealized gain/loss: ${total_unrealized:+,.0f}

Top holdings:
{holdings_str}
{spend_str}
{tlh_str}
{loc_str}
{conc_str}
{cash_str}
{expense_str}
{rebalance_str}""".strip()


def generate_insights(portfolio_summary: str) -> str:
    """Call Claude to generate 4-5 personalized investment insights. Returns plain text."""
    prompt = f"""You are a knowledgeable financial advisor reviewing a client's personal financial dashboard.
Based on the portfolio data below, provide 4-5 specific, actionable insights focused on:
- Long-term wealth building
- Tax efficiency (including any RSU/ESPP considerations if relevant)
- Risk management and diversification
- Concrete next steps the investor should consider

Be direct, specific, and reference the actual numbers. Avoid generic advice.
Do not give a disclaimer about not being a financial advisor — the user already understands this is informational.
Format as a numbered list.

Portfolio summary:
{portfolio_summary}"""

    message = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def get_insights(
    accounts: list[dict],
    enriched_holdings: list[dict],
    gains_list: list[dict],
    tax_loss_candidates: list[dict],
    asset_location_flags: list[dict],
    optimization: dict,
    spending_summary: dict,
) -> dict:
    if not enriched_holdings and not accounts:
        return {"insights": "Connect your financial accounts to get personalized insights.", "summary": ""}

    summary = _build_portfolio_summary(
        accounts, enriched_holdings, gains_list,
        tax_loss_candidates, asset_location_flags, optimization, spending_summary,
    )
    try:
        text = generate_insights(summary)
    except Exception as e:
        text = f"Unable to generate insights: {str(e)}"

    return {"insights": text, "summary": summary}
