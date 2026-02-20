export const typeDefs = /* GraphQL */ `
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

  type ChannelSpend {
    channelName: String!
    spend: Float!
  }

  type WeeklyOverview {
    weekStart: String!
    revenue: Float!
    conversions: Int!
    spendByChannel: [ChannelSpend!]!
    totalSpend: Float!
  }

  type Query {
    channels: [Channel!]!
    weeklySpend(channelId: Int, startDate: String, endDate: String): [WeeklySpend!]!
    weeklyMetrics(startDate: String, endDate: String): [WeeklyMetrics!]!
    channelSummaries: [ChannelSummary!]!
    weeklyOverview(startDate: String, endDate: String): [WeeklyOverview!]!
  }
`;
