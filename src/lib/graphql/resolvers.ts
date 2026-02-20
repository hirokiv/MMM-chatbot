import {
  getChannels,
  getWeeklySpend,
  getWeeklyMetrics,
  getChannelSummaries,
  getWeeklyOverview,
} from "@/lib/db";

export const resolvers = {
  Query: {
    channels: () => getChannels(),

    weeklySpend: (
      _: unknown,
      args: { channelId?: number; startDate?: string; endDate?: string }
    ) =>
      getWeeklySpend({
        channelId: args.channelId ?? undefined,
        startDate: args.startDate ?? undefined,
        endDate: args.endDate ?? undefined,
      }),

    weeklyMetrics: (
      _: unknown,
      args: { startDate?: string; endDate?: string }
    ) =>
      getWeeklyMetrics({
        startDate: args.startDate ?? undefined,
        endDate: args.endDate ?? undefined,
      }),

    channelSummaries: () => getChannelSummaries(),

    weeklyOverview: (
      _: unknown,
      args: { startDate?: string; endDate?: string }
    ) =>
      getWeeklyOverview({
        startDate: args.startDate ?? undefined,
        endDate: args.endDate ?? undefined,
      }),
  },

  WeeklySpend: {
    channelId: (parent: { channel_id: number }) => parent.channel_id,
    channelName: (parent: { channel_name: string }) => parent.channel_name,
    weekStart: (parent: { week_start: string }) => parent.week_start,
  },

  WeeklyMetrics: {
    weekStart: (parent: { week_start: string }) => parent.week_start,
  },

  ChannelSummary: {
    channelId: (parent: { channel_id: number }) => parent.channel_id,
    channelName: (parent: { channel_name: string }) => parent.channel_name,
    totalSpend: (parent: { total_spend: number }) => parent.total_spend,
    avgWeeklySpend: (parent: { avg_weekly_spend: number }) =>
      parent.avg_weekly_spend,
    minSpend: (parent: { min_spend: number }) => parent.min_spend,
    maxSpend: (parent: { max_spend: number }) => parent.max_spend,
    weekCount: (parent: { week_count: number }) => parent.week_count,
  },

  WeeklyOverview: {
    weekStart: (parent: { week_start: string }) => parent.week_start,
    spendByChannel: (parent: {
      spend_by_channel: { channel_name: string; spend: number }[];
    }) => parent.spend_by_channel,
    totalSpend: (parent: { total_spend: number }) => parent.total_spend,
  },

  ChannelSpend: {
    channelName: (parent: { channel_name: string }) => parent.channel_name,
  },
};
