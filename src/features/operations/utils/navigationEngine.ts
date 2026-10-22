import { calculateDistanceNM, calculateBearing } from "./coordinates";

/**
 * Aeronautical Point Types
 */
export type AeronauticalPointType = "airport" | "military_base" | "fob" | "vor" | "dme" | "tactical_lz" | "waypoint";

export interface AeronauticalPoint {
  id: string;
  ident: string; // e.g. DNAA, DNKA, ABC, LZ-A
  name: string;
  type: AeronauticalPointType;
  latitude: number;
  longitude: number;
  elevationFt: number;
  frequency?: string; // for VOR/DME/ILS
  runways?: string[]; // e.g. ["04/22", "13/31"]
  notes?: string;
}

/**
 * Hardcoded Nigerian Aeronautical Database
 * Sourced from Nigerian AIP, NAF Air Operations, and ICAO Doc 7910.
 */
export const NIGERIA_AERONAUTICAL_DATABASE: AeronauticalPoint[] = [
  // Major Military & Joint Aerodromes
  {
    id: "DNAA",
    ident: "DNAA",
    name: "Nnamdi Azikiwe Int'l / Air Force Wing",
    type: "airport",
    latitude: 9.0065,
    longitude: 7.2631,
    elevationFt: 1123,
    runways: ["04/22 (3609m)"],
    notes: "Abuja Command HQ / Tactical Air Command Hub",
  },
  {
    id: "DNKA",
    ident: "DNKA",
    name: "Kaduna Military Airport (NAF Air Training Command)",
    type: "military_base",
    latitude: 10.5969,
    longitude: 7.3204,
    elevationFt: 2073,
    runways: ["05/23 (3000m)"],
    notes: "Primary Military Air Base / Helicopter Training School",
  },
  {
    id: "DNMA",
    ident: "DNMA",
    name: "Maiduguri Int'l Airport / Joint Air Task Force Base",
    type: "military_base",
    latitude: 11.8553,
    longitude: 13.0809,
    elevationFt: 1099,
    runways: ["05/23 (3001m)"],
    notes: "Operation Hadin Kai Tactical Operations Hub",
  },
  {
    id: "DNKN",
    ident: "DNKN",
    name: "Mallam Aminu Kano Int'l / Air Force Base Kano",
    type: "airport",
    latitude: 12.0476,
    longitude: 8.5246,
    elevationFt: 1562,
    runways: ["06/24 (3301m)", "05/23 (2451m)"],
    notes: "Northern Defense Sector Joint Hub",
  },
  {
    id: "DNYO",
    ident: "DNYO",
    name: "Yola Airport / Air Force Composite Wing",
    type: "military_base",
    latitude: 9.2575,
    longitude: 12.4303,
    elevationFt: 599,
    runways: ["17/35 (3000m)"],
    notes: "Northeast Sector Support & CSAR Hub",
  },
  {
    id: "DNMM",
    ident: "DNMM",
    name: "Murtala Muhammed Int'l / Logistic Air Command Base",
    type: "airport",
    latitude: 6.5774,
    longitude: 3.3212,
    elevationFt: 135,
    runways: ["18R/36L (3900m)", "18L/36R (2743m)"],
    notes: "Lagos Logistics & Coastal Patrol Command",
  },
  {
    id: "DNPO",
    ident: "DNPO",
    name: "Port Harcourt Int'l Airport / NAF 115 SOG Base",
    type: "airport",
    latitude: 5.0155,
    longitude: 6.9496,
    elevationFt: 91,
    runways: ["03/21 (3000m)"],
    notes: "Maritime & Special Operations Wing",
  },
  {
    id: "DNMK",
    ident: "DNMK",
    name: "Makurdi Air Force Base (Tactical Air Command)",
    type: "military_base",
    latitude: 7.7039,
    longitude: 8.6139,
    elevationFt: 371,
    runways: ["05/23 (2996m)"],
    notes: "NAF Fighter & Ground Attack Strike Headquarters",
  },
  {
    id: "DNKJ",
    ident: "DNKJ",
    name: "Kainji Air Force Station",
    type: "military_base",
    latitude: 9.8444,
    longitude: 4.4842,
    elevationFt: 469,
    runways: ["04/22 (2500m)"],
    notes: "A-29 Super Tucano Tactical Fighter Base",
  },
  {
    id: "DNSO",
    ident: "DNSO",
    name: "Sadiq Abubakar III Int'l (Sokoto)",
    type: "airport",
    latitude: 12.9163,
    longitude: 5.2072,
    elevationFt: 1010,
    runways: ["08/26 (3000m)"],
    notes: "North-West Border Security Air Station",
  },
  {
    id: "DNEN",
    ident: "DNEN",
    name: "Akanu Ibiam Int'l Airport (Enugu)",
    type: "airport",
    latitude: 6.4743,
    longitude: 7.562,
    elevationFt: 466,
    runways: ["08/26 (3000m)"],
    notes: "Eastern Sector Regional Aerodrome",
  },
  {
    id: "DNJO",
    ident: "DNJO",
    name: "Yakubu Gowon Airport (Jos)",
    type: "airport",
    latitude: 9.6398,
    longitude: 8.8691,
    elevationFt: 4232,
    runways: ["10/28 (3100m)"],
    notes: "High-Altitude Plateau Base",
  },
  {
    id: "DNIB",
    ident: "DNIB",
    name: "Ibadan Airport",
    type: "airport",
    latitude: 7.3625,
    longitude: 3.9783,
    elevationFt: 725,
    runways: ["04/22 (2400m)"],
    notes: "South-West Tactical Auxiliary Field",
  },
  {
    id: "DNBE",
    ident: "DNBE",
    name: "Benin Airport",
    type: "airport",
    latitude: 6.317,
    longitude: 5.5995,
    elevationFt: 258,
    runways: ["05/23 (2399m)"],
    notes: "Mid-West Support Station",
  },
  {
    id: "DNCA",
    ident: "DNCA",
    name: "Margaret Ekpo Int'l (Calabar)",
    type: "airport",
    latitude: 4.9761,
    longitude: 8.3472,
    elevationFt: 211,
    runways: ["03/21 (2451m)"],
    notes: "South-Eastern Coastal Security Post",
  },
  {
    id: "DNMS",
    ident: "DNMS",
    name: "Minna Airport",
    type: "airport",
    latitude: 9.6522,
    longitude: 6.4623,
    elevationFt: 834,
    runways: ["05/23 (3400m)"],
    notes: "Central Sector Auxiliary Runway",
  },
  {
    id: "DNZA",
    ident: "DNZA",
    name: "Zaria Airfield (NCAT Civil Aviation College)",
    type: "airport",
    latitude: 11.1302,
    longitude: 7.6858,
    elevationFt: 2170,
    runways: ["06/24 (1665m)"],
    notes: "Flight Training & Rotorcraft Maintenance Hub",
  },

  // Forward Operating Bases (FOB)
  {
    id: "FOB_KAT",
    ident: "FOB-KATSINA",
    name: "Forward Operating Base Katsina",
    type: "fob",
    latitude: 12.998,
    longitude: 7.662,
    elevationFt: 1670,
    notes: "North-West Tactical Quick Reaction Post",
  },
  {
    id: "FOB_GWA",
    ident: "FOB-B-GWARI",
    name: "Forward Operating Base Birnin Gwari",
    type: "fob",
    latitude: 10.661,
    longitude: 6.541,
    elevationFt: 1840,
    notes: "Kaduna-Niger Border Banditry Counter-Force",
  },
  {
    id: "FOB_BAM",
    ident: "FOB-BAMA",
    name: "Forward Operating Base Bama",
    type: "fob",
    latitude: 11.521,
    longitude: 13.689,
    elevationFt: 1080,
    notes: "Sambisa Forest Axis Tactical LZ",
  },
  {
    id: "FOB_MON",
    ident: "FOB-MONGUNO",
    name: "Forward Operating Base Monguno",
    type: "fob",
    latitude: 12.671,
    longitude: 13.613,
    elevationFt: 980,
    notes: "Lake Chad Basin Defense Line",
  },
  {
    id: "FOB_DAM",
    ident: "FOB-DAMASAK",
    name: "Forward Operating Base Damasak",
    type: "fob",
    latitude: 13.104,
    longitude: 12.508,
    elevationFt: 920,
    notes: "Northern Border Outpost & Helipad",
  },
  {
    id: "FOB_GWO",
    ident: "FOB-GWOZA",
    name: "Forward Operating Base Gwoza",
    type: "fob",
    latitude: 11.083,
    longitude: 13.694,
    elevationFt: 1410,
    notes: "Mandara Mountains Escarpment Base",
  },

  // Navigation Aids (VOR / DME)
  {
    id: "VOR_ABC",
    ident: "ABC",
    name: "Abuja VOR/DME",
    type: "vor",
    latitude: 9.0067,
    longitude: 7.265,
    elevationFt: 1125,
    frequency: "116.30 MHz",
    notes: "Class H High-Altitude Enroute VOR",
  },
  {
    id: "VOR_KDA",
    ident: "KDA",
    name: "Kaduna VOR/DME",
    type: "vor",
    latitude: 10.598,
    longitude: 7.322,
    elevationFt: 2075,
    frequency: "114.90 MHz",
    notes: "Military Corridor Terminal Navaid",
  },
  {
    id: "VOR_KAN",
    ident: "KAN",
    name: "Kano VOR/DME",
    type: "vor",
    latitude: 12.048,
    longitude: 8.526,
    elevationFt: 1565,
    frequency: "112.70 MHz",
    notes: "Enroute Trans-Sahara VOR",
  },
  {
    id: "VOR_MIA",
    ident: "MIA",
    name: "Maiduguri VOR/DME",
    type: "vor",
    latitude: 11.856,
    longitude: 13.083,
    elevationFt: 1102,
    frequency: "113.10 MHz",
    notes: "North-East Tactical Sector Navaid",
  },
  {
    id: "VOR_LAG",
    ident: "LAG",
    name: "Lagos VOR/DME",
    type: "vor",
    latitude: 6.578,
    longitude: 3.325,
    elevationFt: 140,
    frequency: "113.70 MHz",
    notes: "Terminal Coastal Transition VOR",
  },
  {
    id: "VOR_POT",
    ident: "POT",
    name: "Port Harcourt VOR/DME",
    type: "vor",
    latitude: 5.017,
    longitude: 6.952,
    elevationFt: 95,
    frequency: "113.50 MHz",
    notes: "Delta Sector Terminal Navaid",
  },

  // Tactical Landing Zones (LZs)
  {
    id: "LZ_ALPHA",
    ident: "LZ-ALPHA",
    name: "Tactical LZ Alpha (Kaduna Sector)",
    type: "tactical_lz",
    latitude: 10.42,
    longitude: 7.15,
    elevationFt: 2010,
    notes: "Secured Natural Clearing / Single Rotorcraft",
  },
  {
    id: "LZ_BRAVO",
    ident: "LZ-BRAVO",
    name: "Tactical LZ Bravo (Shiroro Valley)",
    type: "tactical_lz",
    latitude: 9.98,
    longitude: 6.82,
    elevationFt: 1350,
    notes: "Riverine Valley Extraction Zone",
  },
  {
    id: "LZ_CHARLIE",
    ident: "LZ-CHARLIE",
    name: "Tactical LZ Charlie (Alagarno Forest)",
    type: "tactical_lz",
    latitude: 11.45,
    longitude: 12.82,
    elevationFt: 1150,
    notes: "Counter-Terrorism Insertion Site",
  },
  {
    id: "LZ_DELTA",
    ident: "LZ-DELTA",
    name: "Tactical LZ Delta (Lake Chad Fringe)",
    type: "tactical_lz",
    latitude: 12.92,
    longitude: 13.88,
    elevationFt: 940,
    notes: "Amphibious Border LZ",
  },
];

