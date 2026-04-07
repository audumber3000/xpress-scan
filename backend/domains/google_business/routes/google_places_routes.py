import os
import hashlib
import datetime
import requests

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import nullslast

from database import get_db
from core.auth_utils import get_current_user
from models import User, GooglePlaceLink, GoogleReview, CompetitorSnapshot, CompetitorCache

router = APIRouter()

PLACES_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
PLACES_BASE = "https://maps.googleapis.com/maps/api/place"


def _review_hash(place_id: str, author: str, ts: int) -> str:
    raw = f"{place_id}:{author}:{ts}"
    return hashlib.sha256(raw.encode()).hexdigest()[:40]


def _fetch_place_details(place_id: str) -> dict:
    r = requests.get(
        f"{PLACES_BASE}/details/json",
        params={
            "place_id": place_id,
            "fields": "name,rating,user_ratings_total,reviews,geometry,formatted_address,vicinity",
            "reviews_sort": "newest",
            "key": PLACES_KEY,
        },
        timeout=10,
    )
    r.raise_for_status()
    return r.json().get("result", {})

def _sync_place_reviews(db: Session, link: GooglePlaceLink) -> int:
    """Fetch latest 5 reviews from Places API and persist any new ones. Returns new review count."""
    try:
        result = _fetch_place_details(link.place_id)
    except Exception as exc:
        print(f"[places-sync] fetch failed for clinic {link.clinic_id}: {exc}")
        return 0

    link.current_rating = result.get("rating")
    link.total_review_count = result.get("user_ratings_total", 0)
    link.last_synced_at = datetime.datetime.utcnow()

    new_count = 0
    for rv in result.get("reviews", []):
        ts = int(rv.get("time") or 0)
        author = rv.get("author_name", "")
        h = _review_hash(link.place_id, author, ts)
        if db.query(GoogleReview).filter(GoogleReview.review_hash == h).first():
            continue
        review_dt = datetime.datetime.utcfromtimestamp(ts) if ts else None
        db.add(GoogleReview(
            clinic_id=link.clinic_id,
            place_id=link.place_id,
            review_hash=h,
            author_name=author,
            author_url=rv.get("author_url"),
            profile_photo_url=rv.get("profile_photo_url"),
            rating=int(rv.get("rating") or 0),
            text=rv.get("text", ""),
            review_time=review_dt,
        ))
        new_count += 1

    db.commit()
    return new_count


def sync_all_clinics(db: Session):
    """Called by the daily background cron — syncs reviews for every linked clinic."""
    links = db.query(GooglePlaceLink).all()
    for link in links:
        try:
            _sync_place_reviews(db, link)
        except Exception as exc:
            print(f"[places-sync] clinic {link.clinic_id}: {exc}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/search")
def search_places(q: str, current_user: User = Depends(get_current_user)):
    if not PLACES_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_PLACES_API_KEY not configured")
    r = requests.get(
        f"{PLACES_BASE}/autocomplete/json",
        params={
            "input": q,
            "types": "establishment",
            "key": PLACES_KEY,
        },
        timeout=10,
    )
    if not r.ok:
        raise HTTPException(status_code=502, detail=f"Places API error: {r.text[:200]}")
    results = []
    for p in r.json().get("predictions", [])[:8]:
        sf = p.get("structured_formatting", {})
        results.append({
            "place_id": p.get("place_id"),
            "name": sf.get("main_text") or p.get("description"),
            "address": sf.get("secondary_text") or "",
            "description": p.get("description"),
        })
    return {"results": results}


@router.get("/status")
def get_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    link = db.query(GooglePlaceLink).filter(
        GooglePlaceLink.clinic_id == current_user.clinic_id
    ).first()
    if not link:
        return {"linked": False}
    accumulated = db.query(GoogleReview).filter(
        GoogleReview.clinic_id == current_user.clinic_id,
        GoogleReview.place_id == link.place_id
    ).count()
    return {
        "linked": True,
        "place_id": link.place_id,
        "place_name": link.place_name,
        "place_address": link.place_address,
        "current_rating": link.current_rating,
        "total_review_count": link.total_review_count,
        "accumulated_count": accumulated,
        "last_synced_at": link.last_synced_at.isoformat() if link.last_synced_at else None,
        "lat": link.latitude,
        "lng": link.longitude,
    }


