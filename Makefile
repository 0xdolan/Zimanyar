# Zimanyar make targets. Later phases add data, dev, e2e, screenshots, package and release.
SHELL := bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

SHELL_SCRIPTS := $(shell git ls-files --cached --others --exclude-standard '*.sh')

.PHONY: help setup lint test coverage typecheck build format \
	biome check-dashes check-spelling check-contrast check-tokens shellcheck actionlint ruff knip licenses \
	attribution deps skills tokens logo icons marketing brand check-brand

help:
	@echo "make setup         install Node and Python dependencies, the git hooks and the UI skills"
	@echo "make skills        install the shadcn and ui-ux-pro-max skills into .claude/skills/"
	@echo "make lint          every static check (Biome, types, dashes, spelling, shell, workflows, Python, knip)"
	@echo "make test          unit tests of every package"
	@echo "make coverage      unit tests with coverage thresholds"
	@echo "make build         build every package and app"
	@echo "make format        format code with Biome"
	@echo "make licenses      check that production dependencies are GPL-3.0 compatible"
	@echo "make attribution   check authors and attribution of the commits on this branch"
	@echo "make deps          dependency report: outdated, audit (never changes anything)"
	@echo "make logo          write the logo SVG variants (assets/brand/)"
	@echo "make icons         logo + every icon size (assets/icons/), needs inkscape and ImageMagick"
	@echo "make marketing     banner, store tiles, store screenshots, ads (assets/marketing/), needs Chrome"
	@echo "make brand         icons + marketing"
	@echo "make tokens        write packages/config/tokens.css from the design tokens"
	@echo "make check-brand   render icons and marketing, and compare them with the committed images"

setup:
	pnpm install --frozen-lockfile
	uv sync --frozen
	pnpm exec lefthook install
	$(MAKE) skills

# Third-party Claude Code skills used for UI work. They are git-ignored; skills-lock.json
# records their hashes, so an upstream change shows up as a diff after this target.
SKILLS := DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 pnpm dlx skills@1.7.4 add -a claude-code -y --copy
skills:
	$(SKILLS) shadcn/ui -s shadcn
	$(SKILLS) nextlevelbuilder/ui-ux-pro-max-skill -s ui-ux-pro-max

lint: biome typecheck check-dashes check-spelling check-contrast check-tokens shellcheck actionlint ruff knip

test:
	pnpm exec turbo run test

coverage:
	pnpm exec turbo run test:coverage

typecheck:
	pnpm exec turbo run typecheck

build:
	pnpm exec turbo run build

format:
	pnpm exec biome format --write .

biome:
	pnpm exec biome check .

check-dashes:
	scripts/checks/check-dashes.sh

check-spelling:
	pnpm exec tsx scripts/checks/check-kurdish-spelling.ts

check-contrast:
	pnpm exec tsx scripts/checks/check-contrast.ts

check-tokens:
	pnpm exec tsx scripts/brand/make-tokens.ts --check

shellcheck:
	uv run --frozen shellcheck $(SHELL_SCRIPTS)

actionlint:
	uv run --frozen actionlint

ruff:
	uv run --frozen ruff check .
	uv run --frozen ruff format --check .

knip:
	pnpm exec knip

licenses:
	pnpm exec tsx scripts/checks/check-licenses.ts

attribution:
	scripts/release/verify-contributors.sh "$$(git merge-base origin/develop HEAD)..HEAD"

deps:
	-pnpm outdated --recursive
	-pnpm audit --audit-level=high
	-uv lock --upgrade --dry-run

logo:
	node scripts/brand/make-logo.mjs

icons:
	scripts/brand/render-icons.sh

marketing:
	scripts/marketing/render.sh

brand: icons marketing

tokens:
	pnpm exec tsx scripts/brand/make-tokens.ts

check-brand: brand
	scripts/brand/compare-renders.sh