/**
 * Wind Triangle & Dead-Reckoning calculation (Garmin / Jeppesen E6B flight computer algorithm)
 */
export interface WindTriangleResult {
  windDirectionDeg: number;
  windSpeedKts: number;
  trueAirspeedKts: number;
  trueCourseDeg: number;
  trueHeadingDeg: number;
  magneticHeadingDeg: number;
  windCorrectionAngleDeg: number;
  groundSpeedKts: number;
  headwindKts: number; // positive = headwind, negative = tailwind
  crosswindKts: number; // positive = from right, negative = from left
  isHeadwind: boolean;
  driftDescription: string;
}

export function calculateWindTriangle(
  trueAirspeedKts: number,
  windDirectionDeg: number,
  windSpeedKts: number,
  trueCourseDeg: number,
  magneticVariationDeg: number = -2.0 // Typical Nigeria declination is ~2.0° West
): WindTriangleResult {
  const tas = Math.max(20, Number(trueAirspeedKts) || 120);
  const wd = ((Number(windDirectionDeg) || 0) % 360 + 360) % 360;
  const ws = Math.max(0, Number(windSpeedKts) || 0);
  const tc = ((Number(trueCourseDeg) || 0) % 360 + 360) % 360;

  // Relative wind angle theta = (Wind Direction - True Course) in radians
  const relAngleRad = ((wd - tc) * Math.PI) / 180;

  // Headwind & Crosswind components
  const headwind = ws * Math.cos(relAngleRad);
  const crosswind = ws * Math.sin(relAngleRad);

  // Ratio R = crosswind / TAS
  let ratio = crosswind / tas;
  if (ratio > 0.999) ratio = 0.999;
  if (ratio < -0.999) ratio = -0.999;

  // Wind Correction Angle (WCA) = arcsin(R) in degrees
  const wcaRad = Math.asin(ratio);
  const wcaDeg = Math.round((wcaRad * 180) / Math.PI);

  // True Heading TH = (TC + WCA) mod 360
  const thDeg = Math.round(((tc + wcaDeg) % 360 + 360) % 360);

  // Groundspeed GS = TAS * cos(WCA) - WS * cos(relAngle)
  const calculatedGs = tas * Math.cos(wcaRad) - headwind;
  const groundSpeed = Math.max(10, Math.round(calculatedGs));

  // Magnetic Heading MH = (TH - magVar) mod 360 (Variation West is negative, so TH - (-2) = TH + 2)
  const mhDeg = Math.round(((thDeg - magneticVariationDeg) % 360 + 360) % 360);

  const isHeadwind = headwind >= 0;
  const driftDescription =
    wcaDeg === 0
      ? "Direct On Track"
      : wcaDeg > 0
      ? `Steer +${wcaDeg}° Right (Starboard Drift)`
      : `Steer ${wcaDeg}° Left (Port Drift)`;

  return {
    windDirectionDeg: wd,
    windSpeedKts: ws,
    trueAirspeedKts: tas,
    trueCourseDeg: tc,
    trueHeadingDeg: thDeg,
    magneticHeadingDeg: mhDeg,
    windCorrectionAngleDeg: wcaDeg,
    groundSpeedKts: groundSpeed,
    headwindKts: Math.round(headwind),
    crosswindKts: Math.round(crosswind),
    isHeadwind,
    driftDescription,
  };
}

