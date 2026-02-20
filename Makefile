.PHONY: dev docs seed build-mcp install install-python setup clean

# Run all services via honcho (Next.js + MkDocs)
dev:
	uv run honcho start

# Run Next.js dev server only
web:
	npm run dev

# Run MkDocs dev server only
docs:
	uv run mkdocs serve -a 0.0.0.0:8000

# Seed the SQLite database
seed:
	npx tsx scripts/seed-db.ts

# Build the MCP server
build-mcp:
	cd mcp-server && npx tsc

# Install Node.js dependencies
install:
	npm install
	cd mcp-server && npm install

# Install Python tools (honcho, mkdocs) via uv
install-python:
	uv tool install honcho
	uv tool install mkdocs --with mkdocs-material

# Full setup: install deps, build MCP server, seed DB
setup: install install-python build-mcp seed
	@echo "Setup complete. Run 'make dev' to start."

# Clean generated artifacts
clean:
	rm -rf .next data/mmm.db mcp-server/build
