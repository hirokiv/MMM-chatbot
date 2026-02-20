"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage as ChatMessageType, PlotlyData } from "@/types";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

interface ChatPanelProps {
  onPlotlyData: (data: PlotlyData) => void;
}

interface ToolStatus {
  tool: string;
  label: string;
  state: "running" | "done" | "error";
  elapsed?: number;
  error?: string;
}

function extractPlotlyData(content: string): PlotlyData | null {
  const match = content.match(/```plotly\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as PlotlyData;
  } catch {
    return null;
  }
}

export default function ChatPanel({ onPlotlyData }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, toolStatuses]);

  const sendMessage = async (content: string) => {
    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setStatusText("Connecting...");
    setToolStatuses([]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case "status":
                setStatusText(event.content);
                break;
              case "tool_start":
                setToolStatuses((prev) => [
                  ...prev,
                  { tool: event.tool, label: event.label, state: "running" },
                ]);
                setStatusText("");
                break;
              case "tool_done":
                setToolStatuses((prev) =>
                  prev.map((t) =>
                    t.tool === event.tool && t.state === "running"
                      ? { ...t, state: "done", elapsed: event.elapsed }
                      : t
                  )
                );
                break;
              case "tool_error":
                setToolStatuses((prev) =>
                  prev.map((t) =>
                    t.tool === event.tool && t.state === "running"
                      ? { ...t, state: "error", error: event.error }
                      : t
                  )
                );
                break;
              case "result": {
                const assistantMessage: ChatMessageType = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: event.content,
                };
                setMessages([...newMessages, assistantMessage]);
                const plotly = extractPlotlyData(event.content);
                if (plotly) onPlotlyData(plotly);
                break;
              }
              case "error": {
                const errMsg: ChatMessageType = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: event.content,
                };
                setMessages([...newMessages, errMsg]);
                break;
              }
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (error) {
      const errorMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to send message"}`,
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setStatusText("");
      setToolStatuses([]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-800">MMM Analysis Chat</h2>
        <p className="text-xs text-gray-500">Ask questions about your marketing data</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg font-medium">Welcome!</p>
              <p className="mt-1 text-sm">
                Try asking: &ldquo;Show me spend by channel over time&rdquo;
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Progress indicator */}
        {isLoading && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600 min-w-[200px]">
              {statusText && (
                <div className="animate-pulse mb-1">{statusText}</div>
              )}
              {toolStatuses.length > 0 && (
                <div className="space-y-1">
                  {toolStatuses.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {t.state === "running" && (
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                      )}
                      {t.state === "done" && (
                        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                      )}
                      {t.state === "error" && (
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                      )}
                      <span className={t.state === "running" ? "text-gray-700" : "text-gray-500"}>
                        {t.label}
                      </span>
                      {t.state === "done" && t.elapsed && (
                        <span className="text-gray-400">{(t.elapsed / 1000).toFixed(1)}s</span>
                      )}
                      {t.state === "error" && (
                        <span className="text-red-400">failed</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {toolStatuses.length === 0 && !statusText && (
                <span className="animate-pulse">Analyzing...</span>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
