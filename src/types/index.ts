export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface PlotlyData {
  data: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
}
