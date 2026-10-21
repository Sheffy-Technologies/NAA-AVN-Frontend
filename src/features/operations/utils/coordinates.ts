import { forward as toMgrs, toPoint as mgrsToPoint } from "mgrs";

export type CoordinateFormat = "latlon" | "mgrs" | "dms";

export type LatLonPoint = {
  latitude: number;
  longitude: number;
};

export type DmsParts = {
  degrees: number;
  minutes: number;
  seconds: number;
  direction: "N" | "S" | "E" | "W";
};

/**
 * Validates if latitude and longitude are within standard geographical boundaries.
 */
export const isValidLat = (lat: number): boolean =>
  Number.isFinite(lat) && lat >= -90 && lat <= 90;

export const isValidLng = (lng: number): boolean =>
  Number.isFinite(lng) && lng >= -180 && lng <= 180;

export const isValidCoordinate = (lat: number, lng: number): boolean =>
  isValidLat(lat) && isValidLng(lng);

/**
 * Formats a decimal coordinate number into a fixed 6-decimal string.
 */
export const formatDecimal = (val?: number | string | null): string => {
  if (val === null || val === undefined || val === "") return "";
  const num = Number(val);
  return Number.isFinite(num) ? num.toFixed(6) : "";
};

/**
 * Converts a decimal degree value into Degrees, Minutes, Seconds (DMS) string.
 * Example: 11.8369 -> 11° 50' 12.8" N
 */
export const decimalToDms = (
  val?: number | string | null,
  isLatitude = true
): string => {
  if (val === null || val === undefined || val === "") return "";
  const num = Number(val);
  if (!Number.isFinite(num)) return "";

  const absolute = Math.abs(num);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = (minutesNotTruncated - minutes) * 60;

  let direction = "";
  if (isLatitude) {
    direction = num >= 0 ? "N" : "S";
  } else {
    direction = num >= 0 ? "E" : "W";
  }

  const degPadded = isLatitude
    ? String(degrees).padStart(2, "0")
    : String(degrees).padStart(3, "0");
  const minPadded = String(minutes).padStart(2, "0");
  const secPadded = seconds.toFixed(1).padStart(4, "0");

  return `${degPadded}° ${minPadded}' ${secPadded}" ${direction}`;
};

/**
 * Parses a DMS string into decimal degrees.
 * Supports flexible formats:
 * - 11° 50' 12.8" N
 * - 11 50 12.8 N
 * - 11:50:12.8N
 * - 11d 50m 12.8s N
 * - Plain decimal numbers (e.g. 11.8369)
 */
export const dmsToDecimal = (input: string): number | null => {
  if (!input || !input.trim()) return null;
  const trimmed = input.trim();

  // If already a plain decimal number
  const directNum = Number(trimmed);
  if (!Number.isNaN(directNum) && Number.isFinite(directNum)) {
    return Number(directNum.toFixed(6));
  }

  // Regex to extract degrees, minutes, seconds and optional direction (N/S/E/W)
  // Handles: 11° 50' 12.8" N, 11:50:12.8N, 11 50 12.8 N, 11d 50m 12.8s N, etc.
  const dmsRegex =
    /^\s*([NSEWnsew])?\s*([+-]?\d+(?:\.\d+)?)\s*(?:[°d\s:]|\b)\s*(\d+(?:\.\d+)?)?\s*(?:['′m\s:]|\b)\s*(\d+(?:\.\d+)?)?\s*(?:["″s\s]|\b)\s*([NSEWnsew])?\s*$/;
  const match = trimmed.match(dmsRegex);

  if (!match) return null;

  const prefixDir = match[1] ? match[1].toUpperCase() : null;
  const deg = Number(match[2]);
  const min = match[3] ? Number(match[3]) : 0;
  const sec = match[4] ? Number(match[4]) : 0;
  const suffixDir = match[5] ? match[5].toUpperCase() : null;
  const dir = suffixDir || prefixDir;

  if (Number.isNaN(deg) || Number.isNaN(min) || Number.isNaN(sec)) return null;

  let decimal = Math.abs(deg) + min / 60 + sec / 3600;

  if (deg < 0 || dir === "S" || dir === "W") {
    decimal = -decimal;
  }

  return Number.isFinite(decimal) ? Number(decimal.toFixed(6)) : null;
};

/**
 * Converts Latitude and Longitude to MGRS.
 * Default precision: 5 (10-figure grid, 1-meter precision).
 */
export const latLonToMgrs = (
  lat?: number | string | null,
  lng?: number | string | null,
  precision = 5
): string => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return "";
  }
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!isValidCoordinate(latitude, longitude)) {
    return "";
  }

  try {
    return toMgrs([longitude, latitude], precision);
  } catch {
    return "";
  }
};

