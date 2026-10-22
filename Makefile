#PAGEFIND_VERSION = 1.5.2
PAGEFIND_BIN ?= pagefind

.DEFAULT_GOAL := build
.PHONY: build preview serve serve-drafts clean

build:
	@command -v $(PAGEFIND_BIN) >/dev/null 2>&1 || \
	  { echo "pagefind not found (PAGEFIND_BIN=$(PAGEFIND_BIN))"; exit 1; }
	hugo --gc
	$(PAGEFIND_BIN) --site public

preview: build
	$(PAGEFIND_BIN) --site public --serve

serve:
	hugo server --disableFastRender

# Posts are written as drafts until the commentary goes in; `serve` hides them.
serve-drafts:
	hugo server --buildDrafts --disableFastRender

clean:
	rm -rf public/
	rm -rf resources/