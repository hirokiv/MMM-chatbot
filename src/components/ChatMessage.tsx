"use client";

import { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Strip plotly code blocks from display (they'll be rendered in GraphViewer)
  const displayContent = message.content.replace(
    /```plotly\n[\s\S]*?```/g,
    "[Chart displayed in viewer →]"
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{displayContent}</div>
      </div>
    </div>
  );
}
