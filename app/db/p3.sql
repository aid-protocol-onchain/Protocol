-- P3 slice: requester intake + diligence + approval pipeline (Model A, ADR-004).
-- Requests are submitted publicly, the core team does off-chain diligence on the
-- requester's public identity (no KYC), then approves -> a campaign is created.

CREATE TABLE IF NOT EXISTS requests (
  id              TEXT PRIMARY KEY,
  org_name        TEXT NOT NULL,
  contact_handle  TEXT NOT NULL,            -- public Twitter / identity used for diligence
  location        TEXT NOT NULL,
  disaster        TEXT NOT NULL,
  summary         TEXT NOT NULL,
  goal_usd        INTEGER NOT NULL,
  evidence_url    TEXT DEFAULT '',          -- public proof of org / on-the-ground presence
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  diligence_notes TEXT NOT NULL DEFAULT '',
  reviewer        TEXT,
  campaign_id     TEXT,                      -- set when approved
  created_at      TEXT NOT NULL,
  decided_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at);

-- Campaigns gain provenance + on-chain escrow map (one escrow per chain, shared id).
-- D1 lacks "ADD COLUMN IF NOT EXISTS"; these are idempotent-by-convention (run once).
ALTER TABLE campaigns ADD COLUMN request_id TEXT;
ALTER TABLE campaigns ADD COLUMN chains TEXT NOT NULL DEFAULT '{}';   -- JSON: { chain: escrowAddress }
ALTER TABLE campaigns ADD COLUMN chain_status TEXT NOT NULL DEFAULT 'live'; -- live | publishing | pending
