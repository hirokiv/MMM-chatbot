"use client";

import dynamic from "next/dynamic";
import { PlotlyData } from "@/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface GraphViewerProps {
  data: PlotlyData | null;
}

export default function GraphViewer({ data }: GraphViewerProps) {
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-gray-400">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
          <p className="mt-2 text-sm font-medium">No chart data</p>
          <p className="mt-1 text-xs">
            Charts will appear here when generated
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white p-4">
      <Plot
        data={data.data as Plotly.Data[]}
        layout={{
          ...data.layout,
          autosize: true,
          margin: { t: 40, r: 20, b: 40, l: 60 },
        }}
        config={{ responsive: true, displayModeBar: true }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
