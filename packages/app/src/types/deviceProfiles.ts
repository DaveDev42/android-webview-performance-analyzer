/**
 * Device memory profiles for simulating different device capabilities
 */

export type TrimMemoryLevel =
  | "RunningModerate"
  | "RunningLow"
  | "RunningCritical"
  | "Moderate"
  | "Complete";

export interface DeviceProfile {
  id: string;
  name: string;
  ramMb: number;
  trimLevel: TrimMemoryLevel;
  description: string;
  category: "ultra-low" | "low" | "mid" | "standard" | "high";
}

/**
 * Predefined device profiles for memory simulation
 */
export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: "ultra-low",
    name: "Ultra Low (512MB)",
    ramMb: 512,
    trimLevel: "Complete",
    description: "Old budget devices, extreme memory pressure",
    category: "ultra-low",
  },
  {
    id: "low",
    name: "Low (1GB)",
    ramMb: 1024,
    trimLevel: "RunningCritical",
    description: "Entry-level Android devices",
    category: "low",
  },
  {
    id: "mid",
    name: "Mid (2GB)",
    ramMb: 2048,
    trimLevel: "RunningLow",
    description: "iPhone 8, Galaxy A series, mid-range devices",
    category: "mid",
  },
  {
    id: "standard",
    name: "Standard (4GB)",
    ramMb: 4096,
    trimLevel: "RunningModerate",
    description: "Most modern smartphones",
    category: "standard",
  },
  {
    id: "high",
    name: "High (6GB+)",
    ramMb: 6144,
    trimLevel: "Moderate",
    description: "Flagship devices, minimal pressure",
    category: "high",
  },
];

/**
 * Get the appropriate trim level based on current device RAM and target profile
 */
export function calculatePressureLevel(
  deviceRamMb: number,
  targetProfile: DeviceProfile
): TrimMemoryLevel {
  const ratio = targetProfile.ramMb / deviceRamMb;

  if (ratio <= 0.125) return "Complete";
  if (ratio <= 0.25) return "RunningCritical";
  if (ratio <= 0.5) return "RunningLow";
  if (ratio <= 0.75) return "RunningModerate";
  return "Moderate";
}

/**
 * Format memory size in human-readable format
 */
export function formatMemory(kb: number): string {
  if (kb >= 1024 * 1024) {
    return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  }
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(0)} MB`;
  }
  return `${kb} KB`;
}
