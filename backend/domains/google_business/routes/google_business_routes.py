from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from core.auth_utils import get_current_user
from models import User
import os
import requests
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest

os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

router = APIRouter()

SCOPES = ['https://www.googleapis.com/auth/business.manage']

gbp_pending_verifiers = {}

_CREDS_FILE = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'gbp_credentials.json')


def _load_credentials() -> dict:
    try:
        if os.path.exists(_CREDS_FILE):
            import json
            with open(_CREDS_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_credentials(creds: dict):
    import json
    os.makedirs(os.path.dirname(_CREDS_FILE), exist_ok=True)
    with open(_CREDS_FILE, 'w') as f:
        json.dump(creds, f)


def _get_client_config():
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    return {
        "web": {
            "client_id": os.getenv("GMAIL_CLIENT_ID"),
            "client_secret": os.getenv("GMAIL_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [f"{backend_url}/api/v1/google-business/oauth-callback"]
        }
    }


def _get_valid_token(user_id: str) -> str:
    all_creds = _load_credentials()
    if user_id not in all_creds:
        raise HTTPException(status_code=401, detail="Not connected to Google Business Profile")

    creds_data = all_creds[user_id]
    creds = Credentials(
        token=creds_data["token"],
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data["token_uri"],
        client_id=creds_data["client_id"],
        client_secret=creds_data["client_secret"],
        scopes=creds_data.get("scopes")
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        all_creds[user_id]["token"] = creds.token
        _save_credentials(all_creds)

    return creds.token


@router.get("/status")
async def check_status(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    all_creds = _load_credentials()
    is_connected = user_id in all_creds and all_creds[user_id] is not None
    return {"connected": is_connected}


@router.get("/auth-url")
async def get_auth_url(current_user: User = Depends(get_current_user)):
    try:
        client_config = _get_client_config()
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=client_config["web"]["redirect_uris"][0]
        )
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=str(current_user.id)
        )
        if hasattr(flow, 'code_verifier') and flow.code_verifier:
            gbp_pending_verifiers[str(current_user.id)] = flow.code_verifier
        return {"auth_url": auth_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate auth URL: {str(e)}")


@router.get("/oauth-callback")
async def oauth_callback(code: str, state: str):
    try:
        client_config = _get_client_config()
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')

        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=client_config["web"]["redirect_uris"][0]
        )

        code_verifier = gbp_pending_verifiers.pop(state, None)
        if code_verifier:
            flow.code_verifier = code_verifier

        flow.fetch_token(code=code)
        credentials = flow.credentials

        all_creds = _load_credentials()
        all_creds[state] = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else [],
            "cached_accounts": [],
            "cached_locations": {}
        }
        _save_credentials(all_creds)

        # Pre-fetch and cache accounts immediately to avoid quota hits on page load
        try:
            accts_resp = requests.get(
                "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
                headers={"Authorization": f"Bearer {credentials.token}"}
            )
            if accts_resp.ok:
                all_creds[state]["cached_accounts"] = accts_resp.json().get("accounts", [])
                # If single account, also fetch its locations
                accts = all_creds[state]["cached_accounts"]
                if len(accts) == 1:
                    account_name = accts[0]["name"]
                    locs_resp = requests.get(
                        f"https://mybusinessbusinessinformation.googleapis.com/v1/{account_name}/locations",
                        params={"readMask": "name,title,storeCode,storefrontAddress"},
                        headers={"Authorization": f"Bearer {credentials.token}"}
                    )
                    if locs_resp.ok:
                        all_creds[state]["cached_locations"][account_name] = locs_resp.json().get("locations", [])
                _save_credentials(all_creds)
        except Exception:
            pass

        return RedirectResponse(url=f"{frontend_url}/marketing/reviews?connected=true")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")


@router.get("/accounts")
async def list_accounts(refresh: bool = False, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    all_creds = _load_credentials()
    if user_id not in all_creds:
        raise HTTPException(status_code=401, detail="Not connected to Google Business Profile")

    cached = all_creds[user_id].get("cached_accounts", [])
    if cached and not refresh:
        return {"accounts": cached}

    token = _get_valid_token(user_id)
    response = requests.get(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        headers={"Authorization": f"Bearer {token}"}
    )
    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=f"GBP API error: {response.text}")

    accounts = response.json().get("accounts", [])
    all_creds[user_id]["cached_accounts"] = accounts
    _save_credentials(all_creds)
    return {"accounts": accounts}


@router.get("/locations")
async def list_locations(account_id: str, refresh: bool = False, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    all_creds = _load_credentials()
    if user_id not in all_creds:
        raise HTTPException(status_code=401, detail="Not connected to Google Business Profile")

    name = account_id if account_id.startswith("accounts/") else f"accounts/{account_id}"
    cached = all_creds[user_id].get("cached_locations", {}).get(name, [])
    if cached and not refresh:
        return {"locations": cached}

    token = _get_valid_token(user_id)
    response = requests.get(
        f"https://mybusinessbusinessinformation.googleapis.com/v1/{name}/locations",
        params={"readMask": "name,title,storeCode,storefrontAddress"},
        headers={"Authorization": f"Bearer {token}"}
    )
    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=f"GBP API error: {response.text}")

    locations = response.json().get("locations", [])
    if "cached_locations" not in all_creds[user_id]:
        all_creds[user_id]["cached_locations"] = {}
    all_creds[user_id]["cached_locations"][name] = locations
    _save_credentials(all_creds)
    return {"locations": locations}


@router.get("/reviews")
async def get_reviews(account_id: str, location_id: str, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    token = _get_valid_token(user_id)

    account_name = account_id if account_id.startswith("accounts/") else f"accounts/{account_id}"
    location_name = location_id if location_id.startswith("locations/") else f"locations/{location_id}"

    response = requests.get(
        f"https://mybusiness.googleapis.com/v4/{account_name}/{location_name}/reviews",
        params={"pageSize": 50},
        headers={"Authorization": f"Bearer {token}"}
    )

    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=f"GBP API error: {response.text}")

    data = response.json()
    reviews = data.get("reviews", [])

    rating_map = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}
    total = len(reviews)
    excellent = sum(1 for r in reviews if rating_map.get(r.get("starRating", ""), 0) >= 4)
    good = sum(1 for r in reviews if rating_map.get(r.get("starRating", ""), 0) == 3)
    bad = sum(1 for r in reviews if rating_map.get(r.get("starRating", ""), 0) <= 2)

    return {
        "reviews": reviews,
        "total": total,
        "summary": {
            "excellent": excellent,
            "excellent_pct": round(excellent / total * 100) if total else 0,
            "good": good,
            "good_pct": round(good / total * 100) if total else 0,
            "bad": bad,
            "bad_pct": round(bad / total * 100) if total else 0,
        }
    }


@router.post("/disconnect")
async def disconnect(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    all_creds = _load_credentials()
    if user_id in all_creds:
        del all_creds[user_id]
        _save_credentials(all_creds)
    return {"success": True}
