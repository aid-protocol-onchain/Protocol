-- Telegram bot + 2FA tables.

CREATE TABLE IF NOT EXISTS telegram_chats (
  chat_id      TEXT PRIMARY KEY,
  username     TEXT,
  first_name   TEXT,
  last_name    TEXT,
  linked_x_id  TEXT,
  linked_email TEXT,
  link_token   TEXT,
  created_at   TEXT NOT NULL,
  last_seen    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tg_username ON telegram_chats(username);

CREATE TABLE IF NOT EXISTS twofa_codes (
  id         TEXT PRIMARY KEY,
  purpose    TEXT NOT NULL,
  channel    TEXT NOT NULL,
  target     TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_twofa_target ON twofa_codes(target, purpose);