@router.post("/link")
def link_place(
    place_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not PLACES_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_PLACES_API_KEY not configured")
    try:
        result = _fetch_place_details(place_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to verify place: {exc}")
    if not result:
        raise HTTPException(status_code=404, detail="Place not found")

    loc = result.get("geometry", {}).get("location", {})
    name = result.get("name")
    address = result.get("formatted_address") or result.get("vicinity")

    link = db.query(GooglePlaceLink).filter(
        GooglePlaceLink.clinic_id == current_user.clinic_id
    ).first()
    if link:
        link.place_id = place_id
        link.place_name = name
        link.place_address = address
        link.latitude = loc.get("lat")
        link.longitude = loc.get("lng")
        link.current_rating = result.get("rating")
        link.total_review_count = result.get("user_ratings_total", 0)
        link.linked_at = datetime.datetime.utcnow()
        link.linked_by = current_user.id
    else:
        link = GooglePlaceLink(
            clinic_id=current_user.clinic_id,
            place_id=place_id,
            place_name=name,
            place_address=address,
            latitude=loc.get("lat"),
            longitude=loc.get("lng"),
            current_rating=result.get("rating"),
            total_review_count=result.get("user_ratings_total", 0),
            linked_by=current_user.id,
        )
        db.add(link)
    db.commit()
    db.refresh(link)

    new_count = _sync_place_reviews(db, link)
    accumulated = db.query(GoogleReview).filter(
        GoogleReview.clinic_id == current_user.clinic_id,
        GoogleReview.place_id == link.place_id
    ).count()
    return {
        "linked": True,
        "place_name": link.place_name,
        "place_address": link.place_address,
        "current_rating": link.current_rating,
        "total_review_count": link.total_review_count,
        "new_reviews": new_count,
        "accumulated_count": accumulated,
    }


@router.delete("/unlink")
def unlink_place(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(GooglePlaceLink).filter(
        GooglePlaceLink.clinic_id == current_user.clinic_id
    ).first()
    if link:
        db.delete(link)
        db.commit()
    return {"success": True}


@router.get("/reviews")
def get_reviews(
    page: int = 1,
    limit: int = 50,
    rating: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(GooglePlaceLink).filter(
        GooglePlaceLink.clinic_id == current_user.clinic_id
    ).first()
    
    if not link:
        return {"reviews": [], "total": 0, "page": page, "summary": {}}

    q = db.query(GoogleReview).filter(
        GoogleReview.clinic_id == current_user.clinic_id,
        GoogleReview.place_id == link.place_id
    )
    if rating:
        q = q.filter(GoogleReview.rating == rating)
    total = q.count()
    rows = (
        q.order_by(nullslast(GoogleReview.review_time.desc()))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    all_q = db.query(GoogleReview).filter(
        GoogleReview.clinic_id == current_user.clinic_id,
        GoogleReview.place_id == link.place_id
    ).all()
    t = len(all_q)
    excellent = sum(1 for r in all_q if r.rating >= 4)
    good = sum(1 for r in all_q if r.rating == 3)
    bad = sum(1 for r in all_q if r.rating <= 2)

    return {
        "reviews": [
            {
                "id": r.id,
                "author_name": r.author_name,
                "author_url": r.author_url,
                "profile_photo_url": r.profile_photo_url,
                "rating": r.rating,
                "text": r.text,
                "review_time": r.review_time.isoformat() if r.review_time else None,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "summary": {
            "total": t,
            "excellent": excellent,
            "excellent_pct": round(excellent / t * 100) if t else 0,
            "good": good,
            "good_pct": round(good / t * 100) if t else 0,
            "bad": bad,
            "bad_pct": round(bad / t * 100) if t else 0,
        },
    }


@router.post("/sync")
def manual_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(GooglePlaceLink).filter(
        GooglePlaceLink.clinic_id == current_user.clinic_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="No place linked")
    new_count = _sync_place_reviews(db, link)
    accumulated = db.query(GoogleReview).filter(
        GoogleReview.clinic_id == current_user.clinic_id,
        GoogleReview.place_id == link.place_id
    ).count()
    return {
        "new_reviews": new_count,
        "accumulated_count": accumulated,
        "last_synced_at": link.last_synced_at.isoformat() if link.last_synced_at else None,
    }


@router.get("/competitors")
def get_competitors(
    scope: str = "5km",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(GooglePlaceLink).filter(
        GooglePlaceLink.clinic_id == current_user.clinic_id
    ).first()
    if not link or not link.latitude or not link.longitude:
        raise HTTPException(status_code=404, detail="No linked place with location data")
    if not PLACES_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_PLACES_API_KEY not configured")

    # 1. Check Cache (24-hour rule)
    one_day_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    cache = db.query(CompetitorCache).filter(
        CompetitorCache.clinic_id == current_user.clinic_id,
        CompetitorCache.place_id == link.place_id,
        CompetitorCache.scope == scope,
        CompetitorCache.synced_at >= one_day_ago
    ).first()

    if cache:
        # Return cached results immediately to save cost and time
        return {
            "competitors": cache.results,
            "your_rating": link.current_rating,
            "your_review_count": link.total_review_count,
            "synced_at": cache.synced_at.isoformat() if cache.synced_at else None,
            "from_cache": True
        }

    raw_results = []
    
    if scope == "city":
        # Strategy for "Entire City": Use searchText with City Name
        # Improved Heuristic: Address usually ends with ", [ZIP/State] [City], [State], India"
        # We'll split by comma and look for the city name in the last few segments.
        parts = [p.strip() for p in (link.place_address or "").split(',')]
        
        # Most Indian addresses: ... City, State ZIP, India.
        # Example: Nagapur, Ahilyanagar, Maharashtra 414111, India
        # We'll try to find the segment that contains the city.
        city_query = link.place_name # fallback
        if len(parts) >= 3:
            # parts[-1] is India, parts[-2] is State/ZIP, parts[-3] is often City
            city_query = parts[-3]
        elif len(parts) >= 2:
            city_query = parts[-2]
            
        url = "https://places.googleapis.com/v1/places:searchText"
        payload = {
            "textQuery": f"Dentists in {city_query}",
            "maxResultCount": 20,
            "locationBias": {
                "circle": {
                    "center": {"latitude": link.latitude, "longitude": link.longitude},
                    "radius": 50000.0
                }
            }
        }
        
        try:
            city_headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": PLACES_KEY,
                "X-Goog-FieldMask": "places.id,places.displayName,places.shortFormattedAddress,places.rating,places.userRatingCount,places.regularOpeningHours,places.parkingOptions,places.editorialSummary,nextPageToken"
            }
            for _ in range(3):
                r = requests.post(url, headers=city_headers, json=payload, timeout=10)
                if not r.ok: raise Exception(f"Google API error: {r.text}")
                data = r.json()
                raw_results.extend(data.get("places", []))
                token = data.get("nextPageToken")
                if not token: break
                import time as _time
                _time.sleep(1.5)
                payload["pageToken"] = token
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"City Search error: {str(e)[:200]}")
    else:
        # Strategy for 5km: Use searchNearby
        url = "https://places.googleapis.com/v1/places:searchNearby"
        nearby_headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": PLACES_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.shortFormattedAddress,places.rating,places.userRatingCount,places.regularOpeningHours,places.parkingOptions,places.editorialSummary"
        }
        nearby_payload = {
            "includedTypes": ["dentist"],
            "maxResultCount": 20,
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": link.latitude, "longitude": link.longitude},
                    "radius": 5000.0
                }
            }
        }
        try:
            r = requests.post(url, headers=nearby_headers, json=nearby_payload, timeout=10)
            if not r.ok: raise Exception(f"Google API error: {r.text}")
            data = r.json()
            raw_results = data.get("places", [])
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Nearby Search error: {str(e)[:200]}")

    # Deduplicate
    seen_ids = set()
    unique_raw = []
    for p in raw_results:
        p_id = p.get("id")
        if p_id and p_id not in seen_ids:
            seen_ids.add(p_id)
            unique_raw.append(p)
    raw_results = unique_raw
    
    # Velocity data setup
    one_month_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    snapshots = db.query(CompetitorSnapshot).filter(
        CompetitorSnapshot.clinic_id == current_user.clinic_id,
        CompetitorSnapshot.snapshot_date >= one_month_ago
    ).order_by(CompetitorSnapshot.snapshot_date.asc()).all()
    velocity_map = {}
    for s in snapshots:
        if s.place_id not in velocity_map: velocity_map[s.place_id] = s.review_count

    processed_competitors = []
    
    def process_place(p, is_our_clinic=False):
        p_id = p.get("id") if not is_our_clinic else link.place_id
        name = p.get("displayName", {}).get("text") if not is_our_clinic else link.place_name
        address = p.get("shortFormattedAddress") if not is_our_clinic else link.place_address
        rating = float(p.get("rating", 0)) if not is_our_clinic else (link.current_rating or 0.0)
        review_count = int(p.get("userRatingCount", 0)) if not is_our_clinic else (link.total_review_count or 0)
        
        badges = []
        parking = p.get("parkingOptions", {})
        if parking.get("freeParkingLot") or parking.get("freeStreetParking"):
            badges.append("🅿️ Free Parking")
        
        hours = p.get("regularOpeningHours", {})
        if hours:
            for period in hours.get("periods", []):
                open_day = period.get("open", {}).get("day")
                if open_day == 6: badges.append("🕒 Open Saturdays")
                if open_day == 0: badges.append("🕒 Open Sundays")
                try:
                    if period.get("close", {}).get("hour", 0) >= 18:
                        if "🌙 Evening Hours" not in badges: badges.append("🌙 Evening Hours")
                except: pass
        
        summary = p.get("editorialSummary", {}).get("text", "")
        old_count = velocity_map.get(p_id, review_count)
        velocity = max(0, review_count - old_count)
        
        # Save historical snapshot
        db.add(CompetitorSnapshot(
            clinic_id = current_user.clinic_id,
            place_id = p_id,
            review_count = review_count,
            rating = rating
        ))
        
        return {
            "place_id": p_id,
            "name": name,
            "address": address,
            "rating": rating,
            "review_count": review_count,
            "is_our_clinic": is_our_clinic,
            "badges": list(set(badges)),
            "summary": summary,
            "velocity": velocity,
            "review_gap": max(0, review_count - (link.total_review_count or 0)) if not is_our_clinic else 0
        }

    # Add our place logic
    our_place_in_results = any(p.get("id") == link.place_id for p in raw_results)
    for p in raw_results:
        is_ours = p.get("id") == link.place_id
        processed_competitors.append(process_place(p, is_our_clinic=is_ours))
        
    if not our_place_in_results:
        processed_competitors.append(process_place({}, is_our_clinic=True))

    # Sort algorithm
    import math
    def get_score(c):
        r_val = c.get("rating", 0)
        rc_val = c.get("review_count", 0)
        vol_score = math.log10(rc_val + 1) if rc_val > 0 else 0
        return vol_score * (r_val ** 2)

    processed_competitors.sort(key=get_score, reverse=True)
    
    # 2. Save results to DB cache
    # First, clear any old cache for this scope to keep it fresh
    db.query(CompetitorCache).filter(
        CompetitorCache.clinic_id == current_user.clinic_id,
        CompetitorCache.place_id == link.place_id,
        CompetitorCache.scope == scope
    ).delete()
    
    new_cache = CompetitorCache(
        clinic_id = current_user.clinic_id,
        place_id = link.place_id,
        scope = scope,
        results = processed_competitors[:60]
    )
    db.add(new_cache)
    db.commit()

    return {
        "competitors": processed_competitors[:60],
        "your_rating": link.current_rating,
        "your_review_count": link.total_review_count,
        "synced_at": new_cache.synced_at.isoformat() if new_cache.synced_at else datetime.datetime.utcnow().isoformat(),
        "from_cache": False
    }
