from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .session import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UserTable(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_accountant: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_migration_officer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class CompanyTable(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    inn: Mapped[str] = mapped_column(String(64), nullable=False)
    kpp: Mapped[str | None] = mapped_column(String(64), nullable=True)
    legal_address: Mapped[str] = mapped_column(Text, nullable=False)
    contact_person: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(64), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    tariff_per_day: Mapped[float] = mapped_column(Float, nullable=False)
    contract_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    contract_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RoomTable(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    room_number: Mapped[str] = mapped_column(String(32), nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    bed_count: Mapped[int] = mapped_column(Integer, nullable=False)
    occupied_beds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="available", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class BrigadeTable(Base):
    __tablename__ = "brigades"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    room_id: Mapped[str | None] = mapped_column(String, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    check_in_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    check_out_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class MigrantTable(Base):
    __tablename__ = "migrants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    brigade_id: Mapped[str] = mapped_column(String, ForeignKey("brigades.id", ondelete="CASCADE"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    passport_number: Mapped[str] = mapped_column(String(128), nullable=False)
    passport_issued_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    passport_expiry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    migration_card_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    migration_card_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    work_patent_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    work_patent_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class FinancialRecordTable(Base):
    __tablename__ = "finances"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
