// App config: endpoints, camera home, and layer catalog.

// Tianditu token comes from .env.local or localStorage.
const TIANDITU_TOKEN_STORAGE_KEY = 'webgis.tiandituToken';
export const TIANDITU_TOKEN = import.meta.env.VITE_TIANDITU_TOKEN?.trim() ?? '';

export function getTiandituToken() {
  if (typeof window === 'undefined') return TIANDITU_TOKEN;
  return window.localStorage.getItem(TIANDITU_TOKEN_STORAGE_KEY)?.trim() || TIANDITU_TOKEN;
}

export function saveTiandituToken(token: string) {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (trimmed) window.localStorage.setItem(TIANDITU_TOKEN_STORAGE_KEY, trimmed);
}

export function clearTiandituToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TIANDITU_TOKEN_STORAGE_KEY);
}

// Cesium Ion token for World Imagery comes from .env.local.
export const CESIUM_ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() ?? '';

// Large read-only data goes through /data-server.
export const DATA_SERVER = '/data-server';
export const ENDPOINTS = {
  tilesetZju: `${DATA_SERVER}/tiles/zju/tileset.json`,
  tilesetOsgb: `${DATA_SERVER}/tiles/osgb/tileset.json`,
  // Keep the COG endpoint extensionless.
  cog: `${DATA_SERVER}/cogdata`,
};

// Derived files live in public/data.
export const LOCAL = {
  rtkArea: '/data/rtk_area.geojson',
  rtkPoints: '/data/rtk_points.geojson',
  flightRoute: '/data/flight_route.geojson',
  photoPoints: '/data/photo_points.geojson',
  flightCzml: '/data/flight.czml',
  gcp3dgsPoints: '/data/gcp_3dgs_points.geojson',
  gcpOsgbPoints: '/data/gcp_osgb_points.geojson',
  gcpPoints: '/data/gcp_points.geojson',
  asdSpectra: '/data/asd_spectra.json',
  cogMeta: '/data/cog_meta.json',
};

// Default camera view.
export const HOME_VIEW = {
  lon: 120.0793,
  lat: 30.2985,
  height: 950,
  heading: 0,
  pitch: -35,
};

// Study-area centre.
export const AREA_CENTER = { lon: 120.0793, lat: 30.3088 };

// Hyperspectral metadata from final.hdr.
// 150 bands plus alpha.
export const COG_INFO = {
  spectralBands: 150,
  hasAlpha: true,
  wavelengthUnits: 'nm' as const,
  wavelengthRange: [389.764, 1029.634] as const,
  note: 'final.hdr 提供 150 个中心波长(约 389.8-1029.6 nm)。数据描述仍为 Spectral Math Result [(s1)/s2]，指数结果按反射率比值近似解释。',
};
