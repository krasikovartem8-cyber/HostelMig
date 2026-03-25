# ХостелМиг

Интерфейс на React (CRACO). Приложение работает **только локально**: все данные хранятся в `localStorage` браузера.

## Первый раз — зависимости

Из **корня** репозитория (нужен только **Node.js**):

```powershell
npm run setup
```

## Запуск сайта

Из **корня**:

```powershell
npm start
```

Или из папки `frontend`:

```powershell
cd frontend
npm start
```

Откроется **http://localhost:3000**

## Сборка

```powershell
npm run build
```

## Очистка `build` и кэша webpack

```powershell
npm run clean
```

## Тесты фронтенда

```powershell
cd frontend
npm test -- --watchAll=false
```

## Тестовые учётные записи

- **admin@hostel.com** / `admin123` — администратор (полный доступ).
- **accountant@hostel.com** / `accountant123` — бухгалтер.
- **migration@hostel.com** / `migration123` — миграционный учёт.
- **user@hostel.com** / `user123` — сотрудник (только просмотр).

## Backend + PostgreSQL (шаг 1 для диплома)

Если нужен режим с реальной БД PostgreSQL:

1. Создайте БД `Luba` в PostgreSQL.
2. Скопируйте `backend/.env.example` в `backend/.env` и проверьте `DATABASE_URL`.
3. Установите Python-зависимости:

```powershell
npm run setup:backend
```

4. Запустите API:

```powershell
npm run dev:api
```

Проверка API: откройте `http://127.0.0.1:8000/health` — должно вернуть `{"ok":true,...}`.