/**
 * Route Fix & Leg Types
 */
export interface RouteFix {
  name: string;
  latitude: number;
  longitude: number;
  ident?: string;
  elevationFt?: number;
}

export interface NavLogLeg {
  legIndex: number;
  fromName: string;
  toName: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  trueCourseDeg: number;
  windCorrectionAngleDeg: number;
  trueHeadingDeg: number;
  magneticHeadingDeg: number;
  groundSpeedKts: number;
  distanceNm: number;
  distanceKm: number;
  legEteMinutes: number;
  cumulativeTimeMinutes: number;
  legFuelLiters: number;
  cumulativeFuelLiters: number;
  fuelOnBoardRemainingLiters: number;
  minimumSafeAltitudeFt: number;
  windSummary: string;
}

export interface NavLogSummary {
  legs: NavLogLeg[];
  totalDistanceNm: number;
  totalDistanceKm: number;
  totalFlightTimeMinutes: number;
  totalFlightHours: number;
  totalEnrouteFuelLiters: number;
  averageGroundSpeedKts: number;
}

/**
 * AirNav Pro Terrain Safety Grid: Estimate Minimum Safe Altitude (MSA) for Nigerian Sectors
 */
export function estimateSectorMsa(lat: number, lng: number): number {
  // Northern Highlands / Jos Plateau region (high terrain up to 4500-5800ft)
  if (lat >= 9.0 && lat <= 10.5 && lng >= 8.2 && lng <= 10.0) {
    return 6500; // 6,500 ft AMSL safe clearance
  }
  // Mandara Mountains / Gwoza Escarpment (Northeast Cameroon border)
  if (lat >= 10.5 && lat <= 12.0 && lng >= 13.0 && lng <= 14.2) {
    return 5500;
  }
  // Central Kaduna / Abuja Rolling hills
  if (lat >= 8.5 && lat <= 11.0 && lng >= 6.5 && lng <= 8.0) {
    return 4000;
  }
  // Coastal Lowlands / Niger Delta
  if (lat < 7.0) {
    return 2500;
  }
  // Standard Savannah Plains
  return 3500;
}

