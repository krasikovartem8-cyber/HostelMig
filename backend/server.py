from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import db.models  # noqa: F401
from db.models import (
    BrigadeTable,
    CompanyTable,
    FinancialRecordTable,
    MigrantTable,
    RoomTable,
    UserTable,
)
from db.session import async_session_maker, close_engine, get_db, init_schema
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "luba-dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

app = FastAPI(title="Luba API")
_cors = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Локализуем самые частые сообщения валидации, чтобы UI показывал понятный русский текст.
    translated = []
    for err in exc.errors():
        msg = str(err.get("msg") or "").strip()
        loc = err.get("loc") or []
        field = str(loc[-1]) if loc else "поле"

        lower_msg = msg.lower()
        if "valid email address" in lower_msg:
            msg_ru = f"Поле {field}: укажите корректный email (например, name@company.ru)"
        elif "field required" in lower_msg:
            msg_ru = f"Поле {field}: обязательно для заполнения"
        else:
            msg_ru = f"Поле {field}: {msg}" if msg else f"Поле {field}: некорректное значение"

        translated.append({"loc": loc, "msg": msg_ru, "type": err.get("type")})

    return JSONResponse(status_code=422, content={"detail": translated})


class TokenOut(BaseModel):
    access_token: str
    token_type: str
    user: dict


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(sub: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": sub, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def user_payload(u: UserTable) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": {
            "admin": u.is_admin,
            "accountant": u.is_admin or getattr(u, "is_accountant", False),
            "migration_officer": u.is_admin or getattr(u, "is_migration_officer", False),
        },
        "is_active": u.is_active,
    }


async def get_current_user(
    session: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> UserTable:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен")
    r = await session.execute(select(UserTable).where(UserTable.email == email))
    u = r.scalar_one_or_none()
    if not u or not u.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED)
    return u


@app.get("/health")
async def health():
    return {"ok": True, "service": "luba-api"}


@app.post("/auth/login", response_model=TokenOut)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
):
    r = await session.execute(select(UserTable).where(UserTable.email == form.username))
    u = r.scalar_one_or_none()
    if not u or not verify_password(form.password, u.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")
    token = create_access_token(u.email)
    return TokenOut(access_token=token, token_type="bearer", user=user_payload(u))


@app.get("/auth/me")
async def me(user: UserTable = Depends(get_current_user)):
    return user_payload(user)


def _dt_iso(d: datetime | None) -> str | None:
    if d is None:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.isoformat()


def _require_admin(user: UserTable) -> None:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администратор может создавать, изменять и удалять данные",
        )


