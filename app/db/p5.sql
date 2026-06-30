-- P5 slice: tester whitelist (10 spots, paid $10 to help test on mainnet).
-- Testers sign in with X (which proves a real, verified account), give an email,
-- and an optional RapidAPI follower/age check adds a quality signal.

CREATE TABLE IF NOT EXISTS tester_whitelist (
  id          TEXT PRIMARY KEY,
  x_id        TEXT UNIQUE NOT NULL,
  handle      TEXT NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT,
  avatar      TEXT,
  followers   INTEGER,
  created_at  TEXT NOT NULL
);