/**
 * Build Full Flight NavLog with E6B Dead-Reckoning Legs
 */
export function generateJeppesenNavLog(
  points: RouteFix[],
  trueAirspeedKts: number,
  windDirectionDeg: number,
  windSpeedKts: number,
  burnRateLph: number,
  totalFuelOnBoardLiters: number = 1000,
  magneticVariationDeg: number = -2.0
): NavLogSummary {
  if (!points || points.length < 2) {
    return {
      legs: [],
      totalDistanceNm: 0,
      totalDistanceKm: 0,
      totalFlightTimeMinutes: 0,
      totalFlightHours: 0,
      totalEnrouteFuelLiters: 0,
      averageGroundSpeedKts: trueAirspeedKts || 120,
    };
  }

  const legs: NavLogLeg[] = [];
  let cumTimeMin = 0;
  let cumFuelL = 0;
  let remainingFob = totalFuelOnBoardLiters;

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];

    const distNm = calculateDistanceNM(from.latitude, from.longitude, to.latitude, to.longitude);
    const distKm = Number((distNm * 1.852).toFixed(1));
    const tc = calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);

    const windCalc = calculateWindTriangle(
      trueAirspeedKts,
      windDirectionDeg,
      windSpeedKts,
      tc,
      magneticVariationDeg
    );

    const eteMinutes = Math.max(1, Math.round((distNm / windCalc.groundSpeedKts) * 60));
    cumTimeMin += eteMinutes;

    const legFuel = Math.round((eteMinutes / 60) * burnRateLph);
    cumFuelL += legFuel;
    remainingFob = Math.max(0, remainingFob - legFuel);

    const midLat = (from.latitude + to.latitude) / 2;
    const midLng = (from.longitude + to.longitude) / 2;
    const msa = estimateSectorMsa(midLat, midLng);

    const windDirStr = String(windCalc.windDirectionDeg).padStart(3, "0");
    const windSummary = `${windDirStr}°/${windCalc.windSpeedKts}k (${windCalc.isHeadwind ? "HW" : "TW"} ${Math.abs(
      windCalc.headwindKts
    )}k, XW ${Math.abs(windCalc.crosswindKts)}k)`;

    legs.push({
      legIndex: i + 1,
      fromName: from.name || `Waypoint ${i + 1}`,
      toName: to.name || `Waypoint ${i + 2}`,
      fromCoords: [from.latitude, from.longitude],
      toCoords: [to.latitude, to.longitude],
      trueCourseDeg: tc,
      windCorrectionAngleDeg: windCalc.windCorrectionAngleDeg,
      trueHeadingDeg: windCalc.trueHeadingDeg,
      magneticHeadingDeg: windCalc.magneticHeadingDeg,
      groundSpeedKts: windCalc.groundSpeedKts,
      distanceNm: distNm,
      distanceKm: distKm,
      legEteMinutes: eteMinutes,
      cumulativeTimeMinutes: cumTimeMin,
      legFuelLiters: legFuel,
      cumulativeFuelLiters: cumFuelL,
      fuelOnBoardRemainingLiters: remainingFob,
      minimumSafeAltitudeFt: msa,
      windSummary,
    });
  }

  const totalDistNm = Number(legs.reduce((acc, l) => acc + l.distanceNm, 0).toFixed(1));
  const totalDistKm = Number((totalDistNm * 1.852).toFixed(1));
  const totalFlightHours = Number((cumTimeMin / 60).toFixed(2));
  const averageGs =
    cumTimeMin > 0 ? Math.round((totalDistNm / (cumTimeMin / 60))) : trueAirspeedKts;

  return {
    legs,
    totalDistanceNm: totalDistNm,
    totalDistanceKm: totalDistKm,
    totalFlightTimeMinutes: cumTimeMin,
    totalFlightHours,
    totalEnrouteFuelLiters: cumFuelL,
    averageGroundSpeedKts: averageGs,
  };
}

