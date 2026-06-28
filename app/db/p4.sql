-- P4 slice: auto-ingested news feeds (ReliefWeb + Google News) per campaign topic.
-- Items are auto-published with source attribution; the core team can hide any item.

ALTER TABLE news ADD COLUMN link TEXT;
ALTER TABLE news ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE news ADD COLUMN auto INTEGER NOT NULL DEFAULT 0;

-- Dedupe ingested items by source link (SQLite treats multiple NULLs as distinct,
-- so the seeded rows without a link are unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_link ON news(link);
