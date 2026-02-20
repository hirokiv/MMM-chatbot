# API Routes

## Overview

The application exposes two API routes via Next.js App Router:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/graphql` | GET, POST | GraphQL endpoint with GraphiQL |
| `/api/chat` | POST | Chat endpoint for Claude interactions |

## POST `/api/chat`

### Request

```typescript
{
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>
}
```

### Response

```typescript
{
  role: 'assistant';
  content: string;  // May contain ```plotly {...}``` blocks
}
```

### Internal Flow

1. Receive conversation history from frontend
2. Initialize Claude client with system prompt and tools
3. Enter tool-use loop:
   - Send messages to Claude
   - If Claude returns `tool_use` blocks:
     - Execute each tool (`query_database`, `run_python_analysis`, `run_mmm_analysis`)
     - Append tool results to message history
     - Send back to Claude
   - If Claude returns `end_turn`:
     - Return the final assistant message
4. Tool execution details:
   - `query_database`: Executes GraphQL query against `/api/graphql` internally
   - `run_python_analysis`: Calls E2B sandbox
   - `run_mmm_analysis`: Spawns MCP server subprocess, calls tool via MCP protocol

### Error Handling

- Returns `500` with error message if Claude API fails
- Tool execution errors are returned as tool results (Claude can retry or explain)
- MCP server errors are caught and returned as tool error results

## GET/POST `/api/graphql`

### GraphQL Endpoint

Powered by `graphql-yoga`, supports:

- **GET**: Serves GraphiQL playground UI
- **POST**: Executes GraphQL queries

### Request (POST)

```json
{
  "query": "{ channels { id name } }",
  "variables": {}
}
```

### Response

```json
{
  "data": {
    "channels": [
      { "id": 1, "name": "TV" },
      { "id": 2, "name": "Search" }
    ]
  }
}
```

### Available Queries

See [GraphQL API](graphql.md) for the full schema and query documentation.

## MCP Client Integration

The chat route manages the MCP client lifecycle:

1. Spawns `mcp-server/build/index.js` via `StdioClientTransport`
2. Connects the MCP client
3. Calls tools as requested by Claude
4. Closes the connection after the request completes
