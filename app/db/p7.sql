-- Tester eligibility: richer X signals stored at claim time (AD-13).
ALTER TABLE tester_whitelist ADD COLUMN following INTEGER;
ALTER TABLE tester_whitelist ADD COLUMN account_created TEXT;