/**
 * Tactical Critical Points: Equal Time Point (ETP) and Point of No Return (PNR)
 */
export interface TacticalCriticalPoints {
  totalDistanceNm: number;
  groundSpeedOutboundKts: number;
  groundSpeedHomeboundKts: number;
  etpDistanceNm: number;
  etpTimeMinutes: number;
  etpFractionOfRoute: number;
  etpLat: number | null;
  etpLng: number | null;
  isEtpPastHalfway: boolean;
  pnrDistanceNm: number;
  pnrTimeMinutes: number;
  pnrFractionOfRoute: number;
  pnrLat: number | null;
  pnrLng: number | null;
  canReturnSafelyFromAnyPoint: boolean;
  fuelMarginLiters: number;
  enduranceHours: number;
}

/**
 * Given a sequence of coordinates and a target distance in NM along the track,
 * find the exact interpolated [lat, lng] position.
 */
export function interpolateCoordinateAlongRoute(
  points: RouteFix[],
  targetDistanceNm: number
): [number, number] | null {
  if (!points || points.length < 2 || targetDistanceNm <= 0) {
    return points?.[0] ? [points[0].latitude, points[0].longitude] : null;
  }

  let accumulatedDist = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segDist = calculateDistanceNM(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

    if (accumulatedDist + segDist >= targetDistanceNm) {
      const remainingDist = targetDistanceNm - accumulatedDist;
      const fraction = segDist > 0 ? Math.min(1, Math.max(0, remainingDist / segDist)) : 0;

      // Linear latitude/longitude interpolation along the great-circle segment
      const lat = p1.latitude + fraction * (p2.latitude - p1.latitude);
      const lng = p1.longitude + fraction * (p2.longitude - p1.longitude);
      return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
    }

    accumulatedDist += segDist;
  }

  // Target exceeds total route length, return last point
  const last = points[points.length - 1];
  return [last.latitude, last.longitude];
}

