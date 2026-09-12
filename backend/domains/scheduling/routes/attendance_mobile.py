import math
import os

from fastapi import APIRouter, HTTPException, Depends, Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, time as dtime
from database import get_db
from models import Attendance, User, Clinic
from schemas import AttendanceOut
from core.auth_utils import get_current_user, require_clinic_owner
from core.clinic_time import clinic_tzinfo, clinic_today, clinic_day_bounds_utc
from domains.scheduling.services.attendance_view import (
    LATE_GRACE_MINUTES,
    break_minutes,
    breaks_of,
    open_break,
    _late_by_minutes,
    _opening_time_for,
    _to_clinic_local,
    status_for_check_in,
)
from pydantic import BaseModel, Field

router = APIRouter()

# The same key the Google Reviews feature uses. Read here rather than passed to
# the app: see the /map endpoint for why it must not ship in the bundle.
PLACES_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap"


def _zoom_for(radius_m: int) -> int:
    """A zoom level that leaves the fence filling most of the frame.

    Each zoom step halves the ground covered, so this is a log: 150 m lands on
    16, a 1 km fence on 13. Clamped either side because a clinic that typed 5 m
    or 50 km should still get a legible picture.
    """
    zoom = 16 - math.log2(max(radius_m, 25) / 150)
    return max(12, min(int(round(zoom)), 18))


def _fence_path(lat: float, lng: float, radius_m: int, points: int = 40) -> str:
    """The geofence as a circle Static Maps can draw.

    Static Maps has no circle, only paths, so this walks `points` bearings
    around the centre. Longitude degrees shrink towards the poles, hence the
    cos(latitude); without it the ring is an ellipse everywhere but the equator.
    """
    lat_degree_m = 111_320.0
    lng_degree_m = lat_degree_m * max(math.cos(math.radians(lat)), 0.01)
    ring = []
    for i in range(points + 1):
        angle = 2 * math.pi * i / points
        ring.append(
            f"{lat + (radius_m * math.sin(angle)) / lat_degree_m:.6f},"
            f"{lng + (radius_m * math.cos(angle)) / lng_degree_m:.6f}"
        )
    return "color:0x2A276ECC|weight:2|fillcolor:0x2A276E22|" + "|".join(ring)


class ClockInRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = None
    # Why they are late, asked for at the moment of clocking in rather than
    # chased afterwards. Optional on the wire: a punctual clock-in has nothing
    # to explain, and refusing one without a reason would stop somebody
    # starting work over a text box.
    reason: Optional[str] = Field(default=None, max_length=280)

