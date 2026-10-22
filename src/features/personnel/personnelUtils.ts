/**
 * Utility functions for Personnel module.
 */

/**
 * Normalizes and extracts the base aircraft model/platform name.
 * In aviation, a Type Rating is issued strictly for an aircraft type/platform (e.g. "Bell UH-1H Helicopter",
 * "Magnus Fusion 212"), never for individual physical airframes or tail/registration numbers (like "(NA 021)").
 */
export const extractAircraftPlatformName = (
  raw?:
    | string
    | {
        name?: string | null;
        model?: string | null;
        asset_type?: { name?: string | null } | null;
      }
    | null,
): string => {
  if (!raw) return "";

  let candidate = "";

  if (typeof raw === "string") {
    candidate = raw;
  } else {
    // If asset_type.name is present and represents the platform type, use it
    if (raw.asset_type?.name) {
      candidate = raw.asset_type.name;
    } else if (raw.name) {
      candidate = raw.name;
    } else if (raw.model) {
      candidate = raw.model;
    }
  }

  // Remove parenthetical tail/registration numbers: e.g. " (NA 021)", " (NA 011)"
  let cleaned = candidate.replace(/\s*\([^)]*\)/g, "").trim();

  // Remove tail numbers with dash, arrow or colon separators: e.g. " - NA 021", " -> NA 021"
  cleaned = cleaned.replace(/\s*[-→>:]\s*NA\s*\d+/gi, "").trim();

  const lower = cleaned.toLowerCase();

  // Standardize common Nigerian Army Aviation platforms
  if (
    lower.includes("bell") ||
    lower.includes("uh-1h") ||
    lower.includes("uh1h") ||
    (lower.includes("iroquois") && (lower.includes("helicopter") || lower.includes("bell")))
  ) {
    return "Bell UH-1H Helicopter";
  }
  if (
    lower.includes("magnus") ||
    (lower.includes("fusion") && lower.includes("212"))
  ) {
    return "Magnus Fusion 212";
  }
  if (lower.includes("md") && lower.includes("530")) {
    return "MD 530F Cayuse Warrior";
  }
  if (lower.includes("diamond") || lower.includes("da42") || lower.includes("da 42")) {
    return "Diamond DA42 Twin Star";
  }
  if (lower.includes("c130") || lower.includes("c-130") || lower.includes("hercules")) {
    return "Lockheed C-130 Hercules";
  }
  if (lower.includes("super tucano") || lower.includes("a-29") || lower.includes("a29")) {
    return "A-29 Super Tucano";
  }

  return cleaned;
};
