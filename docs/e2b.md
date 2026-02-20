# E2B Integration

## Overview

E2B (Environment to Browser) provides cloud-based sandboxed Python execution. When Claude needs to run custom Python analysis that goes beyond the pre-built MCP tools, it generates Python code and executes it via E2B.

## Use Cases

- Custom statistical analysis (correlation matrices, hypothesis tests)
- Data transformations not covered by MCP tools
- Ad-hoc calculations and aggregations
- Advanced visualizations generated in Python

## Integration Architecture

```
Claude generates Python code
    │
    ▼
/api/chat (tool handler)
    │
    ▼
src/lib/e2b/sandbox.ts
    │
    ▼
E2B Cloud API
    │
    ▼
Python Sandbox (isolated)
    │
    ▼
stdout/stderr returned to Claude
```

## API

### `runPython(code, contextData?)`

**Location**: `src/lib/e2b/sandbox.ts`

```typescript
async function runPython(
  code: string,
  contextData?: string
): Promise<{ output: string; error?: string }>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| code | string | Python code to execute |
| contextData | string | Optional JSON data injected as a variable in the sandbox |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| output | string | Combined stdout from execution |
| error | string? | stderr if any errors occurred |

## Context Data Injection

When `contextData` is provided, it's made available in the Python sandbox as a pre-loaded variable:

```python
import json

# context_data is pre-injected by the sandbox
data = json.loads(context_data)
```

This allows Claude to:
1. Query the database via GraphQL
2. Pass the results as context to Python
3. Run analysis on the data

## Sandbox Configuration

- **Runtime**: Python 3.x with common data science packages (numpy, pandas, scipy, matplotlib)
- **Timeout**: 30 seconds per execution
- **Isolation**: Each execution runs in a fresh sandbox
- **Network**: No outbound network access from sandbox

## Security

- Code runs in an isolated cloud container
- No access to the host filesystem or environment
- Sandboxes are ephemeral — destroyed after execution
- E2B API key is required (stored in `.env.local`)

## Required Environment Variable

```
E2B_API_KEY=your-e2b-api-key-here
```

Obtain an API key from [e2b.dev](https://e2b.dev).