class GeofenceOut(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_m: int = 150
    is_set: bool = False
    clinic_name: Optional[str] = None


class GeofenceUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    # 10m is the tightest useful setting: a phone rarely resolves better than
    # that, but is_within_clinic_radius adds the device's own error estimate on
    # top, so a 10m fence with a +/-8m fix behaves like 18m. Beyond 2km this
    # stops being a geofence and becomes a postcode.
    radius_m: int = Field(150, ge=10, le=2000)


class ClockOutRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = None
    # What happened on the shift, in their words. Optional by design: a note
    # that blocks the end of a shift is a note people learn to type "." into.
    notes: Optional[str] = None

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters using Haversine formula"""
    from math import radians, cos, sin, asin, sqrt
    
    R = 6371000  # Earth radius in meters
    
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2) ** 2
    c = 2 * asin(sqrt(a))
    
    return R * c

def distance_from_clinic(clinic: Clinic, latitude: float, longitude: float):
    """Metres from the clinic pin, or None when the clinic has never set one."""
    lat, lng = getattr(clinic, 'latitude', None), getattr(clinic, 'longitude', None)
    if lat is None or lng is None:
        return None
    return calculate_distance(lat, lng, latitude, longitude)


def is_within_clinic_radius(clinic: Clinic, latitude: float, longitude: float, accuracy: float = None):
    """Whether this fix counts as "at the clinic".

    Three deliberate leniencies, because the cost of a false refusal here is a
    staff member who cannot start their shift:

    1. A clinic with no pin set lets everybody through. An owner who has never
       opened the map should not be locking their receptionist out.
    2. The radius is the clinic's own setting, not a hardcoded 100m. A ground
       floor surgery and a third-floor clinic in a mall need different numbers.
    3. The device's own error estimate widens the circle. A phone indoors
       routinely reports +/- 50m, so judging a 60m reading against a bare 150m
       radius would refuse people who are standing in reception.
    """
    distance = distance_from_clinic(clinic, latitude, longitude)
    if distance is None:
        return True, None

    radius = getattr(clinic, 'geofence_radius_m', None) or 150
    # Trust the fix only as far as it claims to be trustworthy, and cap the
    # allowance so a garbage reading (+/- 5km) cannot wave anything through.
    slack = min(float(accuracy or 0), 200.0)
    return distance <= (radius + slack), distance

def _todays_open_shift(db: Session, user: User):
    return db.query(Attendance).filter(
        Attendance.user_id == user.id,
        Attendance.date == datetime.now().date(),
        Attendance.check_out_time == None,  # noqa: E711 - SQL NULL comparison
    ).first()


@router.post("/clock-in", response_model=AttendanceOut)
async def clock_in(
    request: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clock in with location verification"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    # Geofence. The distance is kept either way, so an owner reviewing the day
    # can see how far out a check-in was even when it was allowed.
    ok, distance = is_within_clinic_radius(
        clinic, request.latitude, request.longitude, request.accuracy
    )
    if not ok:
        raise HTTPException(
            status_code=403,
            detail=(
                f"You look about {int(distance)} m from the clinic. "
                f"Clock in once you are inside, or ask your clinic owner to check the clinic's location."
            ),
        )
    
    # Check if user is already clocked in today
    today = datetime.now().date()
    existing_attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today,
        Attendance.check_out_time == None
    ).first()
    
    if existing_attendance:
        raise HTTPException(status_code=400, detail="You are already clocked in today")
    
    # Create attendance record.
    #
    # The status is worked out from the clinic's opening time for this weekday
    # rather than left to the column default. It used to take that default, so
    # every phone clock-in was stored as 'on_time' no matter how late it was:
    # somebody arriving 102 minutes after opening produced a green "Present"
    # cell on the owner's grid. A screen where everybody is always on time is
    # not a screen, and this is the same helper the grid uses to compute
    # "late by N minutes", so the badge and the number cannot disagree.
    check_in_at = datetime.now()
    attendance = Attendance(
        user_id=current_user.id,
        clinic_id=current_user.clinic_id,
        date=today,
        status=status_for_check_in(clinic, today, check_in_at),
        check_in_time=check_in_at,
        clock_in_latitude=request.latitude,
        clock_in_longitude=request.longitude,
        clock_in_address=request.address,
        clock_in_accuracy=request.accuracy,
        clock_in_distance_m=distance,
    )
    # Kept only when the status actually says late. The column is read by the
    # owner's grid as "reason for late/absent", so writing an explanation
    # against an on-time arrival would put an answer next to a question nobody
    # asked.
    if attendance.status == "late" and (request.reason or "").strip():
        attendance.reason = request.reason.strip()
    
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    
    return attendance

@router.post("/clock-out", response_model=AttendanceOut)
async def clock_out(
    request: ClockOutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clock out with location verification"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    # Clocking OUT is recorded, never refused. Somebody who has finished their
    # shift and walked to the car park still needs to close it, and a geofence
    # that traps them clocked-in overnight turns a safeguard into a bug. The
    # distance is stored so the owner can see it.
    _, distance = is_within_clinic_radius(
        clinic, request.latitude, request.longitude, request.accuracy
    )
    
    # Find today's attendance record
    today = datetime.now().date()
    attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today,
        Attendance.check_out_time == None
    ).first()
    
    if not attendance:
        raise HTTPException(status_code=400, detail="You are not clocked in today")
    
    # Update attendance record
    attendance.check_out_time = datetime.now()
    # A shift ended mid-break ends the break with it. Left open, it would keep
    # counting in every later read of the day.
    if open_break(attendance):
        attendance.breaks = [
            {**b, "end": b.get("end") or attendance.check_out_time.isoformat()}
            for b in breaks_of(attendance)
        ]
    attendance.clock_out_latitude = request.latitude
    attendance.clock_out_longitude = request.longitude
    attendance.clock_out_address = request.address
    attendance.clock_out_accuracy = request.accuracy
    attendance.clock_out_distance_m = distance
    if request.notes and request.notes.strip():
        attendance.notes = request.notes.strip()[:2000]
    
    # Hours worked are deliberately NOT stored. There is no hours_worked
    # column, so the assignment that used to live here set a throwaway Python
    # attribute and vanished on commit. The grid and both exports derive the
    # figure from the two timestamps, which also means correcting a time
    # corrects the total instead of leaving a stale number behind.

    db.commit()
    db.refresh(attendance)
    
    return attendance

@router.get("/status")
async def get_clock_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Everything the clock screen needs, in one call.

    The screen has three states — not started, on shift, finished for the day —
    and telling them apart used to need two requests plus a guess. Returning the
    whole of today means the screen renders correctly on first paint instead of
    flickering through a wrong state.
    """
    today = datetime.now().date()

    # Today's record, whether or not it is still open. The old query filtered on
    # check_out_time IS NULL, so a staff member who had finished their shift
    # looked identical to one who had never started: both reported
    # is_clocked_in false, and the screen offered to clock them in again.
    attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today,
    ).order_by(Attendance.check_in_time.desc()).first()

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    open_shift = bool(attendance and attendance.check_in_time and not attendance.check_out_time)

    return {
        "is_clocked_in": open_shift,
        "is_done_for_today": bool(attendance and attendance.check_out_time),
        "attendance_id": attendance.id if attendance else None,
        "clock_in_time": attendance.check_in_time.isoformat() if attendance and attendance.check_in_time else None,
        "clock_out_time": attendance.check_out_time.isoformat() if attendance and attendance.check_out_time else None,
        "clock_in_distance_m": getattr(attendance, 'clock_in_distance_m', None) if attendance else None,
        # Breaks, so the screen can show "On break since 13:05" and a total.
        "on_break": bool(open_shift and open_break(attendance)),
        "break_started_at": (open_break(attendance) or {}).get("start") if open_shift else None,
        "break_minutes": break_minutes(attendance) if attendance else 0,
        # So the screen can say "your clinic has not set its location yet"
        # rather than implying a geofence that is not actually being enforced.
        "geofence_set": bool(clinic and getattr(clinic, 'latitude', None) is not None),
        "geofence_radius_m": (getattr(clinic, 'geofence_radius_m', None) or 150) if clinic else 150,
        # The pin itself, so the clock screen can draw the map and the radius in
        # one request. It used to have a bare `geofence_set` boolean and had to
        # call /geofence again just to find out where "here" was.
        "clinic_name": clinic.name if clinic else None,
        "clinic_latitude": getattr(clinic, 'latitude', None) if clinic else None,
        "clinic_longitude": getattr(clinic, 'longitude', None) if clinic else None,
        # What they actually did today, for the clock-out summary.
        "today": _today_activity(db, current_user, clinic, clinic_today(clinic) if clinic else today),
        # Whether clocking in *now* would be recorded as late, so the screen can
        # ask for the reason before sending rather than after. Asking afterwards
        # means either a second request or a reason attached to a record that
        # already says on_time.
        #
        # Computed with the same helpers the stored status uses, so the prompt
        # and the record cannot disagree about who was late.
        **_late_now(clinic, today),
    }


