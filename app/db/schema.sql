-- Aid Protocol dev: canonical projection (thin slice).
-- On-chain is the source of truth (AD-2); these tables are a rebuildable read model.

DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS proofs;
DROP TABLE IF EXISTS campaigns;

CREATE TABLE campaigns (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  location          TEXT NOT NULL,
  disaster          TEXT NOT NULL,
  requester_name    TEXT NOT NULL,
  requester_handle  TEXT NOT NULL,
  requester_tier    TEXT NOT NULL CHECK (requester_tier IN ('L1','L2')),
  first_release_pct INTEGER NOT NULL,
  raised_usd        INTEGER NOT NULL DEFAULT 0,
  goal_usd          INTEGER NOT NULL,
  donor_count       INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active',
  icon              TEXT NOT NULL DEFAULT 'ti-mountain'
);

CREATE TABLE proofs (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id),
  title        TEXT NOT NULL,
  tranche      INTEGER NOT NULL,
  spent_usd    INTEGER NOT NULL,
  media_count  INTEGER NOT NULL DEFAULT 0,
  ai_verified  INTEGER NOT NULL DEFAULT 0,
  icon         TEXT NOT NULL DEFAULT 'ti-photo',
  created_at   TEXT NOT NULL
);

CREATE TABLE donations (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  donor_label   TEXT NOT NULL,
  is_anonymous  INTEGER NOT NULL DEFAULT 0,
  chain         TEXT NOT NULL CHECK (chain IN ('solana','base','ethereum')),
  amount        TEXT NOT NULL,
  amount_usd    INTEGER NOT NULL,
  tx_url        TEXT NOT NULL DEFAULT '#'
);

CREATE INDEX idx_proofs_campaign ON proofs(campaign_id);
CREATE INDEX idx_donations_campaign ON donations(campaign_id);
