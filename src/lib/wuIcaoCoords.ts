/**
 * Approximate lat/lon for Weather Underground resolution URLs (trailing ICAO / city path).
 * Used by `noaa-wu-compare` for NWS/METAR station selection vs WU daily high.
 */
const ICAO_COORDS: Record<string, { lat: number; lon: number }> = {
  KMIA: { lat: 25.796, lon: -80.291 },
  KLGA: { lat: 40.777, lon: -73.874 },
  KORD: { lat: 41.974, lon: -87.907 },
  KLAX: { lat: 33.943, lon: -118.408 },
  KIAH: { lat: 29.99, lon: -95.337 },
  KDFW: { lat: 32.9, lon: -97.04 },
  KPHX: { lat: 33.434, lon: -112.012 },
  KDEN: { lat: 39.856, lon: -104.674 },
  KSEA: { lat: 47.45, lon: -122.309 },
  KSFO: { lat: 37.621, lon: -122.379 },
  KBOS: { lat: 42.366, lon: -71.01 },
  KATL: { lat: 33.641, lon: -84.428 },
  KDCA: { lat: 38.851, lon: -77.04 },
  KLAS: { lat: 36.084, lon: -115.154 },
  KAUS: { lat: 30.195, lon: -97.67 },
  KDTW: { lat: 42.216, lon: -83.355 },
  KPDX: { lat: 45.59, lon: -122.595 },
  KSLC: { lat: 40.79, lon: -111.979 },
  PANC: { lat: 61.174, lon: -149.996 },
  PHNL: { lat: 21.325, lon: -157.925 },
  CYYZ: { lat: 43.678, lon: -79.625 },
  CYVR: { lat: 49.195, lon: -123.179 },
  CYYC: { lat: 51.114, lon: -114.02 },
  CYUL: { lat: 45.458, lon: -73.75 },
  CYOW: { lat: 45.323, lon: -75.669 },
  EGLL: { lat: 51.47, lon: -0.454 },
  LFPG: { lat: 49.01, lon: 2.548 },
  EDDB: { lat: 52.367, lon: 13.503 },
  EDDM: { lat: 48.354, lon: 11.786 },
  LIRF: { lat: 41.8, lon: 12.238 },
  LEMD: { lat: 40.472, lon: -3.563 },
  EHAM: { lat: 52.311, lon: 4.768 },
  LSZH: { lat: 47.458, lon: 8.556 },
  UUEE: { lat: 55.973, lon: 37.415 },
  LTFM: { lat: 41.262, lon: 28.728 },
  LTAC: { lat: 40.128, lon: 32.995 },
  HECA: { lat: 30.122, lon: 31.406 },
  FAOR: { lat: -26.139, lon: 28.246 },
  OMDB: { lat: 25.253, lon: 55.366 },
  RKSS: { lat: 37.46, lon: 126.441 },
  RJTT: { lat: 35.549, lon: 139.78 },
  ZBAA: { lat: 40.08, lon: 116.603 },
  ZSPD: { lat: 31.143, lon: 121.805 },
  VHHH: { lat: 22.308, lon: 113.919 },
  WSSS: { lat: 1.364, lon: 103.992 },
  VTBS: { lat: 13.681, lon: 100.747 },
  RPLL: { lat: 14.509, lon: 121.02 },
  WIII: { lat: -6.126, lon: 106.656 },
  WMKK: { lat: 2.746, lon: 101.71 },
  VDPP: { lat: 11.547, lon: 104.844 },
  VVTS: { lat: 10.819, lon: 106.652 },
  VIDP: { lat: 28.555, lon: 77.084 },
  VABB: { lat: 19.09, lon: 72.868 },
  VILK: { lat: 26.761, lon: 80.889 },
  LLBG: { lat: 32.011, lon: 34.887 },
  YSSY: { lat: -33.946, lon: 151.177 },
  YMML: { lat: -37.673, lon: 144.843 },
  YBBN: { lat: -27.384, lon: 153.118 },
  YPPH: { lat: -31.94, lon: 115.967 },
  NZAA: { lat: -37.008, lon: 174.785 },
  NZWN: { lat: -41.327, lon: 174.805 },
  SBGR: { lat: -23.436, lon: -46.473 },
  MMMX: { lat: 19.436, lon: -99.072 },
  SAEZ: { lat: -34.822, lon: -58.536 },
  SPJC: { lat: -12.022, lon: -77.114 },
  SKBO: { lat: 4.702, lon: -74.147 },
  SCEL: { lat: -33.393, lon: -70.786 },
};

/** Trailing ICAO-like segment in a WU weather URL, or null. */
export function parseIcaoFromWuUrl(url: string): string | null {
  const m = url.trim().match(/\/([A-Z0-9]{4})(?:\?.*)?$/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Approximate coordinates for a Polymarket/WU resolution URL.
 * Returns null if the URL has no known ICAO/city mapping (caller should skip NOAA compare).
 */
export function getApproxCoordsForWuResolutionUrl(url: string): { lat: number; lon: number } | null {
  if (!url || typeof url !== "string") return null;
  const u = url.toLowerCase();
  if (u.includes("/jerusalem")) return { lat: 31.77, lon: 35.22 };
  if (u.includes("/haifa")) return { lat: 32.81, lon: 34.99 };

  const icao = parseIcaoFromWuUrl(url);
  if (!icao) return null;
  return ICAO_COORDS[icao] ?? null;
}