def _today_activity(db: Session, user: User, clinic, day) -> dict:
    """What this person has to show for the day, counted from real records.

    Three numbers rather than one, because "patients seen" means different
    things to different people and a single figure would be zero for half the
    staff. A dentist is measured on who they treated; a receptionist on who they
    put on the books. The screen shows whichever are non-zero, so neither is
    told their shift was empty.

    Distinct patients, not rows: somebody registered in the morning and given a
    case paper in the afternoon is one patient, not two.

    ─── Three different notions of "today" ─────────────────────────────────

    This looked like one filter and is really three, because the columns are
    not stored the same way:

      * `Patient.registered_on` and `DailyVisit.visit_date` are clinic-LOCAL
        Date columns, so they compare against the clinic's own calendar day.
      * `CasePaper.date` is a UTC timestamp, so it needs the local day
        converted into UTC bounds first.
      * `Appointment.appointment_date` is a local naive datetime — the calendar
        compares it against `datetime.combine(day, ...)` with no conversion —
        so it takes local bounds.

    The first version used `datetime.now()` bounds against all of them. In IST
    that is wrong for five and a half hours a day: at 00:45 local it is still
    19:15 UTC on the previous date, so a patient registered "just now" fell
    outside "today" and the shift summary read zero. The test caught it at
    exactly that hour.

    Deliberately no "breaks" figure, however much the design asks for one. There
    is no break column on Attendance and nothing anywhere records one, so any
    number here would be invented.
    """
    from models import CasePaper, DailyVisit, Appointment, Patient

    day_date = day.date() if hasattr(day, "date") else day
    utc_start, utc_end = clinic_day_bounds_utc(clinic, day_date, day_date)
    local_start = datetime.combine(day_date, dtime.min)
    local_end = datetime.combine(day_date, dtime.max)

    def _count(q):
        try:
            return int(q.scalar() or 0)
        except Exception:  # noqa: BLE001 - a missing column must not break the clock
            return 0

    seen = set()
    try:
        cp = db.query(CasePaper.patient_id).filter(
            CasePaper.clinic_id == user.clinic_id,
            CasePaper.dentist_id == user.id,
        )
        if utc_start and utc_end:
            cp = cp.filter(CasePaper.date >= utc_start, CasePaper.date < utc_end)
        seen.update(pid for (pid,) in cp.all())

        seen.update(
            pid for (pid,) in db.query(DailyVisit.patient_id).filter(
                DailyVisit.clinic_id == user.clinic_id,
                DailyVisit.doctor_id == user.id,
                DailyVisit.visit_date == day_date,
            ).all()
        )
    except Exception:  # noqa: BLE001
        pass

    registered = _count(db.query(func.count(Patient.id)).filter(
        Patient.clinic_id == user.clinic_id,
        Patient.created_by == user.id,
        Patient.registered_on == day_date,
    ))
    appointments = _count(db.query(func.count(Appointment.id)).filter(
        Appointment.clinic_id == user.clinic_id,
        Appointment.doctor_id == user.id,
        Appointment.appointment_date >= local_start,
        Appointment.appointment_date <= local_end,
    ))

    return {
        "patients_seen": len(seen),
        "patients_registered": registered,
        "appointments": appointments,
    }


