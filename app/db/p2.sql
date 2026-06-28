-- P2 slice: news table + extra donations so the leaderboard is meaningful.

DROP TABLE IF EXISTS news;
CREATE TABLE news (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('update','news')),
  campaign_id TEXT,
  source      TEXT NOT NULL,
  published_at TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'ti-news',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO news (id, title, summary, category, campaign_id, source, published_at, icon, sort_order) VALUES
 ('nw-1','Rescue convoys reach cut-off villages near Caracas','Fuel funded on Aid Protocol enabled three convoys to reach mountain villages isolated by the quake.','update','ve-quake-2026','Fundación Rescate Caracas','2 days ago','ti-truck',1),
 ('nw-2','Typhoon Mawar makes landfall in Luzon','Shelter and clean water are the most urgent needs across the affected provinces.','news','ph-typhoon-2026','Wire report','1 day ago','ti-wind',2),
 ('nw-3','Morocco floods: 690 families resupplied','Atlas Mutual Aid distributed water and food parcels, each batch verified on-chain.','update','ma-flood-2026','Atlas Mutual Aid','3 days ago','ti-droplet',3),
 ('nw-4','7.1 earthquake strikes northern Venezuela','Thousands displaced as a powerful quake hits the Caracas region; relief efforts mobilize.','news',NULL,'Wire report','4 days ago','ti-alert-triangle',4),
 ('nw-5','How proof-gated escrow changes disaster giving','Every tranche of funding is released only against AI-verified proof of spending.','news',NULL,'Aid Protocol','5 days ago','ti-link',5);

INSERT INTO donations (id, campaign_id, donor_label, is_anonymous, chain, amount, amount_usd, tx_url) VALUES
 ('dn-9','ve-quake-2026','@chainphil',0,'ethereum','3 ETH',10500,'#'),
 ('dn-10','ma-flood-2026','@chainphil',0,'base','2000 USDC',2000,'#'),
 ('dn-11','ph-typhoon-2026','@givewell_dao',0,'base','5000 USDC',5000,'#'),
 ('dn-12','ve-quake-2026','@givewell_dao',0,'ethereum','2 ETH',7000,'#'),
 ('dn-13','ve-quake-2026','@noderunner',0,'solana','40 SOL',5920,'#'),
 ('dn-14','ve-quake-2026','@aurora',0,'solana','15 SOL',2220,'#'),
 ('dn-15','ph-typhoon-2026','@aurora',0,'base','1000 USDC',1000,'#'),
 ('dn-16','ve-quake-2026','@maria_r',0,'base','500 USDC',500,'#'),
 ('dn-17','ma-flood-2026','@maria_r',0,'solana','2 SOL',296,'#'),
 ('dn-18','ph-typhoon-2026','@dana',0,'solana','8 SOL',1184,'#'),
 ('dn-19','ve-quake-2026','@sam_gives',0,'solana','3 SOL',444,'#');
