# Zimanyar make targets. Phase 0 of PRD.md extends this file with setup, data,
# dev, test, lint, e2e, screenshots, build, package and release.

.PHONY: help logo icons marketing brand check-dashes

help:
	@echo "make logo         write the logo SVG variants (assets/brand/)"
	@echo "make icons        logo + every icon size (assets/icons/), needs inkscape and ImageMagick"
	@echo "make marketing    banner, store tiles, store screenshots, ads (assets/marketing/), needs Chrome"
	@echo "make brand        icons + marketing"
	@echo "make check-dashes fail on em dashes, en dashes and look-alikes"

logo:
	node scripts/brand/make-logo.mjs

icons:
	scripts/brand/render-icons.sh

marketing:
	scripts/marketing/render.sh

brand: icons marketing

check-dashes:
	@! grep -rnIP '[\x{2010}-\x{2015}\x{2212}\x{2500}-\x{257F}]' --exclude-dir=.git --exclude-dir=node_modules --exclude=LICENSE . \
		|| { echo "found dashes or box-drawing characters (see CLAUDE.md)"; exit 1; }
