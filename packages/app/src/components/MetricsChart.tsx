import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PerformanceMetrics } from "../types";
import { formatTime } from "../utils";

interface MetricsChartProps {
  data: PerformanceMetrics[];
  height?: number;
}

export function MetricsChart({ data, height = 300 }: MetricsChartProps) {
  const chartData = data.map((m) => ({
    time: formatTime(m.timestamp),
    timestamp: m.timestamp,
    heapUsed: m.js_heap_used_size ? m.js_heap_used_size / (1024 * 1024) : null,
    heapTotal: m.js_heap_total_size ? m.js_heap_total_size / (1024 * 1024) : null,
    domNodes: m.dom_nodes,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Memory Usage</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9ca3af"
            fontSize={10}
            tickLine={false}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={10}
            tickLine={false}
            tickFormatter={(value) => `${value.toFixed(0)} MB`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(value: number, name: string) => {
              if (name === "heapUsed" || name === "heapTotal") {
                return [`${value.toFixed(2)} MB`, name === "heapUsed" ? "Heap Used" : "Heap Total"];
              }
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
            formatter={(value) => {
              if (value === "heapUsed") return "Heap Used";
              if (value === "heapTotal") return "Heap Total";
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="heapUsed"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="heapTotal"
            stroke="#6366f1"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DomNodesChartProps {
  data: PerformanceMetrics[];
  height?: number;
}

export function DomNodesChart({ data, height = 200 }: DomNodesChartProps) {
  const chartData = data.map((m) => ({
    time: formatTime(m.timestamp),
    domNodes: m.dom_nodes,
    layoutCount: m.layout_count,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">DOM & Layout</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9ca3af"
            fontSize={10}
            tickLine={false}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={10}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line
            type="monotone"
            dataKey="domNodes"
            name="DOM Nodes"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="layoutCount"
            name="Layout Count"
            stroke="#f59e0b"
            strokeWidth={1}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MiniChartProps {
  data: number[];
  maxValue: number;
  color: string;
  width?: number;
  height?: number;
}

export function MiniChart({
  data,
  maxValue,
  color,
  width = 200,
  height = 40,
}: MiniChartProps) {
  if (data.length < 2) return null;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - (value / (maxValue || 1)) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="opacity-60 mt-2">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}
