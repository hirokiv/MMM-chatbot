# MMM-MCP Chatbot Engineering

A Marketing Mix Model (MMM) analysis platform powered by an AI chatbot with tool-use capabilities.

## Overview

This platform enables marketers to analyze advertising spend effectiveness through natural language conversation. Users can ask questions like "Show me spend by channel over time" or "Run a regression on revenue" and receive data-driven insights with interactive visualizations.

## Key Features

- **Conversational Analytics** — Ask questions in natural language; Claude orchestrates the analysis
- **Pre-built MMM Analysis** — OLS regression, contribution decomposition, and visualization via MCP tools
- **Custom Code Execution** — Run arbitrary Python analysis in sandboxed E2B environments
- **Interactive Charts** — Plotly.js visualizations rendered inline alongside chat responses
- **GraphQL Data Layer** — Structured access to marketing spend and performance data

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 Next.js App                      │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │   ChatPanel       │  │   GraphViewer       │  │
│  │   (conversation)  │  │   (Plotly.js)       │  │
│  └────────┬─────────┘  └──────────▲──────────┘  │
│           │    plotly JSON blocks  │              │
│           ▼                        │              │
│  ┌────────────────────────────────────────────┐  │
│  │         POST /api/chat                     │  │
│  │         (Claude tool-use loop)             │  │
│  └───┬──────────┬──────────────┬──────────────┘  │
│      │          │              │                  │
│      ▼          ▼              ▼                  │
│  GraphQL     E2B Cloud     MCP Client            │
│  /api/graphql  Sandbox     (stdio spawn)         │
│      │                        │                  │
│      ▼                        ▼                  │
│  SQLite DB              MCP Server               │
│  (data/mmm.db)          (3 analysis tools)       │
└─────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, Tailwind CSS, Plotly.js |
| LLM | Anthropic Claude (tool use) |
| Data | SQLite via better-sqlite3 |
| API | GraphQL (graphql-yoga) |
| Analysis | MCP Server (Model Context Protocol) |
| Code Execution | E2B Cloud Sandboxes |

## Documentation

- [クイックスタート](quickstart.md) — Makefile で即座に起動
- [Architecture](architecture.md) — System design and data flow
- [Database](database.md) — SQLite schema and seed data
- [GraphQL API](graphql.md) — Schema and queries
- [MCP Server](mcp-server.md) — Analysis tools
- [Chatbot](chatbot.md) — Claude integration and tool use
- [E2B Integration](e2b.md) — Python code execution
- [Frontend](frontend.md) — Component architecture
- [API Routes](api.md) — Backend endpoints
- [サンプルシナリオ](scenarios.md) — MCP / GraphQL / E2B の呼び出し例
- [Setup Guide](setup.md) — Getting started