def _late_now(clinic, day) -> dict:
    """How late a clock-in at this instant would be.

    All three keys are null when the clinic has no hours set for the day, which
    the screen shows as no prompt at all: with nothing to be late against, the
    benefit of the doubt goes to the person who turned up. Same rule as
    status_for_check_in, deliberately.
    """
    if not clinic:
        return {"late_now": False, "late_by_minutes": None, "opening_time": None,
                "grace_minutes": LATE_GRACE_MINUTES}
    opening = _opening_time_for(clinic, day)
    local_now = _to_clinic_local(datetime.utcnow(), clinic_tzinfo(clinic))
    late_by = _late_by_minutes(local_now, opening)
    return {
        "late_now": bool(late_by is not None and late_by > LATE_GRACE_MINUTES),
        "late_by_minutes": late_by,
        "opening_time": opening,
        "grace_minutes": LATE_GRACE_MINUTES,
    }

@router.post("/break/start")
async def start_break(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Step away. No location: a break is taken wherever the person goes, and
    asking for a fix to go and buy a coffee is surveillance, not attendance."""
    attendance = _todays_open_shift(db, current_user)
    if not attendance:
        raise HTTPException(status_code=400, detail="You are not clocked in.")
    if open_break(attendance):
        raise HTTPException(status_code=400, detail="You are already on a break.")
    # A new list, not an append: SQLAlchemy only notices a JSON column change
    # when the value is reassigned.
    attendance.breaks = breaks_of(attendance) + [{"start": datetime.now().isoformat(), "end": None}]
    db.commit()
    return {"on_break": True, "break_minutes": break_minutes(attendance)}


@router.post("/break/end")
async def end_break(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attendance = _todays_open_shift(db, current_user)
    if not attendance:
        raise HTTPException(status_code=400, detail="You are not clocked in.")
    if not open_break(attendance):
        raise HTTPException(status_code=400, detail="You are not on a break.")
    now = datetime.now().isoformat()
    attendance.breaks = [{**b, "end": b.get("end") or now} for b in breaks_of(attendance)]
    db.commit()
    return {"on_break": False, "break_minutes": break_minutes(attendance)}


@router.get("/history")
async def get_attendance_history(
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get attendance history for current user"""
    attendances = db.query(Attendance).filter(
        Attendance.user_id == current_user.id
    ).order_by(Attendance.date.desc()).offset(skip).limit(limit).all()
    
    return attendances



# ── The clinic's pin ─────────────────────────────────────────────────────────
# Deliberately its own endpoint rather than three more fields on ClinicUpdateDTO.
# That DTO is posted by half a dozen screens, and quietly widening it would mean
# any of them could move the geofence as a side effect of saving a phone number.

@router.get("/geofence", response_model=GeofenceOut)
async def get_geofence(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Where the clinic says it is. Readable by any staff member, because the
    clock-in screen has to tell them what it is measuring against."""
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    lat = getattr(clinic, 'latitude', None)
    lng = getattr(clinic, 'longitude', None)
    return GeofenceOut(
        latitude=lat,
        longitude=lng,
        radius_m=getattr(clinic, 'geofence_radius_m', None) or 150,
        is_set=lat is not None and lng is not None,
        clinic_name=clinic.name,
    )


@router.get("/map")
async def geofence_map(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    width: int = 640,
    height: int = 400,
    scale: int = 2,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A real map of the clinic and where the phone thinks it is.

    The phone draws a stylised map of its own when this is unavailable, which is
    honest but tells nobody standing on the street whether the pin is on the
    right building. This is the actual streets.

    It is a proxy rather than a URL the app builds, for one reason: the Google
    key would otherwise have to ship inside the app bundle, where anybody can
    read it out of the APK and spend the clinic's quota. The key never leaves
    the server; the phone asks this endpoint, which is already authenticated.

    Returns 404 when the clinic has no pin and 503 when no key is configured, so
    the screen falls back to its own drawing instead of showing a broken image.
    """
    if not PLACES_KEY:
        raise HTTPException(status_code=503, detail="Maps are not configured for this server.")

    # Imported here, not at module scope. This is the only route that needs it,
    # and a module-level import that failed would take the whole attendance
    # router with it, so nobody could clock in or out.
    try:
        import httpx
    except ImportError:
        raise HTTPException(status_code=503, detail="Maps are not configured for this server.")

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic_lat = getattr(clinic, "latitude", None)
    clinic_lng = getattr(clinic, "longitude", None)
    if clinic_lat is None or clinic_lng is None:
        raise HTTPException(status_code=404, detail="This clinic has not dropped its pin yet.")

    radius = getattr(clinic, "geofence_radius_m", None) or 150

    # Clamp what the caller asks for. These go straight into a billed request,
    # and Static Maps refuses anything over 640 before scaling anyway.
    width = max(120, min(int(width), 640))
    height = max(120, min(int(height), 640))
    scale = 2 if int(scale) >= 2 else 1

    params = [
        ("size", f"{width}x{height}"),
        ("scale", str(scale)),
        ("maptype", "roadmap"),
        # The clinic in the app's navy, so the pin reads as ours.
        ("markers", f"color:0x2A276E|{clinic_lat},{clinic_lng}"),
        ("path", _fence_path(clinic_lat, clinic_lng, radius)),
        ("key", PLACES_KEY),
    ]

    if lat is not None and lng is not None:
        # Both pins on screen, and Google picks the zoom that fits them. Without
        # a second point it has nothing to frame, so the zoom is set by hand.
        params.insert(0, ("markers", f"color:0x059669|label:Y|{lat},{lng}"))
    else:
        params.append(("center", f"{clinic_lat},{clinic_lng}"))
        params.append(("zoom", str(_zoom_for(radius))))

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            upstream = await client.get(STATIC_MAP_URL, params=params)
    except httpx.HTTPError:
        # A map that will not load is not worth an error the screen has to
        # explain. The caller falls back to its own drawing.
        raise HTTPException(status_code=503, detail="The map could not be loaded right now.")

    if upstream.status_code != 200:
        raise HTTPException(status_code=503, detail="The map could not be loaded right now.")

    return Response(
        content=upstream.content,
        media_type=upstream.headers.get("content-type", "image/png"),
        # The clinic does not move and the staff member's own position is in the
        # URL, so the same request always draws the same picture.
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.put("/geofence", response_model=GeofenceOut)
async def set_geofence(
    payload: GeofenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    """Drop the pin. Owner only: this decides whether the rest of the staff can
    start their shift, so it is not a setting a receptionist should be able to
    move to wherever they happen to be standing."""
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.latitude = payload.latitude
    clinic.longitude = payload.longitude
    clinic.geofence_radius_m = payload.radius_m
    db.commit()
    db.refresh(clinic)

    return GeofenceOut(
        latitude=clinic.latitude, longitude=clinic.longitude,
        radius_m=clinic.geofence_radius_m, is_set=True, clinic_name=clinic.name,
    )
