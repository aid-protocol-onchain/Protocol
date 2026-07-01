-- i18n: per-chat locale for Telegram bot copy (welcome, help, 2FA).
-- Additive, nullable projection field only (AD-2/AD-13): never authoritative,
-- resolved from Telegram from.language_code and rebuildable from source.
ALTER TABLE telegram_chats ADD COLUMN lang TEXT;