def _require_admin_or_accountant(user: UserTable) -> None:
    if not (user.is_admin or getattr(user, "is_accountant", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администратор или бухгалтер может создавать, изменять и удалять данные",
        )


def _require_admin_or_migration_officer(user: UserTable) -> None:
    if not (user.is_admin or getattr(user, "is_migration_officer", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администратор или сотрудник миграционного учёта может создавать, изменять и удалять данные",
        )


# --- Pydantic request models ---


class CompanyCreate(BaseModel):
    name: str
    inn: str
    kpp: Optional[str] = None
    legal_address: str
    contact_person: str
    contact_phone: str
    contact_email: EmailStr
    tariff_per_day: float
    contract_number: Optional[str] = None
    contract_date: Optional[datetime] = None


class CompanyUpdate(BaseModel):
    name: str
    inn: str
    kpp: Optional[str] = None
    legal_address: str
    contact_person: str
    contact_phone: str
    contact_email: EmailStr
    tariff_per_day: float
    contract_number: Optional[str] = None
    contract_date: Optional[datetime] = None


class RoomCreate(BaseModel):
    room_number: str
    floor: int
    bed_count: int


class BrigadeCreate(BaseModel):
    company_id: str
    name: str
    room_id: Optional[str] = None
    check_in_date: datetime


class RoomRelocationItem(BaseModel):
    brigade_id: str
    to_room_id: str


class RoomStatusUpdate(BaseModel):
    status: Literal["available", "occupied", "maintenance", "dirty", "cleaning", "quarantine"]
    relocations: List[RoomRelocationItem] = []


class MigrantCreate(BaseModel):
    brigade_id: str
    full_name: str
    citizenship: Optional[str] = None
    passport_number: str
    passport_issued_date: datetime
    passport_expiry_date: datetime
    migration_card_number: Optional[str] = None
    migration_card_expiry: Optional[datetime] = None
    work_patent_number: Optional[str] = None
    work_patent_expiry: Optional[datetime] = None


class FinanceCreate(BaseModel):
    company_id: str
    type: Literal["invoice", "payment", "debt"]
    amount: float
    description: str
    status: Literal["pending", "paid", "overdue"]


# --- Dict mappers ---


def company_dict(c: CompanyTable) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "inn": c.inn,
        "kpp": c.kpp,
        "legal_address": c.legal_address,
        "contact_person": c.contact_person,
        "contact_phone": c.contact_phone,
        "contact_email": c.contact_email,
        "tariff_per_day": c.tariff_per_day,
        "contract_number": c.contract_number,
        "contract_date": _dt_iso(c.contract_date),
        "created_at": _dt_iso(c.created_at),
        "is_active": c.is_active,
    }


def _normalize_company_payload(body: CompanyCreate | CompanyUpdate) -> dict:
    name = (body.name or "").strip()
    inn = (body.inn or "").strip()
    legal_address = (body.legal_address or "").strip()
    contact_person = (body.contact_person or "").strip()
    contact_phone = (body.contact_phone or "").strip()
    kpp = (body.kpp or "").strip() or None
    contract_number = (body.contract_number or "").strip() or None

    if not name:
        raise HTTPException(status_code=400, detail="Название компании обязательно")
    if not inn:
        raise HTTPException(status_code=400, detail="ИНН обязателен")
    if not legal_address:
        raise HTTPException(status_code=400, detail="Юридический адрес обязателен")
    if not contact_person:
        raise HTTPException(status_code=400, detail="Контактное лицо обязательно")
    if not contact_phone:
        raise HTTPException(status_code=400, detail="Телефон обязателен")
    if body.tariff_per_day <= 0:
        raise HTTPException(status_code=400, detail="Тариф за день должен быть больше 0")

    return {
        "name": name,
        "inn": inn,
        "kpp": kpp,
        "legal_address": legal_address,
        "contact_person": contact_person,
        "contact_phone": contact_phone,
        "contact_email": str(body.contact_email),
        "tariff_per_day": body.tariff_per_day,
        "contract_number": contract_number,
        "contract_date": body.contract_date,
    }


def room_dict(r: RoomTable) -> dict:
    return {
        "id": r.id,
        "room_number": r.room_number,
        "floor": r.floor,
        "bed_count": r.bed_count,
        "occupied_beds": r.occupied_beds,
        "status": r.status,
        "created_at": _dt_iso(r.created_at),
    }


def brigade_dict(b: BrigadeTable) -> dict:
    return {
        "id": b.id,
        "company_id": b.company_id,
        "name": b.name,
        "room_id": b.room_id,
        "check_in_date": _dt_iso(b.check_in_date),
        "check_out_date": _dt_iso(b.check_out_date),
        "status": b.status,
        "created_at": _dt_iso(b.created_at),
        "brigade_leader_id": None,
    }


def migrant_dict(m: MigrantTable) -> dict:
    return {
        "id": m.id,
        "brigade_id": m.brigade_id,
        "full_name": m.full_name,
        "citizenship": m.citizenship,
        "passport_number": m.passport_number,
        "passport_issued_date": _dt_iso(m.passport_issued_date),
        "passport_expiry_date": _dt_iso(m.passport_expiry_date),
        "migration_card_number": m.migration_card_number,
        "migration_card_expiry": _dt_iso(m.migration_card_expiry),
        "work_patent_number": m.work_patent_number,
        "work_patent_expiry": _dt_iso(m.work_patent_expiry),
        "created_at": _dt_iso(m.created_at),
        "is_active": m.is_active,
    }


def finance_dict(f: FinancialRecordTable) -> dict:
    return {
        "id": f.id,
        "company_id": f.company_id,
        "type": f.type,
        "amount": f.amount,
        "description": f.description,
        "date": _dt_iso(f.date),
        "status": f.status,
        "created_at": _dt_iso(f.created_at),
    }


async def _room_occupy(session: AsyncSession, room_id: str) -> None:
    room = await session.get(RoomTable, room_id)
    if not room:
        raise HTTPException(status_code=400, detail="Комната не найдена")
    if (room.occupied_beds or 0) >= room.bed_count:
        raise HTTPException(status_code=400, detail="Нет свободных мест в комнате")
    room.occupied_beds = (room.occupied_beds or 0) + 1
    room.status = "occupied" if room.occupied_beds >= room.bed_count else "available"


async def _room_release(session: AsyncSession, room_id: str | None) -> None:
    if not room_id:
        return
    room = await session.get(RoomTable, room_id)
    if not room:
        return
    room.occupied_beds = max(0, (room.occupied_beds or 0) - 1)
    room.status = "available" if room.occupied_beds < room.bed_count else room.status


# --- Companies ---


@app.get("/companies")
async def list_companies(
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    r = await session.execute(
        select(CompanyTable).where(CompanyTable.is_active == True).order_by(CompanyTable.name)
    )
    return [company_dict(x) for x in r.scalars().all()]


@app.post("/companies")
async def create_company(
    body: CompanyCreate,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_accountant(user)
    p = _normalize_company_payload(body)
    c = CompanyTable(
        id=str(uuid.uuid4()),
        name=p["name"],
        inn=p["inn"],
        kpp=p["kpp"],
        legal_address=p["legal_address"],
        contact_person=p["contact_person"],
        contact_phone=p["contact_phone"],
        contact_email=p["contact_email"],
        tariff_per_day=p["tariff_per_day"],
        contract_number=p["contract_number"],
        contract_date=p["contract_date"],
        is_active=True,
    )
    session.add(c)
    await session.flush()
    return company_dict(c)


@app.put("/companies/{company_id}")
async def update_company(
    company_id: str,
    body: CompanyUpdate,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_accountant(user)
    c = await session.get(CompanyTable, company_id)
    if not c or c.is_active is not True:
        raise HTTPException(status_code=404, detail="Компания не найдена")

    p = _normalize_company_payload(body)
    c.name = p["name"]
    c.inn = p["inn"]
    c.kpp = p["kpp"]
    c.legal_address = p["legal_address"]
    c.contact_person = p["contact_person"]
    c.contact_phone = p["contact_phone"]
    c.contact_email = p["contact_email"]
    c.tariff_per_day = p["tariff_per_day"]
    c.contract_number = p["contract_number"]
    c.contract_date = p["contract_date"]
    await session.flush()
    return company_dict(c)


@app.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: str,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_accountant(user)
    c = await session.get(CompanyTable, company_id)
    if not c:
        raise HTTPException(status_code=404)
    br = await session.execute(select(BrigadeTable).where(BrigadeTable.company_id == company_id))
    if br.scalars().first():
        raise HTTPException(status_code=400, detail="Сначала удалите бригады этой компании")
    await session.delete(c)
    return None


# --- Rooms ---


@app.get("/rooms")
async def list_rooms(
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    r = await session.execute(select(RoomTable).order_by(RoomTable.floor, RoomTable.room_number))
    return [room_dict(x) for x in r.scalars().all()]


@app.post("/rooms")
async def create_room(
    body: RoomCreate,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin(user)
    if body.bed_count <= 0:
        raise HTTPException(status_code=400, detail="Количество койко-мест должно быть больше 0")
    room = RoomTable(
        id=str(uuid.uuid4()),
        room_number=body.room_number,
        floor=body.floor,
        bed_count=body.bed_count,
        occupied_beds=0,
        status="available",
    )
    session.add(room)
    await session.flush()
    return room_dict(room)


@app.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: str,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin(user)
    room = await session.get(RoomTable, room_id)
    if not room:
        raise HTTPException(status_code=404)
    if (room.occupied_beds or 0) > 0:
        raise HTTPException(status_code=400, detail="Нельзя удалить комнату с заселением")
    br = await session.execute(select(BrigadeTable).where(BrigadeTable.room_id == room_id))
    if br.scalars().first():
        raise HTTPException(status_code=400, detail="Комната привязана к бригаде")
    await session.delete(room)
    return None


@app.put("/rooms/{room_id}/status")
async def update_room_status(
    room_id: str,
    body: RoomStatusUpdate,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin(user)
    room = await session.get(RoomTable, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Комната не найдена")

    blocked_statuses = {"maintenance", "dirty", "cleaning", "quarantine"}
    br_res = await session.execute(
        select(BrigadeTable).where(BrigadeTable.room_id == room_id, BrigadeTable.status == "active")
    )
    active_brigades = br_res.scalars().all()
    active_ids = {b.id for b in active_brigades}

    if body.status in blocked_statuses and active_brigades:
        candidates_res = await session.execute(
            select(RoomTable).where(
                RoomTable.id != room_id,
                RoomTable.bed_count > RoomTable.occupied_beds,
                RoomTable.status.not_in(blocked_statuses),
            )
        )
        candidates = candidates_res.scalars().all()
        if not candidates:
            raise HTTPException(status_code=400, detail="Нет доступных комнат для переселения")

        reloc = body.relocations or []
        reloc_map = {r.brigade_id: (r.to_room_id or "").strip() for r in reloc}
        if set(reloc_map.keys()) != active_ids:
            raise HTTPException(
                status_code=400,
                detail="Для каждой активной бригады в комнате нужно указать новую комнату",
            )

        for b in active_brigades:
            to_room_id = reloc_map.get(b.id)
            if not to_room_id:
                raise HTTPException(status_code=400, detail="Новая комната не выбрана")
            if to_room_id == room_id:
                raise HTTPException(status_code=400, detail="Нельзя переселить бригаду в ту же комнату")
            await _room_release(session, b.room_id)
            await _room_occupy(session, to_room_id)
            b.room_id = to_room_id

    room.status = body.status
    await session.flush()
    return room_dict(room)


# --- Brigades ---


@app.get("/brigades")
async def list_brigades(
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    r = await session.execute(select(BrigadeTable).order_by(BrigadeTable.created_at.desc()))
    return [brigade_dict(x) for x in r.scalars().all()]


@app.post("/brigades")
async def create_brigade(
    body: BrigadeCreate,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin(user)
    comp = await session.get(CompanyTable, body.company_id)
    if not comp or comp.is_active is not True:
        raise HTTPException(status_code=400, detail="Компания не найдена")

    rid = body.room_id.strip() if body.room_id else None
    if rid:
        await _room_occupy(session, rid)

    b = BrigadeTable(
        id=str(uuid.uuid4()),
        company_id=body.company_id,
        name=body.name,
        room_id=rid,
        check_in_date=body.check_in_date,
        check_out_date=None,
        status="active",
    )
    session.add(b)
    await session.flush()
    return brigade_dict(b)


@app.delete("/brigades/{brigade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brigade(
    brigade_id: str,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin(user)
    b = await session.get(BrigadeTable, brigade_id)
    if not b:
        raise HTTPException(status_code=404)
    await _room_release(session, b.room_id)
    await session.delete(b)
    return None


# --- Migrants ---


@app.get("/migrants")
async def list_migrants(
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_migration_officer(user)
    r = await session.execute(
        select(MigrantTable)
        .where(MigrantTable.is_active == True)
        .order_by(MigrantTable.full_name)
    )
    return [migrant_dict(x) for x in r.scalars().all()]


@app.post("/migrants")
async def create_migrant(
    body: MigrantCreate,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_migration_officer(user)
    br = await session.get(BrigadeTable, body.brigade_id)
    if not br:
        raise HTTPException(status_code=400, detail="Бригада не найдена")
    if br.status != "active":
        raise HTTPException(status_code=400, detail="Нельзя добавлять мигранта в выселенную бригаду")
    if body.passport_expiry_date < body.passport_issued_date:
        raise HTTPException(status_code=400, detail="Срок действия паспорта не может быть раньше даты выдачи")

    citizenship = (body.citizenship or "").strip()
    if not citizenship:
        raise HTTPException(status_code=400, detail="Укажите гражданство")
    if len(citizenship) > 128:
        raise HTTPException(status_code=400, detail="Гражданство: не более 128 символов")

    m = MigrantTable(
        id=str(uuid.uuid4()),
        brigade_id=body.brigade_id,
        full_name=body.full_name,
        citizenship=citizenship,
        passport_number=body.passport_number,
        passport_issued_date=body.passport_issued_date,
        passport_expiry_date=body.passport_expiry_date,
        migration_card_number=body.migration_card_number,
        migration_card_expiry=body.migration_card_expiry,
        work_patent_number=body.work_patent_number,
        work_patent_expiry=body.work_patent_expiry,
        is_active=True,
    )
    session.add(m)
    await session.flush()
    return migrant_dict(m)


@app.delete("/migrants/{migrant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_migrant(
    migrant_id: str,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_migration_officer(user)
    m = await session.get(MigrantTable, migrant_id)
    if not m:
        raise HTTPException(status_code=404)
    await session.delete(m)
    return None


# --- Finances ---


@app.get("/finances")
async def list_finances(
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    r = await session.execute(select(FinancialRecordTable).order_by(FinancialRecordTable.date.desc()))
    return [finance_dict(x) for x in r.scalars().all()]


@app.post("/finances")
async def create_finance(
    body: FinanceCreate,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_accountant(user)
    comp = await session.get(CompanyTable, body.company_id)
    if not comp or comp.is_active is not True:
        raise HTTPException(status_code=400, detail="Компания не найдена")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть числом больше 0")
    desc = (body.description or "").strip()
    if not desc:
        raise HTTPException(status_code=400, detail="Описание обязательно")

    f = FinancialRecordTable(
        id=str(uuid.uuid4()),
        company_id=body.company_id,
        type=body.type,
        amount=body.amount,
        description=desc,
        date=datetime.now(timezone.utc),
        status=body.status,
    )
    session.add(f)
    await session.flush()
    return finance_dict(f)


@app.delete("/finances/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finance(
    record_id: str,
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    _require_admin_or_accountant(user)
    f = await session.get(FinancialRecordTable, record_id)
    if not f:
        raise HTTPException(status_code=404)
    await session.delete(f)
    return None


# --- Dashboard ---


@app.get("/dashboard/stats")
async def dashboard_stats(
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    total_companies = await session.scalar(
        select(func.count()).select_from(CompanyTable).where(CompanyTable.is_active == True)
    )
    total_brigades = await session.scalar(
        select(func.count()).select_from(BrigadeTable).where(BrigadeTable.status == "active")
    )
    total_migrants = await session.scalar(
        select(func.count()).select_from(MigrantTable).where(MigrantTable.is_active == True)
    )
    total_rooms = await session.scalar(select(func.count()).select_from(RoomTable))

    occupied_rooms = await session.scalar(
        select(func.count()).select_from(RoomTable).where(
            (RoomTable.status == "occupied") | (RoomTable.occupied_beds > 0)
        )
    )
    total_revenue = await session.scalar(
        select(func.coalesce(func.sum(FinancialRecordTable.amount), 0)).where(
            FinancialRecordTable.status == "paid"
        )
    )
    pending_payments = await session.scalar(
        select(func.coalesce(func.sum(FinancialRecordTable.amount), 0)).where(
            FinancialRecordTable.status == "pending"
        )
    )

    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=5)
    expiring_documents = await session.scalar(
        select(func.count()).select_from(MigrantTable).where(
            MigrantTable.is_active == True,
            (
                ((MigrantTable.passport_expiry_date != None) & (MigrantTable.passport_expiry_date <= soon))
                | ((MigrantTable.work_patent_expiry != None) & (MigrantTable.work_patent_expiry <= soon))
            ),
        )
    )

    total_rooms_i = int(total_rooms or 0)
    occupied_rooms_i = int(occupied_rooms or 0)
    available_rooms_i = max(0, total_rooms_i - occupied_rooms_i)
    occupancy_rate = (round((occupied_rooms_i / total_rooms_i) * 1000) / 10) if total_rooms_i else 0.0
    
    return {
        "total_companies": int(total_companies or 0),
        "total_brigades": int(total_brigades or 0),
        "total_migrants": int(total_migrants or 0),
        "total_rooms": total_rooms_i,
        "available_rooms": available_rooms_i,
        "occupancy_rate": occupancy_rate,
        "total_revenue": float(total_revenue or 0),
        "pending_payments": float(pending_payments or 0),
        "expiring_documents": int(expiring_documents or 0),
    }


def _activity_row(kind: str, title: str, detail: str, at: datetime | None) -> dict:
    return {
        "kind": kind,
        "created_at": _dt_iso(at),
        "title": title,
        "detail": detail,
    }


@app.get("/dashboard/activity")
async def dashboard_activity(
    session: AsyncSession = Depends(get_db),
    user: UserTable = Depends(get_current_user),
):
    items: List[dict] = []
    per_table = 18

    cr = await session.execute(
        select(CompanyTable).where(CompanyTable.is_active == True).order_by(CompanyTable.created_at.desc()).limit(per_table)
    )
    for c in cr.scalars().all():
        items.append(_activity_row("company", c.name, "Добавлена компания", c.created_at))

    rr = await session.execute(select(RoomTable).order_by(RoomTable.created_at.desc()).limit(per_table))
    for room in rr.scalars().all():
        items.append(_activity_row("room", f"Комната {room.room_number}", "Добавлена комната", room.created_at))

    br = await session.execute(select(BrigadeTable).order_by(BrigadeTable.created_at.desc()).limit(per_table))
    for b in br.scalars().all():
        items.append(_activity_row("brigade", b.name, "Создана бригада", b.created_at))

    mr = await session.execute(select(MigrantTable).order_by(MigrantTable.created_at.desc()).limit(per_table))
    for m in mr.scalars().all():
        items.append(_activity_row("migrant", m.full_name, "Добавлен мигрант", m.created_at))

    fr = await session.execute(select(FinancialRecordTable).order_by(FinancialRecordTable.created_at.desc()).limit(per_table))
    type_ru = {"invoice": "счёт", "payment": "платёж", "debt": "задолженность"}
    for f in fr.scalars().all():
        desc = (f.description or "").strip() or "Без описания"
        title = (desc[:80] + "…") if len(desc) > 80 else desc
        amt = round(float(f.amount or 0), 2)
        items.append(
            _activity_row(
                "finance",
                title,
                f"Финансы: {type_ru.get(f.type, f.type)}, ₽{amt}",
                f.created_at,
            )
        )

    items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return items[:25]


@app.on_event("startup")
async def startup():
    await init_schema()
    async with async_session_maker() as session:
        # Обновляем роли для уже существующих пользователей в БД,
        # чтобы права сразу соответствовали текущей логике приложения.
        seed_users = [
            {
                "email": "admin@hostel.com",
                "full_name": "Администратор",
                "hashed_password": hash_password("admin123"),
                "is_admin": True,
                "is_accountant": True,
                "is_migration_officer": True,
            },
            {
                "email": "accountant@hostel.com",
                "full_name": "Бухгалтер",
                "hashed_password": hash_password("accountant123"),
                "is_admin": False,
                "is_accountant": True,
                "is_migration_officer": False,
            },
            {
                "email": "migration@hostel.com",
                "full_name": "Миграционный учёт",
                "hashed_password": hash_password("migration123"),
                "is_admin": False,
                "is_accountant": False,
                "is_migration_officer": True,
            },
            {
                "email": "user@hostel.com",
                "full_name": "Сотрудник",
                "hashed_password": hash_password("user123"),
                "is_admin": False,
                "is_accountant": False,
                "is_migration_officer": False,
            },
        ]

        updated = 0
        created = 0
        for su in seed_users:
            r = await session.execute(select(UserTable).where(UserTable.email == su["email"]))
            u = r.scalar_one_or_none()
            if u:
                u.full_name = su["full_name"]
                u.is_admin = su["is_admin"]
                u.is_accountant = su["is_accountant"]
                u.is_migration_officer = su["is_migration_officer"]
                u.is_active = True
                updated += 1
            else:
                session.add(
                    UserTable(
                        id=str(uuid.uuid4()),
                        email=su["email"],
                        full_name=su["full_name"],
                        hashed_password=su["hashed_password"],
                        is_admin=su["is_admin"],
                        is_accountant=su["is_accountant"],
                        is_migration_officer=su["is_migration_officer"],
                        is_active=True,
                    )
                )
                created += 1
        await session.commit()

        logging.info("Seed users done: created=%s updated=%s", created, updated)


@app.on_event("shutdown")
async def shutdown():
    await close_engine()


logging.basicConfig(level=logging.INFO)
