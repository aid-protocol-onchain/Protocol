INSERT INTO campaigns (id, title, location, disaster, requester_name, requester_handle, requester_tier, first_release_pct, raised_usd, goal_usd, donor_count, status, icon) VALUES
 ('ve-quake-2026', 'Venezuela earthquake: emergency relief', 'Caracas, Venezuela', 'earthquake', 'Fundación Rescate Caracas', '@rescateccs', 'L2', 40, 284910, 500000, 3142, 'active', 'ti-mountain'),
 ('ph-typhoon-2026', 'Typhoon Mawar: shelter and water', 'Luzon, Philippines', 'typhoon', 'Luzon Relief Network', '@luzonrelief', 'L2', 40, 142300, 300000, 1880, 'active', 'ti-wind'),
 ('ma-flood-2026', 'Flash floods: family resupply', 'Marrakesh, Morocco', 'flood', 'Atlas Mutual Aid', '@atlasaid', 'L1', 15, 38600, 120000, 690, 'active', 'ti-droplet');

INSERT INTO proofs (id, campaign_id, title, tranche, spent_usd, media_count, ai_verified, icon, created_at) VALUES
 ('pf-1', 've-quake-2026', 'Fuel for rescue convoy', 2, 48000, 4, 1, 'ti-gas-station', '2 days ago'),
 ('pf-2', 've-quake-2026', 'Medical supplies and water', 1, 114000, 6, 1, 'ti-medical-cross', '5 days ago'),
 ('pf-3', 'ph-typhoon-2026', 'Tarpaulins and shelter kits', 1, 56000, 5, 1, 'ti-tent', '1 day ago'),
 ('pf-4', 'ma-flood-2026', 'Clean water and food parcels', 1, 18000, 3, 1, 'ti-bottle', '3 days ago');

INSERT INTO donations (id, campaign_id, donor_label, is_anonymous, chain, amount, amount_usd, tx_url) VALUES
 ('dn-1', 've-quake-2026', '@maria_r', 0, 'solana', '250 USDC', 250, '#'),
 ('dn-2', 've-quake-2026', 'Anonymous', 1, 'base', '1.2 ETH', 4200, '#'),
 ('dn-3', 've-quake-2026', '@josel', 0, 'solana', '5 SOL', 740, '#'),
 ('dn-4', 've-quake-2026', '@crypto_cares', 0, 'ethereum', '0.5 ETH', 1750, '#'),
 ('dn-5', 've-quake-2026', 'Anonymous', 1, 'solana', '100 USDC', 100, '#'),
 ('dn-6', 'ph-typhoon-2026', '@dana', 0, 'base', '500 USDC', 500, '#'),
 ('dn-7', 'ph-typhoon-2026', 'Anonymous', 1, 'solana', '12 SOL', 1776, '#'),
 ('dn-8', 'ma-flood-2026', '@sam_gives', 0, 'base', '200 USDC', 200, '#');