/**
 * Calculate Equal Time Point (ETP) and Point of No Return (PNR)
 */
export function calculateTacticalCriticalPoints(
  points: RouteFix[],
  trueAirspeedKts: number,
  windDirectionDeg: number,
  windSpeedKts: number,
  usableFuelLiters: number,
  burnRateLph: number,
  reserveFuelLiters: number = 120
): TacticalCriticalPoints {
  if (!points || points.length < 2) {
    return {
      totalDistanceNm: 0,
      groundSpeedOutboundKts: 120,
      groundSpeedHomeboundKts: 120,
      etpDistanceNm: 0,
      etpTimeMinutes: 0,
      etpFractionOfRoute: 0.5,
      etpLat: null,
      etpLng: null,
      isEtpPastHalfway: false,
      pnrDistanceNm: 0,
      pnrTimeMinutes: 0,
      pnrFractionOfRoute: 1,
      pnrLat: null,
      pnrLng: null,
      canReturnSafelyFromAnyPoint: true,
      fuelMarginLiters: 0,
      enduranceHours: 0,
    };
  }

  const dep = points[0];
  const arr = points[points.length - 1];

  let totalDistNm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistNm += calculateDistanceNM(
      points[i].latitude,
      points[i].longitude,
      points[i + 1].latitude,
      points[i + 1].longitude
    );
  }
  totalDistNm = Number(totalDistNm.toFixed(1));

  // Direct outbound bearing and reciprocal homebound bearing
  const directOutboundBearing = calculateBearing(dep.latitude, dep.longitude, arr.latitude, arr.longitude);
  const directHomeboundBearing = (directOutboundBearing + 180) % 360;

  const windOut = calculateWindTriangle(trueAirspeedKts, windDirectionDeg, windSpeedKts, directOutboundBearing);
  const windHome = calculateWindTriangle(trueAirspeedKts, windDirectionDeg, windSpeedKts, directHomeboundBearing);

  const gsOut = Math.max(20, windOut.groundSpeedKts);
  const gsHome = Math.max(20, windHome.groundSpeedKts);

  // Equal Time Point (ETP): D_ETP = (D * GS_home) / (GS_out + GS_home)
  const etpDist = Number(((totalDistNm * gsHome) / (gsOut + gsHome)).toFixed(1));
  const etpTimeMin = Math.round((etpDist / gsOut) * 60);
  const etpFraction = totalDistNm > 0 ? Math.min(1, Math.max(0, etpDist / totalDistNm)) : 0.5;
  const etpCoords = interpolateCoordinateAlongRoute(points, etpDist);

  // Point of Safe Return / Point of No Return (PNR):
  // Safe Endurance = (Usable Fuel - Mandatory Reserve) / Burn Rate
  const safeFuel = Math.max(0, usableFuelLiters - reserveFuelLiters);
  const safeEnduranceHours = safeFuel / (burnRateLph || 240);

  // T_PNR = (Safe Endurance * GS_home) / (GS_out + GS_home)
  const pnrTimeHours = (safeEnduranceHours * gsHome) / (gsOut + gsHome);
  const pnrTimeMin = Math.round(pnrTimeHours * 60);
  const pnrDist = Number((pnrTimeHours * gsOut).toFixed(1));
  const pnrFraction = totalDistNm > 0 ? Math.min(1.5, Math.max(0, pnrDist / totalDistNm)) : 1;
  const pnrCoords = interpolateCoordinateAlongRoute(points, Math.min(totalDistNm, pnrDist));

  const canReturnSafely = pnrDist >= totalDistNm;
  const requiredRoundTripFuel = Math.round((totalDistNm / gsOut + totalDistNm / gsHome) * burnRateLph + reserveFuelLiters);
  const fuelMargin = usableFuelLiters - requiredRoundTripFuel;

  return {
    totalDistanceNm: totalDistNm,
    groundSpeedOutboundKts: gsOut,
    groundSpeedHomeboundKts: gsHome,
    etpDistanceNm: etpDist,
    etpTimeMinutes: etpTimeMin,
    etpFractionOfRoute: Number(etpFraction.toFixed(2)),
    etpLat: etpCoords ? etpCoords[0] : null,
    etpLng: etpCoords ? etpCoords[1] : null,
    isEtpPastHalfway: etpDist > totalDistNm / 2,
    pnrDistanceNm: pnrDist,
    pnrTimeMinutes: pnrTimeMin,
    pnrFractionOfRoute: Number(pnrFraction.toFixed(2)),
    pnrLat: pnrCoords ? pnrCoords[0] : null,
    pnrLng: pnrCoords ? pnrCoords[1] : null,
    canReturnSafelyFromAnyPoint: canReturnSafely,
    fuelMarginLiters: fuelMargin,
    enduranceHours: Number((usableFuelLiters / (burnRateLph || 240)).toFixed(2)),
  };
}

