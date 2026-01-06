.PHONY: build clean

build:
	@rm -f codeforces-qol.xpi
	@zip -r codeforces-qol.xpi . -x "*.git*" -x "*.xpi" -x "AGENTS.md" -x "Makefile"
	@echo "✅ Created codeforces-qol.xpi"
	@ls -lh codeforces-qol.xpi

clean:
	@rm -f codeforces-qol.xpi
	@echo "🧹 Cleaned"