/**
 * Formats an MGRS string with standard military readability spacing.
 * Example: 33PVP1676608542 -> 33P VP 16766 08542
 */
export const formatMgrsSpaced = (mgrsString: string): string => {
  const clean = mgrsString.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 5) return clean;

  // Pattern: Zone (1-2 digits + 1 band letter), Grid Square (2 letters), Easting/Northing digits
  const match = clean.match(/^(\d{1,2}[A-Z])([A-Z]{2})(\d+)$/);
  if (!match) return clean;

  const [, gzd, gridSquare, digits] = match;
  const half = Math.floor(digits.length / 2);
  const easting = digits.slice(0, half);
  const northing = digits.slice(half);

  return `${gzd} ${gridSquare} ${easting} ${northing}`.trim();
};

/**
 * Inspects MGRS precision and returns standard military classification.
 */
export type MgrsPrecisionInfo = {
  digits: number;
  label: string;
  precisionMeters: number;
  isValid: boolean;
};

export const getMgrsPrecision = (mgrsString: string): MgrsPrecisionInfo => {
  const clean = mgrsString.replace(/\s+/g, "").toUpperCase();
  const match = clean.match(/^(\d{1,2}[A-Z])([A-Z]{2})(\d*)$/);
  if (!match) {
    return { digits: 0, label: "Invalid Grid", precisionMeters: 0, isValid: false };
  }

  const digits = match[3].length;
  if (digits % 2 !== 0) {
    return { digits, label: "Odd Digits (Incomplete)", precisionMeters: 0, isValid: false };
  }

  const half = digits / 2;
  switch (half) {
    case 5:
      return { digits, label: "10-Figure Grid (1m precision)", precisionMeters: 1, isValid: true };
    case 4:
      return { digits, label: "8-Figure Grid (10m precision)", precisionMeters: 10, isValid: true };
    case 3:
      return { digits, label: "6-Figure Grid (100m precision)", precisionMeters: 100, isValid: true };
    case 2:
      return { digits, label: "4-Figure Grid (1km precision)", precisionMeters: 1000, isValid: true };
    case 1:
      return { digits, label: "2-Figure Grid (10km precision)", precisionMeters: 10000, isValid: true };
    case 0:
      return { digits, label: "100km Grid Square", precisionMeters: 100000, isValid: true };
    default:
      return { digits, label: `${digits}-Figure Grid`, precisionMeters: 1, isValid: true };
  }
};

/**
 * Converts MGRS string into WGS84 Latitude and Longitude decimal point.
 * Supports variable precision (4-figure, 6-figure, 8-figure, 10-figure).
 */
export const mgrsToLatLon = (input: string): LatLonPoint | null => {
  if (!input || !input.trim()) return null;
  const normalized = input.replace(/\s+/g, "").toUpperCase();

  try {
    const [longitude, latitude] = mgrsToPoint(normalized);
    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }
    return {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    };
  } catch {
    return null;
  }
};

/**
 * Provides UTM Zone number and operational theater boundary awareness for Nigeria.
 * Nigeria spans UTM Zones 31N, 32N, and 33N.
 */
