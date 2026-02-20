import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "data", "mmm.db");

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// --- OLS Regression Helpers ---

function matTranspose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const result: number[][] = Array.from({ length: cols }, () =>
    new Array(rows).fill(0)
  );
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = m[i][j];
    }
  }
  return result;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0].length;
  const colsB = b[0].length;
  const result: number[][] = Array.from({ length: rowsA }, () =>
    new Array(colsB).fill(0)
  );
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function matInverse(m: number[][]): number[][] {
  const n = m.length;
  // Augment with identity
  const aug: number[][] = m.map((row, i) => {
    const identity = new Array(n).fill(0);
    identity[i] = 1;
    return [...row, ...identity];
  });

  // Gauss-Jordan elimination
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

interface SpendRow {
  week_start: string;
  channel_name: string;
  spend: number;
}

interface MetricsRow {
  week_start: string;
  revenue: number;
  conversions: number;
}

interface ChannelRow {
  name: string;
}

function runRegression(target: "revenue" | "conversions") {
  const db = getDb();

  const channels = (
    db.prepare("SELECT name FROM channels ORDER BY id").all() as ChannelRow[]
  ).map((c) => c.name);

  const spendRows = db
    .prepare(
      `SELECT ws.week_start, c.name as channel_name, ws.spend
       FROM weekly_spend ws
       JOIN channels c ON ws.channel_id = c.id
       ORDER BY ws.week_start, c.id`
    )
    .all() as SpendRow[];

  const metrics = db
    .prepare("SELECT week_start, revenue, conversions FROM weekly_metrics ORDER BY week_start")
    .all() as MetricsRow[];

  db.close();

  // Build design matrix X (with intercept) and target vector y
  const weeks = [...new Set(spendRows.map((r) => r.week_start))].sort();
  const n = weeks.length;
  const p = channels.length + 1; // +1 for intercept

  const X: number[][] = [];
  const y: number[][] = [];

  const metricsMap = new Map(metrics.map((m) => [m.week_start, m]));
  const spendMap = new Map<string, Map<string, number>>();
  for (const row of spendRows) {
    if (!spendMap.has(row.week_start)) {
      spendMap.set(row.week_start, new Map());
    }
    spendMap.get(row.week_start)!.set(row.channel_name, row.spend);
  }

  for (const week of weeks) {
    const weekSpend = spendMap.get(week)!;
    const row = [1]; // intercept
    for (const ch of channels) {
      row.push(weekSpend.get(ch) || 0);
    }
    X.push(row);

    const m = metricsMap.get(week)!;
    y.push([target === "revenue" ? m.revenue : m.conversions]);
  }

  // OLS: beta = (X'X)^-1 X'y
  const Xt = matTranspose(X);
  const XtX = matMul(Xt, X);
  const XtX_inv = matInverse(XtX);
  const Xty = matMul(Xt, y);
  const beta = matMul(XtX_inv, Xty);

  const intercept = beta[0][0];
  const coefficients: Record<string, number> = {};
  for (let i = 0; i < channels.length; i++) {
    coefficients[channels[i]] = Math.round(beta[i + 1][0] * 1000) / 1000;
  }

  // R-squared
  const yMean = y.reduce((s, v) => s + v[0], 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = X[i].reduce((s, x, j) => s + x * beta[j][0], 0);
    ssRes += (y[i][0] - yPred) ** 2;
    ssTot += (y[i][0] - yMean) ** 2;
  }
  const rSquared = Math.round((1 - ssRes / ssTot) * 10000) / 10000;

  return {
    intercept: Math.round(intercept * 100) / 100,
    coefficients,
    r_squared: rSquared,
    observations: n,
  };
}

// --- MCP Server Setup ---

const server = new McpServer({
  name: "mmm-analysis",
  version: "1.0.0",
});

// Tool 1: run_mmm_regression
server.tool(
  "run_mmm_regression",
  "Perform OLS regression analysis on marketing data. Returns coefficients showing the impact of each channel on the target metric.",
  {
    target: z
      .enum(["revenue", "conversions"])
      .describe("Target variable to regress on"),
  },
  async ({ target }) => {
    try {
      const result = runRegression(target);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error running regression: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 2: decompose_contributions
server.tool(
  "decompose_contributions",
  "Calculate per-channel weekly contributions based on regression coefficients. Shows how much each channel contributed to the target metric each week.",
  {
    target: z
      .enum(["revenue", "conversions"])
      .describe("Target variable to decompose"),
  },
  async ({ target }) => {
    try {
      const regression = runRegression(target);
      const db = getDb();

      const channels = (
        db.prepare("SELECT name FROM channels ORDER BY id").all() as ChannelRow[]
      ).map((c) => c.name);

      const spendRows = db
        .prepare(
          `SELECT ws.week_start, c.name as channel_name, ws.spend
           FROM weekly_spend ws
           JOIN channels c ON ws.channel_id = c.id
           ORDER BY ws.week_start, c.id`
        )
        .all() as SpendRow[];

      db.close();

      const weeks = [...new Set(spendRows.map((r) => r.week_start))].sort();
      const spendMap = new Map<string, Map<string, number>>();
      for (const row of spendRows) {
        if (!spendMap.has(row.week_start)) {
          spendMap.set(row.week_start, new Map());
        }
        spendMap.get(row.week_start)!.set(row.channel_name, row.spend);
      }

      const contributions = weeks.map((week) => {
        const weekSpend = spendMap.get(week)!;
        const channelContributions: Record<string, number> = {};
        let total = regression.intercept;

        for (const ch of channels) {
          const contrib =
            regression.coefficients[ch] * (weekSpend.get(ch) || 0);
          channelContributions[ch] = Math.round(contrib * 100) / 100;
          total += contrib;
        }

        return {
          weekStart: week,
          base: regression.intercept,
          channels: channelContributions,
          total: Math.round(total * 100) / 100,
        };
      });

      // Summary
      const summary: Record<
        string,
        { totalContribution: number; percentOfTotal: number }
      > = {};
      const grandTotal = contributions.reduce((s, c) => s + c.total, 0);

      for (const ch of channels) {
        const totalContrib = contributions.reduce(
          (s, c) => s + c.channels[ch],
          0
        );
        summary[ch] = {
          totalContribution: Math.round(totalContrib * 100) / 100,
          percentOfTotal:
            Math.round((totalContrib / grandTotal) * 100 * 10) / 10,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ contributions, summary }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error decomposing contributions: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 3: generate_plot_data
server.tool(
  "generate_plot_data",
  "Generate Plotly.js-compatible JSON traces for various MMM chart types.",
  {
    chart_type: z
      .enum([
        "spend_over_time",
        "revenue_vs_spend",
        "channel_comparison",
        "contribution_breakdown",
      ])
      .describe("Type of chart to generate"),
    target: z
      .enum(["revenue", "conversions"])
      .optional()
      .describe("Target variable for contribution charts (default: revenue)"),
  },
  async ({ chart_type, target }) => {
    try {
      const db = getDb();

      const channels = (
        db.prepare("SELECT name FROM channels ORDER BY id").all() as ChannelRow[]
      ).map((c) => c.name);

      const spendRows = db
        .prepare(
          `SELECT ws.week_start, c.name as channel_name, ws.spend
           FROM weekly_spend ws
           JOIN channels c ON ws.channel_id = c.id
           ORDER BY ws.week_start, c.id`
        )
        .all() as SpendRow[];

      const metrics = db
        .prepare(
          "SELECT week_start, revenue, conversions FROM weekly_metrics ORDER BY week_start"
        )
        .all() as MetricsRow[];

      db.close();

      const weeks = [...new Set(spendRows.map((r) => r.week_start))].sort();
      const spendByChannel = new Map<string, number[]>();
      for (const ch of channels) {
        spendByChannel.set(ch, []);
      }
      for (const row of spendRows) {
        spendByChannel.get(row.channel_name)!.push(row.spend);
      }

      let plotData: { data: unknown[]; layout: Record<string, unknown> };

      switch (chart_type) {
        case "spend_over_time": {
          plotData = {
            data: channels.map((ch) => ({
              x: weeks,
              y: spendByChannel.get(ch),
              type: "scatter",
              mode: "lines",
              name: ch,
            })),
            layout: {
              title: "Weekly Spend by Channel",
              xaxis: { title: "Week" },
              yaxis: { title: "Spend ($)" },
            },
          };
          break;
        }

        case "revenue_vs_spend": {
          const totalSpendPerWeek = weeks.map((_, i) =>
            channels.reduce(
              (s, ch) => s + (spendByChannel.get(ch)?.[i] || 0),
              0
            )
          );

          plotData = {
            data: [
              {
                x: totalSpendPerWeek,
                y: metrics.map((m) => m.revenue),
                type: "scatter",
                mode: "markers",
                name: "Revenue vs Total Spend",
                marker: { size: 8 },
              },
            ],
            layout: {
              title: "Revenue vs Total Spend",
              xaxis: { title: "Total Weekly Spend ($)" },
              yaxis: { title: "Revenue ($)" },
            },
          };
          break;
        }

        case "channel_comparison": {
          const channelTotals = channels.map((ch) =>
            (spendByChannel.get(ch) || []).reduce((s, v) => s + v, 0)
          );

          plotData = {
            data: [
              {
                x: channels,
                y: channelTotals,
                type: "bar",
                marker: {
                  color: [
                    "#636EFA",
                    "#EF553B",
                    "#00CC96",
                    "#AB63FA",
                    "#FFA15A",
                  ],
                },
              },
            ],
            layout: {
              title: "Total Spend by Channel",
              xaxis: { title: "Channel" },
              yaxis: { title: "Total Spend ($)" },
            },
          };
          break;
        }

        case "contribution_breakdown": {
          const t = target || "revenue";
          const regression = runRegression(t);

          const spendMap = new Map<string, Map<string, number>>();
          for (const row of spendRows) {
            if (!spendMap.has(row.week_start)) {
              spendMap.set(row.week_start, new Map());
            }
            spendMap.get(row.week_start)!.set(row.channel_name, row.spend);
          }

          const traces = channels.map((ch) => ({
            x: weeks,
            y: weeks.map((w) => {
              const spend = spendMap.get(w)?.get(ch) || 0;
              return Math.round(regression.coefficients[ch] * spend * 100) / 100;
            }),
            type: "bar",
            name: ch,
          }));

          plotData = {
            data: traces,
            layout: {
              title: `${t.charAt(0).toUpperCase() + t.slice(1)} Contribution by Channel`,
              barmode: "stack",
              xaxis: { title: "Week" },
              yaxis: { title: `${t.charAt(0).toUpperCase() + t.slice(1)} Contribution ($)` },
            },
          };
          break;
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(plotData, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error generating plot: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
