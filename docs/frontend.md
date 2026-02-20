# Frontend Architecture

## Overview

The frontend is a single-page Next.js application with a two-panel layout: a chat interface on the left and a graph viewer on the right.

## Component Tree

```
page.tsx
└── AppShell
    ├── ChatPanel (60% width)
    │   ├── ChatMessage[] (scrollable list)
    │   │   ├── User message bubble
    │   │   ├── Assistant message bubble
    │   │   └── Tool result message (collapsible)
    │   └── ChatInput (fixed bottom)
    └── GraphViewer (40% width)
        └── Plot (react-plotly.js, dynamic import)
```

## Components

### `AppShell.tsx`

Top-level layout component providing the two-panel split.

- Left panel (60%): Chat interface
- Right panel (40%): Graph viewer
- Responsive: stacks vertically on mobile
- Manages shared state: `plotlyData` passed from ChatPanel to GraphViewer

### `ChatPanel.tsx`

The main chat interface managing conversation state.

**State:**
- `messages: ChatMessage[]` — Conversation history
- `isLoading: boolean` — Whether a request is in progress

**Behavior:**
- Sends messages to `POST /api/chat`
- Parses assistant responses for ` ```plotly {...}``` ` blocks
- Extracts Plotly data and passes to parent via callback
- Auto-scrolls to latest message

### `ChatMessage.tsx`

Renders individual chat messages with role-based styling.

| Role | Style |
|------|-------|
| user | Right-aligned, blue background |
| assistant | Left-aligned, gray background, markdown rendered |
| tool | Collapsible, monospace, muted styling |

**Markdown Rendering:** Assistant messages support basic markdown formatting.

### `ChatInput.tsx`

Text input component for composing messages.

- Textarea with auto-resize
- Submit on Enter (Shift+Enter for newline)
- Disabled while loading
- Send button

### `GraphViewer.tsx`

Renders Plotly.js charts from JSON specifications.

- Uses `react-plotly.js` with dynamic import (no SSR)
- Receives `PlotlyData` prop from AppShell
- Shows placeholder when no chart data is available
- Responsive sizing

## State Management

Simple React state — no external state management library needed.

```typescript
// In AppShell
const [plotlyData, setPlotlyData] = useState<PlotlyData | null>(null);

// ChatPanel extracts plotly blocks and calls:
onPlotlyData(parsedData);

// GraphViewer receives:
<GraphViewer data={plotlyData} />
```

## Types

### `ChatMessage`

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
```

### `PlotlyData`

```typescript
interface PlotlyData {
  data: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
}
```

## Styling

- **Tailwind CSS**: Utility-first styling
- **Color scheme**: Dark sidebar/header, light chat area
- **Typography**: System font stack, monospace for code/tool results
