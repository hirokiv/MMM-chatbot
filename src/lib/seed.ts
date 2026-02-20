import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "mmm.db");

const CHANNELS = [
  { name: "TV", description: "Television advertising" },
  { name: "Search", description: "Paid search (Google Ads, Bing)" },
  { name: "Social", description: "Social media advertising" },
  { name: "Email", description: "Email marketing campaigns" },
  { name: "Display", description: "Display/banner advertising" },
];

const SPEND_CONFIG: Record<string, { base: number; variation: number }> = {
  TV: { base: 50000, variation: 15000 },
  Search: { base: 30000, variation: 10000 },
  Social: { base: 20000, variation: 8000 },
  Email: { base: 10000, variation: 3000 },
  Display: { base: 15000, variation: 5000 },
};

// Ground-truth coefficients for revenue
const REVENUE_INTERCEPT = 500000;
const REVENUE_COEFFICIENTS: Record<string, number> = {
  TV: 2.5,
  Search: 4.0,
  Social: 3.0,
  Email: 6.0,
  Display: 1.5,
};
const REVENUE_NOISE_STD = 20000;

// Ground-truth coefficients for conversions
const CONVERSIONS_INTERCEPT = 1000;
const CONVERSIONS_COEFFICIENTS: Record<string, number> = {
  TV: 0.005,
  Search: 0.012,
  Social: 0.008,
  Email: 0.015,
  Display: 0.003,
};
const CONVERSIONS_NOISE_STD = 50;

function gaussianRandom(mean: number, std: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

export function seedDatabase(): void {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Remove existing database
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE weekly_spend (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      week_start TEXT NOT NULL,
      spend REAL NOT NULL,
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE weekly_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      revenue REAL NOT NULL,
      conversions INTEGER NOT NULL
    );
  `);

  // Insert channels
  const insertChannel = db.prepare(
    "INSERT INTO channels (name, description) VALUES (@name, @description)"
  );
  for (const channel of CHANNELS) {
    insertChannel.run(channel);
  }

  // Get channel IDs
  const channelRows = db
    .prepare("SELECT id, name FROM channels")
    .all() as { id: number; name: string }[];
  const channelIdMap = new Map(channelRows.map((c) => [c.name, c.id]));

  // Generate 52 weeks of data (2023-01-02 to 2023-12-25)
  const insertSpend = db.prepare(
    "INSERT INTO weekly_spend (channel_id, week_start, spend) VALUES (@channelId, @weekStart, @spend)"
  );
  const insertMetrics = db.prepare(
    "INSERT INTO weekly_metrics (week_start, revenue, conversions) VALUES (@weekStart, @revenue, @conversions)"
  );

  // Use a fixed seed for reproducibility
  const startDate = new Date("2023-01-02");

  const insertAll = db.transaction(() => {
    for (let week = 0; week < 52; week++) {
      const weekDate = new Date(startDate);
      weekDate.setDate(weekDate.getDate() + week * 7);
      const weekStart = weekDate.toISOString().split("T")[0];

      const weeklySpends: Record<string, number> = {};

      // Generate spend for each channel
      for (const channel of CHANNELS) {
        const config = SPEND_CONFIG[channel.name];
        const spend = Math.max(
          1000,
          Math.round(config.base + (Math.random() - 0.5) * 2 * config.variation)
        );
        weeklySpends[channel.name] = spend;

        insertSpend.run({
          channelId: channelIdMap.get(channel.name)!,
          weekStart,
          spend,
        });
      }

      // Generate metrics from ground-truth model
      let revenue = REVENUE_INTERCEPT;
      let conversions = CONVERSIONS_INTERCEPT;

      for (const channel of CHANNELS) {
        revenue += REVENUE_COEFFICIENTS[channel.name] * weeklySpends[channel.name];
        conversions +=
          CONVERSIONS_COEFFICIENTS[channel.name] * weeklySpends[channel.name];
      }

      revenue += gaussianRandom(0, REVENUE_NOISE_STD);
      conversions += gaussianRandom(0, CONVERSIONS_NOISE_STD);

      insertMetrics.run({
        weekStart,
        revenue: Math.round(revenue * 100) / 100,
        conversions: Math.max(0, Math.round(conversions)),
      });
    }
  });

  insertAll();

  console.log("Database seeded successfully!");
  console.log(`  Channels: ${CHANNELS.length}`);
  console.log(`  Weekly spend records: ${52 * CHANNELS.length}`);
  console.log(`  Weekly metrics records: 52`);
  console.log(`  Database: ${DB_PATH}`);

  db.close();
}
