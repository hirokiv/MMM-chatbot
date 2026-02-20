# GraphQL API

## Overview

The GraphQL API is powered by `graphql-yoga` and mounted at `/api/graphql`. It provides structured access to the MMM data stored in SQLite.

In development, the GraphiQL playground is available at `http://localhost:3000/api/graphql`.

## Schema (SDL)

```graphql
type Channel {
  id: Int!
  name: String!
  description: String
}

type WeeklySpend {
  id: Int!
  channelId: Int!
  channelName: String!
  weekStart: String!
  spend: Float!
}

type WeeklyMetrics {
  id: Int!
  weekStart: String!
  revenue: Float!
  conversions: Int!
}

type ChannelSummary {
  channelId: Int!
  channelName: String!
  totalSpend: Float!
  avgWeeklySpend: Float!
  minSpend: Float!
  maxSpend: Float!
  weekCount: Int!
}

type WeeklyOverview {
  weekStart: String!
  revenue: Float!
  conversions: Int!
  spendByChannel: [ChannelSpend!]!
  totalSpend: Float!
}

type ChannelSpend {
  channelName: String!
  spend: Float!
}

type Query {
  channels: [Channel!]!
  weeklySpend(channelId: Int, startDate: String, endDate: String): [WeeklySpend!]!
  weeklyMetrics(startDate: String, endDate: String): [WeeklyMetrics!]!
  channelSummaries: [ChannelSummary!]!
  weeklyOverview(startDate: String, endDate: String): [WeeklyOverview!]!
}
```

## Queries

### `channels`
Returns all marketing channels.

```graphql
query {
  channels {
    id
    name
    description
  }
}
```

### `weeklySpend`
Returns weekly spend data with optional filters.

```graphql
query {
  weeklySpend(channelId: 1, startDate: "2023-01-01", endDate: "2023-06-30") {
    channelName
    weekStart
    spend
  }
}
```

### `weeklyMetrics`
Returns weekly revenue and conversions.

```graphql
query {
  weeklyMetrics(startDate: "2023-01-01", endDate: "2023-06-30") {
    weekStart
    revenue
    conversions
  }
}
```

### `channelSummaries`
Returns aggregated statistics per channel.

```graphql
query {
  channelSummaries {
    channelName
    totalSpend
    avgWeeklySpend
    minSpend
    maxSpend
  }
}
```

### `weeklyOverview`
Returns combined spend and metrics per week.

```graphql
query {
  weeklyOverview {
    weekStart
    revenue
    conversions
    totalSpend
    spendByChannel {
      channelName
      spend
    }
  }
}
```

## Resolvers

Resolvers delegate to the query helper functions in `src/lib/db.ts`:

| Query | Resolver Function |
|-------|------------------|
| `channels` | `getChannels()` |
| `weeklySpend` | `getWeeklySpend({ channelId, startDate, endDate })` |
| `weeklyMetrics` | `getWeeklyMetrics({ startDate, endDate })` |
| `channelSummaries` | `getChannelSummaries()` |
| `weeklyOverview` | `getWeeklyOverview({ startDate, endDate })` |

## Implementation

- **Server**: `graphql-yoga` integrated with Next.js App Router
- **Route**: `src/app/api/graphql/route.ts` (handles GET and POST)
- **Schema**: `src/lib/graphql/schema.ts` (type definitions)
- **Resolvers**: `src/lib/graphql/resolvers.ts` (query implementations)
