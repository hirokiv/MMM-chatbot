# Chatbot Integration

## Overview

The chatbot uses Anthropic's Claude with tool use to orchestrate MMM analysis. Claude receives user questions, determines which tools to use, executes them, and synthesizes the results into a conversational response.

## Tool-Use Flow

```
User Message
    │
    ▼
Claude (with tools)
    │
    ├── tool_use: query_database
    │       → Execute GraphQL query
    │       → Return data to Claude
    │
    ├── tool_use: run_mmm_analysis
    │       → Call MCP server tool
    │       → Return analysis results to Claude
    │
    ├── tool_use: run_python_analysis
    │       → Execute Python in E2B sandbox
    │       → Return output to Claude
    │
    └── end_turn: Final response
            (may include ```plotly {...}``` blocks)
```

## System Prompt

The system prompt instructs Claude on:

1. **Role**: MMM analysis assistant for marketing data
2. **Available data**: 52 weeks of spend data across 5 channels (TV, Search, Social, Email, Display) with revenue and conversion metrics
3. **Tool usage guidelines**: When to use each tool
4. **Chart output format**: How to embed Plotly charts using fenced code blocks
5. **Analysis best practices**: Statistical interpretation guidance

## Tool Definitions

### `query_database`

Execute a GraphQL query against the marketing database.

```typescript
{
  name: "query_database",
  description: "Execute a GraphQL query to retrieve marketing data",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "GraphQL query string"
      },
      variables: {
        type: "object",
        description: "Optional GraphQL variables"
      }
    },
    required: ["query"]
  }
}
```

### `run_python_analysis`

Execute Python code in a sandboxed environment.

```typescript
{
  name: "run_python_analysis",
  description: "Execute Python code in a sandboxed E2B environment",
  input_schema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to execute"
      },
      context_data: {
        type: "string",
        description: "Optional JSON data to make available in the sandbox"
      }
    },
    required: ["code"]
  }
}
```

### `run_mmm_analysis`

Call a pre-built MMM analysis tool on the MCP server.

```typescript
{
  name: "run_mmm_analysis",
  description: "Run a pre-built MMM analysis tool",
  input_schema: {
    type: "object",
    properties: {
      tool_name: {
        type: "string",
        enum: ["run_mmm_regression", "decompose_contributions", "generate_plot_data"],
        description: "The MCP tool to invoke"
      },
      arguments: {
        type: "object",
        description: "Arguments for the MCP tool"
      }
    },
    required: ["tool_name", "arguments"]
  }
}
```

## Claude Configuration

- **Model**: `claude-sonnet-4-5-20250929` (or latest available)
- **Max tokens**: 4096
- **Temperature**: 0 (deterministic for analysis)
- **Tool choice**: `auto` (Claude decides when to use tools)

## Response Format

Claude's final response may contain:

1. **Text**: Natural language explanation of findings
2. **Plotly blocks**: Fenced code blocks with `plotly` language tag containing JSON chart specifications

```markdown
Here's the spend breakdown:

​```plotly
{
  "data": [...],
  "layout": {...}
}
​```
```

The frontend parses these blocks and renders them as interactive Plotly charts.
