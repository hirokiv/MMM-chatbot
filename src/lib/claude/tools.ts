import type Anthropic from "@anthropic-ai/sdk";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_database",
    description:
      "Execute a GraphQL query to retrieve marketing data from the database. Use this to fetch spend data, metrics, channel information, and summaries.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "GraphQL query string",
        },
        variables: {
          type: "object",
          description: "Optional GraphQL variables",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "run_python_analysis",
    description:
      "Execute Python code in a sandboxed E2B environment. Use for custom statistical analysis, data transformations, correlation analysis, and calculations not covered by other tools. Common libraries (numpy, pandas, scipy, matplotlib) are available.",
    input_schema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "Python code to execute",
        },
        context_data: {
          type: "string",
          description:
            "Optional JSON data to make available as the 'context_data' variable in the sandbox",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "run_mmm_analysis",
    description:
      "Run a pre-built MMM analysis tool on the MCP server. Available tools: run_mmm_regression (OLS regression), decompose_contributions (channel contribution breakdown), generate_plot_data (Plotly chart data).",
    input_schema: {
      type: "object" as const,
      properties: {
        tool_name: {
          type: "string",
          enum: [
            "run_mmm_regression",
            "decompose_contributions",
            "generate_plot_data",
          ],
          description: "The MCP tool to invoke",
        },
        arguments: {
          type: "object",
          description: "Arguments for the MCP tool",
        },
      },
      required: ["tool_name", "arguments"],
    },
  },
];
