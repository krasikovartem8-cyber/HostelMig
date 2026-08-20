# ХостелМиг

Веб-приложение для учёта хостела (React + опционально FastAPI + PostgreSQL).

## Режимы

| Режим | Команда | Описание |
|--------|---------|----------|
| **Только браузер** | `npm start` | Данные в `localStorage`, сервер не нужен (`REACT_APP_USE_LOCAL_API=true` в `frontend/.env`). |
| **Полный стек** | см. ниже | FastAPI + PostgreSQL, фронт ходит в API. |

## Быстрый старт «только фронт»

Нужен **Node.js**. Из корня репозитория:

```powershell
npm run setup
npm start
```

Сайт: **http://localhost:3000**

## Полный стек: Docker (PostgreSQL) + API + фронт

1. Установите [Docker Desktop](https://www.docker.com/products/docker-desktop/) (или свой PostgreSQL на порту 5432 с БД `Luba`).

2. Один раз — зависимости и файл `backend/.env`:

```powershell
npm run setup:all
```

3. Поднимите БД:

```powershell
npm run db:up
```

Подождите несколько секунд, пока Postgres станет healthy (первый запуск дольше).

4. Запустите API и фронт **в одном терминале**:

```powershell
npm run dev:stack
```

Откроется **http://localhost:3000** с **`REACT_APP_USE_LOCAL_API=false`** (запросы на `http://127.0.0.1:8000`).

Проверка API: **http://127.0.0.1:8000/health**

Остановить БД:

```powershell
npm run db:down
```

### Если Postgres уже установлен локально

Создайте БД `Luba`, выполните `npm run setup:all` (создаст `backend/.env` при отсутствии), отредактируйте `DATABASE_URL` в `backend/.env`, затем `npm run dev:stack` (Docker можно не использовать).

## Прочие команды

Сборка фронта:

```powershell
npm run build
```

Только API (БД должна быть запущена):

```powershell
npm run dev:api
```

Фронт с реальным API из **второго** терминала (если не используете `dev:stack`):

```powershell
npm run start:api
```

Очистка `build` и кэша:

```powershell
npm run clean
```

Тесты фронтенда:

```powershell
cd frontend
npm test -- --watchAll=false
```

## Тестовые учётные записи

Одинаковые в локальном режиме и при старте API (пользователи создаются/обновляются при запуске сервера):

- **admin@hostel.com** / `admin123` — администратор.
- **accountant@hostel.com** / `accountant123` — бухгалтер.
- **migration@hostel.com** / `migration123` — миграционный учёт.
- **user@hostel.com** / `user123` — только просмотр.

## Структура env

- `frontend/.env` — `REACT_APP_USE_LOCAL_API` и при необходимости `REACT_APP_BACKEND_URL`.
- `backend/.env` — копия из `backend/.env.example` (создаётся `npm run setup:all`), главное поле `DATABASE_URL`.
