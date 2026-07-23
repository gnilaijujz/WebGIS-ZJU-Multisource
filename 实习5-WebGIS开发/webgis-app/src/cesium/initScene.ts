import {
  ClassificationType,
  Color,
  HeightReference,
  PointGraphics,
  LabelGraphics,
  Cartesian2,
  Cartesian3,
  VerticalOrigin,
  ConstantProperty,
  GeoJsonDataSource,
  JulianDate,
  PolylineGraphics,
  PolylineGlowMaterialProperty,
  PolygonHierarchy,
} from 'cesium';
import { layerManager } from './LayerManager';
import { cogLayer } from '../features/cog/cogLayer';
import { flightController } from '../features/flight/flightController';
import { meshController } from '../features/mesh/meshController';
import { ENDPOINTS, LOCAL } from '../config';

/** Loads the initial layers once the viewer is ready. */
export async function initScene() {
  // ---------------- 三维模型 (F2) ----------------
  layerManager.addTileset({
    id: 'osgb',
    name: '倾斜摄影模型 (OSGB)',
    group: '三维模型',
    url: ENDPOINTS.tilesetOsgb,
    maximumScreenSpaceError: 16,
  });
  // Minimal loader for the 3DGS splat layer.
  layerManager.addTileset({
    id: 'zju3dgs',
    name: '三维高斯泼溅 (3DGS)',
    group: '三维模型',
    url: ENDPOINTS.tilesetZju,
    minimal: true,
    visible: false,
  });

  // ---------------- 矢量成果 (F4) ----------------
  // RTK 面
  layerManager.addGeoJson({
    id: 'rtk_area',
    name: 'RTK 测量面',
    group: '矢量成果',
    url: LOCAL.rtkArea,
    kind: 'geojson',
    style: {
      // Clamp polygons to the ground.
      clampToGround: true,
      stroke: Color.YELLOW,
      strokeWidth: 2,
      fill: Color.YELLOW.withAlpha(0.3),
    },
    decorate: clampRtkArea,
  });

  // 无人机航线 (线)
  layerManager.addGeoJson({
    id: 'flight_route',
    name: '无人机航线',
    group: '矢量成果',
    url: LOCAL.flightRoute,
    kind: 'geojson',
    decorate: (ds) => {
      for (const e of ds.entities.values) {
        if (e.polyline) {
          e.polyline.material = new PolylineGlowMaterialProperty({
            color: Color.CYAN,
            glowPower: 0.25,
          });
          e.polyline.width = new ConstantProperty(3);
        }
      }
    },
  });

  // 拍摄点 (点)
  layerManager.addGeoJson({
    id: 'photo_points',
    name: '拍摄点 (530)',
    group: '矢量成果',
    url: LOCAL.photoPoints,
    kind: 'points',
    visible: false,
    decorate: (ds) => stylePoints(ds, Color.ORANGE, 4),
  });

  // 3DGS 控制点
  layerManager.addGeoJson({
    id: 'gcp_3dgs_points',
    name: '3DGS 控制点',
    group: '矢量成果',
    url: LOCAL.gcp3dgsPoints,
    kind: 'points',
    decorate: (ds) => styleControlPoints(ds, '3DGS', Color.RED),
  });

  // OSGB 控制点
  layerManager.addGeoJson({
    id: 'gcp_osgb_points',
    name: 'OSGB 控制点',
    group: '矢量成果',
    url: LOCAL.gcpOsgbPoints,
    kind: 'points',
    decorate: (ds) => styleControlPoints(ds, 'OSGB', Color.DEEPSKYBLUE),
  });

  // ---------------- 高光谱 COG (F3) ----------------
  // Start the COG layer.
  cogLayer.start();

  // ---------------- 无人机航线动画 (Q5) ----------------
  flightController.load();

  // ---------------- 2DGS 表面网格 (Q8) ----------------
  // Hidden by default.
  meshController.load();
}

function stylePoints(ds: GeoJsonDataSource, color: Color, size: number) {
  for (const e of ds.entities.values) {
    e.billboard = undefined;
    e.point = new PointGraphics({
      pixelSize: size,
      color,
      outlineColor: Color.BLACK.withAlpha(0.5),
      outlineWidth: 1,
      heightReference: HeightReference.NONE,
    });
  }
}

function styleControlPoints(ds: GeoJsonDataSource, prefix: string, color: Color) {
  for (const e of ds.entities.values) {
    e.billboard = undefined;
    e.point = new PointGraphics({
      pixelSize: 10,
      color,
      outlineColor: Color.WHITE,
      outlineWidth: 2,
      heightReference: HeightReference.NONE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    const id = (e.properties?.id?.getValue?.() as string) ?? '';
    e.label = new LabelGraphics({
      text: `${prefix}-${id}`,
      font: '12px sans-serif',
      fillColor: Color.WHITE,
      showBackground: true,
      backgroundColor: Color.BLACK.withAlpha(0.6),
      pixelOffset: new Cartesian2(0, -16),
      verticalOrigin: VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }
}

function clampRtkArea(ds: GeoJsonDataSource) {
  const time = JulianDate.now();
  const outlines: { id: string; positions: Cartesian3[]; properties: typeof ds.entities.values[number]['properties'] }[] = [];
  for (const e of ds.entities.values) {
    if (!e.polygon) continue;
    const hierarchy = e.polygon.hierarchy?.getValue(time) as PolygonHierarchy | undefined;
    if (hierarchy?.positions.length) {
      outlines.push({
        id: `${e.id}-outline`,
        positions: closeRing(hierarchy.positions),
        properties: e.properties,
      });
    }

    e.polygon.height = undefined;
    e.polygon.extrudedHeight = undefined;
    e.polygon.perPositionHeight = new ConstantProperty(false);
    e.polygon.heightReference = new ConstantProperty(HeightReference.CLAMP_TO_GROUND);
    e.polygon.classificationType = new ConstantProperty(ClassificationType.BOTH);
    e.polygon.outline = new ConstantProperty(false);
    e.polygon.zIndex = new ConstantProperty(1);
  }

  for (const outline of outlines) {
    ds.entities.add({
      id: outline.id,
      properties: outline.properties,
      polyline: new PolylineGraphics({
        positions: outline.positions,
        width: 2,
        material: Color.YELLOW,
        clampToGround: true,
        classificationType: ClassificationType.BOTH,
        zIndex: 2,
      }),
    });
  }
}

function closeRing(positions: Cartesian3[]) {
  if (positions.length < 2) return positions;
  return [...positions, positions[0]];
}
