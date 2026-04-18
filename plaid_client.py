import os
import datetime
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.model.investments_transactions_get_request import InvestmentsTransactionsGetRequest


def _make_client() -> plaid_api.PlaidApi:
    env = os.getenv("PLAID_ENV", "sandbox").lower()
    host = plaid.Environment.Sandbox if env == "sandbox" else plaid.Environment.Production
    cfg = plaid.Configuration(
        host=host,
        api_key={
            "clientId": os.getenv("PLAID_CLIENT_ID", ""),
            "secret": os.getenv("PLAID_SECRET", ""),
        },
    )
    return plaid_api.PlaidApi(plaid.ApiClient(cfg))


_client = None


def _get_client() -> plaid_api.PlaidApi:
    global _client
    if _client is None:
        _client = _make_client()
    return _client


def create_link_token() -> str:
    req = LinkTokenCreateRequest(
        client_name="Financial Dashboard",
        language="en",
        country_codes=[CountryCode("US")],
        user=LinkTokenCreateRequestUser(client_user_id="local-user"),
        products=[Products("transactions"), Products("investments")],
    )
    resp = _get_client().link_token_create(req)
    return resp["link_token"]


def exchange_public_token(public_token: str) -> dict:
    req = ItemPublicTokenExchangeRequest(public_token=public_token)
    resp = _get_client().item_public_token_exchange(req)
    return {"access_token": resp["access_token"], "item_id": resp["item_id"]}


def fetch_accounts(access_token: str) -> list[dict]:
    req = AccountsGetRequest(access_token=access_token)
    resp = _get_client().accounts_get(req)
    return [_account_to_dict(a) for a in resp["accounts"]]


def fetch_transactions(access_token: str) -> list[dict]:
    end = datetime.date.today()
    start = end - datetime.timedelta(days=365)
    all_txns = []
    offset = 0
    while True:
        req = TransactionsGetRequest(
            access_token=access_token,
            start_date=start,
            end_date=end,
            options=TransactionsGetRequestOptions(count=500, offset=offset),
        )
        resp = _get_client().transactions_get(req)
        batch = resp["transactions"]
        all_txns.extend([_txn_to_dict(t) for t in batch])
        if len(all_txns) >= resp["total_transactions"]:
            break
        offset += len(batch)
    return all_txns


def fetch_investments(access_token: str) -> dict:
    result = {"holdings": [], "securities": [], "accounts": [], "investment_transactions": []}
    end = datetime.date.today()
    start = end - datetime.timedelta(days=365)

    try:
        req = InvestmentsHoldingsGetRequest(access_token=access_token)
        resp = _get_client().investments_holdings_get(req)
        result["holdings"] = [h.to_dict() for h in resp["holdings"]]
        result["securities"] = [s.to_dict() for s in resp["securities"]]
        result["accounts"] = [_account_to_dict(a) for a in resp["accounts"]]
    except plaid.ApiException:
        pass

    try:
        req = InvestmentsTransactionsGetRequest(
            access_token=access_token,
            start_date=start,
            end_date=end,
        )
        resp = _get_client().investments_transactions_get(req)
        result["investment_transactions"] = [t.to_dict() for t in resp["investment_transactions"]]
    except plaid.ApiException:
        pass

    return result


def _account_to_dict(a) -> dict:
    balances = a.balances
    return {
        "account_id": a.account_id,
        "name": a.name,
        "official_name": getattr(a, "official_name", None),
        "type": str(a.type) if a.type else None,
        "subtype": str(a.subtype) if a.subtype else None,
        "balances": {
            "current": balances.current,
            "available": balances.available,
            "limit": getattr(balances, "limit", None),
        },
    }


def _txn_to_dict(t) -> dict:
    return {
        "transaction_id": t.transaction_id,
        "account_id": t.account_id,
        "date": str(t.date),
        "name": t.name,
        "amount": t.amount,
        "category": t.category or [],
        "pending": t.pending,
        "merchant_name": getattr(t, "merchant_name", None),
    }