export type UtmZoneInfo = {
  zoneNumber: number;
  theaterName: string;
  inNigeriaBounds: boolean;
};

export const getUtmZoneInfo = (
  lat?: number | string | null,
  lng?: number | string | null
): UtmZoneInfo | null => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!isValidCoordinate(latitude, longitude)) return null;

  // Standard UTM Zone: 1 + floor((lng + 180) / 6)
  const zoneNumber = Math.floor((longitude + 180) / 6) + 1;

  // Nigeria bounds: Lat 4°N to 14°N, Lon 2.5°E to 15.0°E
  const inNigeriaBounds =
    latitude >= 4.0 && latitude <= 14.0 && longitude >= 2.5 && longitude <= 15.0;

  let theaterName = "International / Outside Nigeria";
  if (zoneNumber === 31) {
    theaterName = "UTM Zone 31N • Western Theater (Lagos / Ibadan / Sokoto West)";
  } else if (zoneNumber === 32) {
    theaterName = "UTM Zone 32N • Central Theater / HQ NA Avn (Abuja / Kaduna / Kano / Jos)";
  } else if (zoneNumber === 33) {
    theaterName = "UTM Zone 33N • North East / OPHK Theater (Maiduguri / Yola / Lake Chad)";
  } else if (inNigeriaBounds) {
    theaterName = `UTM Zone ${zoneNumber}N • Nigeria Theater`;
  }

  return {
    zoneNumber,
    theaterName,
    inNigeriaBounds,
  };
};

/**
 * Intelligent parser that accepts any freeform coordinate string:
 * - MGRS (e.g. "33PVP1676608542" or "32N PH 1234 5678")
 * - Combined DMS pair (e.g. "11°50'12\"N, 013°09'07\"E")
 * - Combined Decimal pair (e.g. "11.8369, 13.1520")
 */
export const parseAnyCoordinate = (
  input: string
): {
  latitude: number;
  longitude: number;
  format: CoordinateFormat;
  mgrs: string;
  dmsLat: string;
  dmsLng: string;
} | null => {
  if (!input || !input.trim()) return null;
  const clean = input.trim();

  // 1. Try MGRS (with or without spaces)
  const mgrsCandidate = clean.replace(/\s+/g, "").toUpperCase();
  if (/^\d{1,2}[A-Z][A-Z]{2}\d{2,10}$/.test(mgrsCandidate)) {
    const pt = mgrsToLatLon(mgrsCandidate);
    if (pt) {
      return {
        latitude: pt.latitude,
        longitude: pt.longitude,
        format: "mgrs",
        mgrs: formatMgrsSpaced(mgrsCandidate),
        dmsLat: decimalToDms(pt.latitude, true),
        dmsLng: decimalToDms(pt.longitude, false),
      };
    }
  }

  // 2. Try comma or slash separated Lat/Lon or DMS pair
  const splitMatch = clean.split(/[,;/]|\s{2,}|\b(?=[NSEWnsew]\s*[,;]?\s*)/);
  if (splitMatch.length >= 2) {
    const part1 = splitMatch[0].trim();
    const part2 = splitMatch.slice(1).join(" ").trim();
    const dec1 = dmsToDecimal(part1);
    const dec2 = dmsToDecimal(part2);

    if (dec1 !== null && dec2 !== null && isValidCoordinate(dec1, dec2)) {
      return {
        latitude: dec1,
        longitude: dec2,
        format: clean.includes("°") || clean.includes("'") ? "dms" : "latlon",
        mgrs: latLonToMgrs(dec1, dec2),
        dmsLat: decimalToDms(dec1, true),
        dmsLng: decimalToDms(dec2, false),
      };
    }
  }

  return null;
};

/**
 * Calculates great-circle distance between two coordinates in Nautical Miles (NM).
 */
export const calculateDistanceNM = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3440.065; // Earth radius in Nautical Miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
};

/**
 * Calculates initial true course / bearing in degrees (000°-360°) between two coordinates.
 */
export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return Math.round(bearing);
};
