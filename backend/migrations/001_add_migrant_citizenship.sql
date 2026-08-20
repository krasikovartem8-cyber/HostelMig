-- Выполнить вручную в pgAdmin (один раз), если таблица migrants уже была без этого поля.
ALTER TABLE migrants ADD COLUMN IF NOT EXISTS citizenship VARCHAR(128);
