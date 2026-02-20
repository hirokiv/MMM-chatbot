# MCP Server

## Overview

The MCP (Model Context Protocol) server is a standalone Node.js process that exposes pre-built MMM analysis tools. It communicates via stdio and is spawned as a subprocess by the chat API.

## Location

```
mcp-server/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

## Tools

### 1. `run_mmm_regression`

Performs OLS (Ordinary Least Squares) regression analysis on the marketing data.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| target | string | Yes | Target variable: `"revenue"` or `"conversions"` |

**Returns:**

```json
{
  "intercept": 498532.15,
  "coefficients": {
    "TV": 2.48,
    "Search": 3.95,
    "Social": 3.02,
    "Email": 5.89,
    "Display": 1.53
  },
  "r_squared": 0.87,
  "observations": 52
}
```

**Implementation:** Reads spend and metrics data from SQLite, constructs the design matrix, and solves the normal equations (X'X)^(-1) X'y.

### 2. `decompose_contributions`

Calculates per-channel weekly revenue/conversion contributions based on regression coefficients.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| target | string | Yes | Target variable: `"revenue"` or `"conversions"` |

**Returns:**

```json
{
  "contributions": [
    {
      "weekStart": "2023-01-02",
      "base": 498532.15,
      "channels": {
        "TV": 124150.00,
        "Search": 118500.00,
        "Social": 60400.00,
        "Email": 58900.00,
        "Display": 22950.00
      },
      "total": 883432.15
    }
  ],
  "summary": {
    "TV": { "totalContribution": 6455800.00, "percentOfTotal": 14.1 },
    "Search": { "totalContribution": 6162000.00, "percentOfTotal": 13.5 }
  }
}
```

**Implementation:** Runs regression first to get coefficients, then multiplies each channel's weekly spend by its coefficient.

### 3. `generate_plot_data`

Generates Plotly.js-compatible JSON traces for various chart types.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| chart_type | string | Yes | One of: `"spend_over_time"`, `"revenue_vs_spend"`, `"channel_comparison"`, `"contribution_breakdown"` |
| target | string | No | Target variable for contribution charts (default: `"revenue"`) |

**Returns:**

Plotly-compatible JSON with `data` (traces) and `layout` objects:

```json
{
  "data": [
    {
      "x": ["2023-01-02", "2023-01-09", "..."],
      "y": [50000, 48000, "..."],
      "type": "scatter",
      "mode": "lines",
      "name": "TV"
    }
  ],
  "layout": {
    "title": "Weekly Spend by Channel",
    "xaxis": { "title": "Week" },
    "yaxis": { "title": "Spend ($)" }
  }
}
```

## Building

```bash
cd mcp-server
npm install
npx tsc
```

This produces `mcp-server/build/index.js` which is spawned by the chat API.

## Protocol

The server uses `@modelcontextprotocol/sdk` with `StdioServerTransport`:

- Receives JSON-RPC requests over stdin
- Sends JSON-RPC responses over stdout
- Supports tool listing and tool invocation
