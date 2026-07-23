import {
  Viewer,
  ImageryLayer,
  UrlTemplateImageryProvider,
  IonImageryProvider,
  Ion,
  Cartesian3,
  Math as CesiumMath,
  Color,
  Credit,
} from 'cesium';
import { HOME_VIEW, getTiandituToken, CESIUM_ION_TOKEN } from '../config';

// Cesium World Imagery needs an Ion token.
if (CESIUM_ION_TOKEN) {
  Ion.defaultAccessToken = CESIUM_ION_TOKEN;
}

// Basemaps stay aligned with the project data.
export type BasemapKind =
  | 'tianditu-img'
  | 'cesium-img'
  | 'esri-img'
  | 'none';

export const BASEMAP_OPTIONS: { label: string; value: BasemapKind }[] = [
  { label: 'Cesium 影像', value: 'cesium-img' },
  { label: 'Esri 影像', value: 'esri-img' },
  { label: '天地图影像(需tk)', value: 'tianditu-img' },
  { label: '无底图', value: 'none' },
];

const layerOf = (p: UrlTemplateImageryProvider) =>
  ImageryLayer.fromProviderAsync(Promise.resolve(p), {});

// Tianditu WMTS.
const tdt = (layer: string) => {
  const token = getTiandituToken();
  return layerOf(
    new UrlTemplateImageryProvider({
      url:
        `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
        `&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${token}`,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maximumLevel: 18,
      credit: new Credit('天地图 Tianditu'),
    }),
  );
};

/** Basemap layers. */
export function makeBaseLayers(kind: BasemapKind): ImageryLayer[] {
  switch (kind) {
    case 'tianditu-img':
      return getTiandituToken() ? [tdt('img'), tdt('cia')] : [];
    case 'cesium-img':
      // World Imagery needs an Ion token.
      return CESIUM_ION_TOKEN
        ? [ImageryLayer.fromProviderAsync(IonImageryProvider.fromAssetId(2), {})]
        : [];
    case 'esri-img':
      return [
        layerOf(
          new UrlTemplateImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
            credit: new Credit('Esri World Imagery'),
          }),
        ),
      ];
    case 'none':
      return [];
  }
}

export function createViewer(container: HTMLElement): Viewer {
  const viewer = new Viewer(container, {
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: true, // 2D / 3D toggle (requirement: switch 2D/3D)
    fullscreenButton: false,
    animation: true, // needed for CZML flight playback
    timeline: true,
    infoBox: false, // we render our own popups
    selectionIndicator: true,
    baseLayer: false, // basemap is added by basemapController after init
  });

  // Hide the default Ion credit.
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.backgroundColor = Color.fromCssColorString('#0b1020');
  viewer.scene.globe.baseColor = Color.fromCssColorString('#1a2233');

  flyHome(viewer, 0);
  return viewer;
}

export function flyHome(viewer: Viewer, duration = 1.5) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.height),
    orientation: {
      heading: CesiumMath.toRadians(HOME_VIEW.heading),
      pitch: CesiumMath.toRadians(HOME_VIEW.pitch),
      roll: 0,
    },
    duration,
  });
}
