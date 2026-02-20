"use client";

import { useState } from "react";
import { PlotlyData } from "@/types";
import ChatPanel from "./ChatPanel";
import GraphViewer from "./GraphViewer";

export default function AppShell() {
  const [plotlyData, setPlotlyData] = useState<PlotlyData | null>(null);

  return (
    <div className="flex h-screen">
      {/* Chat Panel — 60% */}
      <div className="flex w-[60%] flex-col border-r border-gray-200">
        <ChatPanel onPlotlyData={setPlotlyData} />
      </div>

      {/* Graph Viewer — 40% */}
      <div className="w-[40%]">
        <GraphViewer data={plotlyData} />
      </div>
    </div>
  );
}
