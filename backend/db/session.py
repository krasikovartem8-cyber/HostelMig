from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required. Copy backend/.env.example to backend/.env")


class Base(DeclarativeBase):
    pass


# Явно задаём ssl=None, чтобы asyncpg работал в "по умолчанию" режиме.
# У тебя сервер PostgreSQL не принимает SSL upgrade, поэтому попытки SSL могут ронять соединение.
engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": False})
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_engine() -> None:
    await engine.dispose()
