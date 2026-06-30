-- Telegram chat linked to a tester (set when the /start deep-link token resolves).
ALTER TABLE tester_whitelist ADD COLUMN telegram_chat_id TEXT;
