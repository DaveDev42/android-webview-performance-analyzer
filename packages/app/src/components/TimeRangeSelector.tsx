import { useMetricsStore, type TimeRange } from "@/stores/metricsStore";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "all", label: "All" },
];

interface TimeRangeSelectorProps {
  className?: string;
}

export function TimeRangeSelector({ className }: TimeRangeSelectorProps) {
  const {
    timeRange,
    setTimeRange,
    brushRange,
    clearBrushRange,
    metricsHistory,
    getVisibleHistory,
  } = useMetricsStore();

  const visibleData = getVisibleHistory();
  const hasData = metricsHistory.length > 0;
  const isZoomed = brushRange !== null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Time Range Buttons */}
      <div className="flex rounded overflow-hidden border border-gray-700">
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className={cn(
              "px-3 py-1 text-xs font-medium transition-colors",
              timeRange === value && !isZoomed
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Reset Zoom Button */}
      {isZoomed && (
        <Button
          variant="secondary"
          size="sm"
          onClick={clearBrushRange}
          className="gap-1"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Reset Zoom
        </Button>
      )}

      {/* Data Point Count */}
      {hasData && (
        <span className="text-xs text-gray-500">
          {visibleData.length} / {metricsHistory.length} points
        </span>
      )}
    </div>
  );
}
