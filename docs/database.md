# Database Design

## Overview

The application uses SQLite via `better-sqlite3` for storing marketing data. The database file is located at `data/mmm.db` and is created/seeded via a script.

## Schema

### `channels` Table

Stores the marketing channel definitions.

```sql
CREATE TABLE channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);
```

### `weekly_spend` Table

Stores weekly advertising spend per channel.

```sql
CREATE TABLE weekly_spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,  -- ISO date string (YYYY-MM-DD)
  spend REAL NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);
```

### `weekly_metrics` Table

Stores weekly business performance metrics.

```sql
CREATE TABLE weekly_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,  -- ISO date string (YYYY-MM-DD)
  revenue REAL NOT NULL,
  conversions INTEGER NOT NULL
);
```

## Seed Data

### Channels

| ID | Name | Description |
|----|------|-------------|
| 1 | TV | Television advertising |
| 2 | Search | Paid search (Google Ads, Bing) |
| 3 | Social | Social media advertising |
| 4 | Email | Email marketing campaigns |
| 5 | Display | Display/banner advertising |

### Time Range

- 52 weeks: `2023-01-02` through `2023-12-25`
- Weekly granularity (Monday start)

### Spend Generation

Each channel has a base spend with random variation:

| Channel | Base Weekly Spend | Variation |
|---------|------------------|-----------|
| TV | $50,000 | ±$15,000 |
| Search | $30,000 | ±$10,000 |
| Social | $20,000 | ±$8,000 |
| Email | $10,000 | ±$3,000 |
| Display | $15,000 | ±$5,000 |

### Ground-Truth Coefficients

The metrics are generated from known linear relationships (with noise), enabling verification of regression results:

**Revenue model:**

```
revenue = 500,000
  + 2.5 × TV_spend
  + 4.0 × Search_spend
  + 3.0 × Social_spend
  + 6.0 × Email_spend
  + 1.5 × Display_spend
  + noise(σ = 20,000)
```

**Conversions model:**

```
conversions = 1,000
  + 0.005 × TV_spend
  + 0.012 × Search_spend
  + 0.008 × Social_spend
  + 0.015 × Email_spend
  + 0.003 × Display_spend
  + noise(σ = 50)
```

## Query Helpers

The `src/lib/db.ts` module exports these functions:

| Function | Description |
|----------|-------------|
| `getChannels()` | Returns all channels |
| `getWeeklySpend(filters?)` | Returns weekly spend, optionally filtered by channel/date range |
| `getWeeklyMetrics(filters?)` | Returns weekly metrics, optionally filtered by date range |
| `getChannelSummaries()` | Returns aggregated spend stats per channel |
| `getWeeklyOverview(filters?)` | Returns joined spend + metrics per week |

## Seeding

Run the seed script to create and populate the database:

```bash
npx tsx scripts/seed-db.ts
```

This will create `data/mmm.db` with all tables and 52 weeks of synthetic data.
