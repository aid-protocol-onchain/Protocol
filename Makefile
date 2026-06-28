# Aid Protocol developer tasks. Contracts build and test only in Docker (AD-10).

FOUNDRY_IMG = ghcr.io/foundry-rs/foundry:stable
EVM_RUN = docker run --rm -v "$(CURDIR)":/work -w /work/chain/evm $(FOUNDRY_IMG) sh -c

.PHONY: evm-build evm-test evm-fmt solana-build solana-test app-dev app-deploy

evm-build:
	$(EVM_RUN) "forge build"

evm-test:
	$(EVM_RUN) "forge install foundry-rs/forge-std --no-git 2>/dev/null || true; forge test -vvv"

evm-fmt:
	$(EVM_RUN) "forge fmt"

solana-build:
	docker compose -f chain/docker/docker-compose.yml run --rm anchor "anchor build"

solana-test:
	docker compose -f chain/docker/docker-compose.yml run --rm anchor "anchor test"

app-dev:
	cd app && pnpm dev

app-deploy:
	cd app && pnpm build && npx wrangler deploy
