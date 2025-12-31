import { useSessionStore } from "@/stores";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function SessionFilters() {
  const {
    filters,
    setFilters,
    clearFilters,
    getAllTags,
    getAllDevices,
    getFilteredSessions,
    sessions,
  } = useSessionStore();

  const allTags = getAllTags();
  const allDevices = getAllDevices();
  const filteredCount = getFilteredSessions().length;
  const totalCount = sessions.length;
  const hasActiveFilters =
    filters.searchQuery ||
    filters.deviceId ||
    filters.status ||
    filters.tags.length > 0;

  const toggleTag = (tag: string) => {
    if (filters.tags.includes(tag)) {
      setFilters({ tags: filters.tags.filter((t) => t !== tag) });
    } else {
      setFilters({ tags: [...filters.tags, tag] });
    }
  };

  return (
    <div className="space-y-3">
      {/* Search and Filter Row */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            type="text"
            placeholder="Search sessions..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Device Filter */}
        <Select
          value={filters.deviceId || ""}
          onChange={(e) =>
            setFilters({ deviceId: e.target.value || null })
          }
          className="w-40"
        >
          <option value="">All Devices</option>
          {allDevices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name || device.id.slice(0, 12)}
            </option>
          ))}
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || ""}
          onChange={(e) =>
            setFilters({
              status: (e.target.value as "active" | "completed" | "aborted") || null,
            })
          }
          className="w-32"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="aborted">Aborted</option>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear
          </Button>
        )}
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Tags:</span>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={filters.tags.includes(tag) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Results Count */}
      {hasActiveFilters && (
        <div className="text-xs text-gray-500">
          Showing {filteredCount} of {totalCount} sessions
        </div>
      )}
    </div>
  );
}