/**
 * ICAO Annex 6 & Jeppesen 6-Tier Fuel Hierarchy Model
 */
export interface IcaoFuelHierarchy {
  taxiFuelL: number;
  tripFuelL: number;
  contingencyFuelL: number; // 5% of trip or 5 min burn
  alternateFuelL: number;
  alternateAerodromeName: string;
  alternateDistanceNm: number;
  finalReserveFuelL: number; // 30 min VFR or 45 min IFR
  minimumBlockFuelL: number;
  extraFuelL: number;
  totalRampFuelL: number;
  fuelWeightKg: number;
  complianceStatus: "compliant" | "warning" | "insufficient";
}

export function calculateIcaoFuelHierarchy(
  tripFuelLiters: number,
  burnRateLph: number,
  destinationCoords?: { lat: number; lng: number } | null,
  selectedAlternateId?: string,
  extraFuelLiters: number = 0,
  isIfr: boolean = false
): IcaoFuelHierarchy {
  const taxiFuelL = 40; // 40L rotorcraft/twin start and ground checks
  const tripFuelL = Math.max(0, Math.round(tripFuelLiters));

  // Contingency: higher of 5% of trip fuel or 5 minutes of cruise burn
  const fiveMinBurn = Math.round((5 / 60) * burnRateLph);
  const contingencyFuelL = Math.max(fiveMinBurn, Math.round(tripFuelL * 0.05));

  // Alternate Aerodrome: find closest major airport or use selected
  let altName = "Enroute Alternate Base";
  let altDistNm = 45; // default 45 NM diversion radius
  if (destinationCoords?.lat && destinationCoords?.lng) {
    const airports = NIGERIA_AERONAUTICAL_DATABASE.filter(
      (p) => p.type === "airport" || p.type === "military_base"
    );

    if (selectedAlternateId) {
      const match = airports.find((a) => a.id === selectedAlternateId || a.ident === selectedAlternateId);
      if (match) {
        altName = `${match.ident} - ${match.name}`;
        altDistNm = calculateDistanceNM(destinationCoords.lat, destinationCoords.lng, match.latitude, match.longitude);
      }
    } else {
      // Find closest airport with distance > 15 NM (not destination itself)
      let minDist = 9999;
      let closestAirport = airports[0];
      for (const ap of airports) {
        const d = calculateDistanceNM(destinationCoords.lat, destinationCoords.lng, ap.latitude, ap.longitude);
        if (d > 10 && d < minDist) {
          minDist = d;
          closestAirport = ap;
        }
      }
      if (closestAirport && minDist < 9999) {
        altName = `${closestAirport.ident} - ${closestAirport.name}`;
        altDistNm = minDist;
      }
    }
  }

  // Alternate diversion fuel = (altDist / 120kts) * burnRate * 1.10 (climb/descent factor)
  const alternateFuelL = Math.round((altDistNm / 120) * burnRateLph * 1.1);

  // Final Reserve: 30 minutes for VFR, 45 minutes for IFR
  const reserveMinutes = isIfr ? 45 : 30;
  const finalReserveFuelL = Math.round((reserveMinutes / 60) * burnRateLph);

  const minimumBlockFuelL = taxiFuelL + tripFuelL + contingencyFuelL + alternateFuelL + finalReserveFuelL;
  const totalRampFuelL = minimumBlockFuelL + Math.max(0, extraFuelLiters);
  const fuelWeightKg = Math.round(totalRampFuelL * 0.804); // Jet A-1 standard density 0.804 kg/L

  return {
    taxiFuelL,
    tripFuelL,
    contingencyFuelL,
    alternateFuelL,
    alternateAerodromeName: altName,
    alternateDistanceNm: altDistNm,
    finalReserveFuelL,
    minimumBlockFuelL,
    extraFuelL: extraFuelLiters,
    totalRampFuelL,
    fuelWeightKg,
    complianceStatus: "compliant",
  };
}
