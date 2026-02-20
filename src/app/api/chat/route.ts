import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";
import { TOOLS } from "@/lib/claude/tools";
import { SYSTEM_PROMPT } from "@/lib/claude/system-prompt";
import { runPython } from "@/lib/e2b/sandbox";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createSchema, createYoga } from "graphql-yoga";
import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import type Anthropic from "@anthropic-ai/sdk";
import path from "path";

// --- Singletons ---

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: "/api/graphql",
});

let mcpClient: Client | null = null;

async function getMcpClient(): Promise<Client> {
  if (mcpClient) return mcpClient;

  const serverPath = path.join(process.cwd(), "mcp-server", "build", "index.js");
  const transport = new StdioClientTransport({ command: "node", args: [serverPath] });

  mcpClient = new Client({ name: "mmm-chat-client", version: "1.0.0" });
  transport.onclose = () => {
    console.log("[mcp] transport closed, will reconnect on next call");
    mcpClient = null;
  };

  await mcpClient.connect(transport);
  console.log("[mcp] client connected (persistent)");
  return mcpClient;
}

// --- Tool display names ---

const TOOL_LABELS: Record<string, string> = {
  query_database: "Querying database",
  run_python_analysis: "Running Python code",
  run_mmm_analysis: "Running MMM analysis",
  run_mmm_regression: "Running regression",
  decompose_contributions: "Decomposing contributions",
  generate_plot_data: "Generating chart",
};

function toolLabel(toolName: string, toolInput: Record<string, unknown>): string {
  if (toolName === "run_mmm_analysis") {
    const sub = toolInput.tool_name as string;
    return TOOL_LABELS[sub] || `MCP: ${sub}`;
  }
  return TOOL_LABELS[toolName] || toolName;
}

// --- Tool Handlers ---

async function executeGraphQL(query: string, variables?: Record<string, unknown>): Promise<string> {
  const request = new Request("http://localhost/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const response = await yoga.fetch(request);
  const result = await response.json();
  return JSON.stringify(result);
}

async function executeMcpTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const client = await getMcpClient();
  const result = await client.callTool({ name: toolName, arguments: args });
  const textContent = result.content as Array<{ type: string; text: string }>;
  return textContent.map((c) => c.text).join("\n");
}

async function handleToolCall(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
  switch (toolName) {
    case "query_database": {
      return executeGraphQL(toolInput.query as string, toolInput.variables as Record<string, unknown> | undefined);
    }
    case "run_python_analysis": {
      const result = await runPython(toolInput.code as string, toolInput.context_data as string | undefined);
      return result.error ? `Output:\n${result.output}\n\nErrors:\n${result.error}` : result.output;
    }
    case "run_mmm_analysis": {
      return executeMcpTool(toolInput.tool_name as string, (toolInput.arguments as Record<string, unknown>) || {});
    }
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// --- Helpers ---

const MAX_TOOL_RESULT_CHARS = 8000;

function truncateResult(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  return result.slice(0, MAX_TOOL_RESULT_CHARS) + `\n\n... [truncated, ${result.length} total chars]`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Streaming POST Handler ---

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { messages } = body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      try {
        const client = getAnthropicClient();
        let claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const MAX_TOOL_ITERATIONS = 10;
        const MAX_RETRIES = 3;

        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
          send({ type: "status", content: i === 0 ? "Thinking..." : "Thinking with tool results..." });
          console.log(`[chat] iteration ${i + 1} — ${claudeMessages.length} messages`);

          // Call Claude with retry on 429
          let response: Anthropic.Message | null = null;
          for (let retry = 0; retry < MAX_RETRIES; retry++) {
            try {
              response = await client.messages.create({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 8192,
                system: SYSTEM_PROMPT,
                tools: TOOLS,
                messages: claudeMessages,
              });
              break;
            } catch (err: unknown) {
              const apiErr = err as { status?: number; headers?: { get?: (k: string) => string | null } };
              if (apiErr.status === 429 && retry < MAX_RETRIES - 1) {
                const retryAfter = parseInt(apiErr.headers?.get?.("retry-after") || "60", 10);
                const waitSec = Math.min(retryAfter, 90);
                send({ type: "status", content: `Rate limited — waiting ${waitSec}s...` });
                console.log(`[chat] 429 rate limited, retrying in ${waitSec}s`);
                await sleep(waitSec * 1000);
              } else {
                throw err;
              }
            }
          }

          if (!response) throw new Error("Failed to get response from Claude");

          console.log(`[chat] stop_reason=${response.stop_reason}, blocks=${response.content.length}`);

          const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.ContentBlock & { type: "tool_use" } => block.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) {
            const textBlocks = response.content.filter(
              (block): block is Anthropic.TextBlock => block.type === "text"
            );
            const responseText = textBlocks.map((b) => b.text).join("\n");
            console.log(`[chat] done (${responseText.length} chars)`);
            send({ type: "result", role: "assistant", content: responseText });
            controller.close();
            return;
          }

          // Handle tool calls
          claudeMessages = [...claudeMessages, { role: "assistant", content: response.content }];

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            const label = toolLabel(toolUse.name, toolUse.input as Record<string, unknown>);
            send({ type: "tool_start", tool: toolUse.name, label });
            console.log(`[chat] executing: ${label}`);

            const t0 = Date.now();
            try {
              const result = await handleToolCall(toolUse.name, toolUse.input as Record<string, unknown>);
              const truncated = truncateResult(result);
              const elapsed = Date.now() - t0;
              console.log(`[chat] ${toolUse.name} ok (${elapsed}ms, ${result.length} chars${truncated.length < result.length ? " → truncated" : ""})`);
              send({ type: "tool_done", tool: toolUse.name, label, elapsed });
              toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: truncated });
            } catch (error) {
              const elapsed = Date.now() - t0;
              console.error(`[chat] ${toolUse.name} error (${elapsed}ms):`, error);
              send({ type: "tool_error", tool: toolUse.name, label, error: error instanceof Error ? error.message : String(error) });
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                is_error: true,
              });
            }
          }

          claudeMessages = [...claudeMessages, { role: "user", content: toolResults }];
        }

        send({ type: "result", role: "assistant", content: "Reached maximum tool iterations. Please try a simpler question." });
        controller.close();
      } catch (error) {
        console.error("Chat API error:", error);
        send({ type: "error", content: `Error: ${error instanceof Error ? error.message : String(error)}` });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
