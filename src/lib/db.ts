import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "mmm.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

// --- Types ---

export interface Channel {
  id: number;
  name: string;
  description: string | null;
}

export interface WeeklySpend {
  id: number;
  channel_id: number;
  channel_name: string;
  week_start: string;
  spend: number;
}

export interface WeeklyMetrics {
  id: number;
  week_start: string;
  revenue: number;
  conversions: number;
}

export interface ChannelSummary {
  channel_id: number;
  channel_name: string;
  total_spend: number;
  avg_weekly_spend: number;
  min_spend: number;
  max_spend: number;
  week_count: number;
}

export interface ChannelSpend {
  channel_name: string;
  spend: number;
}

export interface WeeklyOverview {
  week_start: string;
  revenue: number;
  conversions: number;
  spend_by_channel: ChannelSpend[];
  total_spend: number;
}

// --- Query Helpers ---

export function getChannels(): Channel[] {
  const db = getDb();
  return db.prepare("SELECT id, name, description FROM channels").all() as Channel[];
}

export function getWeeklySpend(filters?: {
  channelId?: number;
  startDate?: string;
  endDate?: string;
}): WeeklySpend[] {
  const db = getDb();
  let query = `
    SELECT ws.id, ws.channel_id, c.name as channel_name, ws.week_start, ws.spend
    FROM weekly_spend ws
    JOIN channels c ON ws.channel_id = c.id
    WHERE 1=1
  `;
  const params: Record<string, unknown> = {};

  if (filters?.channelId) {
    query += " AND ws.channel_id = @channelId";
    params.channelId = filters.channelId;
  }
  if (filters?.startDate) {
    query += " AND ws.week_start >= @startDate";
    params.startDate = filters.startDate;
  }
  if (filters?.endDate) {
    query += " AND ws.week_start <= @endDate";
    params.endDate = filters.endDate;
  }

  query += " ORDER BY ws.week_start, c.name";

  return db.prepare(query).all(params) as WeeklySpend[];
}

export function getWeeklyMetrics(filters?: {
  startDate?: string;
  endDate?: string;
}): WeeklyMetrics[] {
  const db = getDb();
  let query = "SELECT id, week_start, revenue, conversions FROM weekly_metrics WHERE 1=1";
  const params: Record<string, unknown> = {};

  if (filters?.startDate) {
    query += " AND week_start >= @startDate";
    params.startDate = filters.startDate;
  }
  if (filters?.endDate) {
    query += " AND week_start <= @endDate";
    params.endDate = filters.endDate;
  }

  query += " ORDER BY week_start";

  return db.prepare(query).all(params) as WeeklyMetrics[];
}

export function getChannelSummaries(): ChannelSummary[] {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT
      c.id as channel_id,
      c.name as channel_name,
      SUM(ws.spend) as total_spend,
      AVG(ws.spend) as avg_weekly_spend,
      MIN(ws.spend) as min_spend,
      MAX(ws.spend) as max_spend,
      COUNT(ws.id) as week_count
    FROM channels c
    JOIN weekly_spend ws ON c.id = ws.channel_id
    GROUP BY c.id, c.name
    ORDER BY total_spend DESC
  `
    )
    .all() as ChannelSummary[];
}

export function getWeeklyOverview(filters?: {
  startDate?: string;
  endDate?: string;
}): WeeklyOverview[] {
  const db = getDb();

  let metricsQuery = "SELECT week_start, revenue, conversions FROM weekly_metrics WHERE 1=1";
  const params: Record<string, unknown> = {};

  if (filters?.startDate) {
    metricsQuery += " AND week_start >= @startDate";
    params.startDate = filters.startDate;
  }
  if (filters?.endDate) {
    metricsQuery += " AND week_start <= @endDate";
    params.endDate = filters.endDate;
  }
  metricsQuery += " ORDER BY week_start";

  const metrics = db.prepare(metricsQuery).all(params) as WeeklyMetrics[];

  let spendQuery = `
    SELECT ws.week_start, c.name as channel_name, ws.spend
    FROM weekly_spend ws
    JOIN channels c ON ws.channel_id = c.id
    WHERE 1=1
  `;
  if (filters?.startDate) {
    spendQuery += " AND ws.week_start >= @startDate";
  }
  if (filters?.endDate) {
    spendQuery += " AND ws.week_start <= @endDate";
  }
  spendQuery += " ORDER BY ws.week_start, c.name";

  const spendRows = db.prepare(spendQuery).all(params) as {
    week_start: string;
    channel_name: string;
    spend: number;
  }[];

  const spendByWeek = new Map<string, ChannelSpend[]>();
  for (const row of spendRows) {
    if (!spendByWeek.has(row.week_start)) {
      spendByWeek.set(row.week_start, []);
    }
    spendByWeek.get(row.week_start)!.push({
      channel_name: row.channel_name,
      spend: row.spend,
    });
  }

  return metrics.map((m) => {
    const channelSpends = spendByWeek.get(m.week_start) || [];
    const totalSpend = channelSpends.reduce((sum, cs) => sum + cs.spend, 0);
    return {
      week_start: m.week_start,
      revenue: m.revenue,
      conversions: m.conversions,
      spend_by_channel: channelSpends,
      total_spend: totalSpend,
    };
  });
}
