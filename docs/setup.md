# Setup Guide

## Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** (included with Node.js)
- **Python** 3.x (for MkDocs, optional)
- **Anthropic API Key** — [console.anthropic.com](https://console.anthropic.com)
- **E2B API Key** — [e2b.dev](https://e2b.dev)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd MMM-MCP-chatbot-engineering
```

### 2. Install dependencies

```bash
# Main application
npm install

# MCP server
cd mcp-server
npm install
cd ..
```

### 3. Configure environment

Create `.env.local` in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
E2B_API_KEY=e2b_...
```

### 4. Build the MCP server

```bash
cd mcp-server
npx tsc
cd ..
```

This creates `mcp-server/build/index.js`.

### 5. Seed the database

```bash
npx tsx scripts/seed-db.ts
```

This creates `data/mmm.db` with 52 weeks of synthetic marketing data.

### 6. Start the development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Verification

### Check the database

After seeding, the database should contain:
- 5 channels
- 260 weekly spend records (52 weeks × 5 channels)
- 52 weekly metrics records

### Check the GraphQL API

Visit `http://localhost:3000/api/graphql` to open GraphiQL. Try:

```graphql
{
  channels {
    id
    name
  }
  channelSummaries {
    channelName
    totalSpend
    avgWeeklySpend
  }
}
```

### Test the chatbot

Open `http://localhost:3000` and try these prompts:

1. "Show me spend by channel over time"
2. "Run a regression on revenue"
3. "Calculate the correlation matrix in Python"

## Design Documentation

To view the design docs locally:

```bash
pip install mkdocs mkdocs-material
mkdocs serve
```

Then visit `http://localhost:8000`.

## Project Structure

```
MMM-MCP-chatbot-engineering/
├── mkdocs.yml              # MkDocs configuration
├── docs/                   # Design specifications
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/chat/      # Chat endpoint
│   │   ├── api/graphql/   # GraphQL endpoint
│   │   └── page.tsx       # Main page
│   ├── components/        # React components
│   ├── lib/               # Backend logic
│   │   ├── db.ts          # Database layer
│   │   ├── graphql/       # GraphQL schema & resolvers
│   │   ├── claude/        # Claude integration
│   │   └── e2b/           # E2B sandbox
│   └── types/             # TypeScript types
├── mcp-server/            # MCP analysis server
├── scripts/               # Database seeding
└── data/                  # SQLite database
```

## Troubleshooting

### "Cannot find module 'better-sqlite3'"
Run `npm install` in the project root.

### MCP server not found
Ensure you've built the MCP server: `cd mcp-server && npx tsc`

### E2B timeout
Check your E2B API key is valid. E2B sandboxes have a 30-second timeout.

### GraphiQL not loading
Ensure the dev server is running (`npm run dev`) and visit `/api/graphql`.
