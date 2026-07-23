// Translate survey vector layers by a constant ECEF offset.
import {
  Cartesian3,
  ConstantPositionProperty,
  ConstantProperty,
  PolygonHierarchy,
  JulianDate,
  type Entity,
} from 'cesium';
import { layerManager } from '../../cesium/LayerManager';

const LAYER_IDS = ['rtk_area', 'rtk_points', 'photo_points', 'flight_route'];

type Orig =
  | { kind: 'point'; pos: Cartesian3 }
  | { kind: 'polygon'; positions: Cartesian3[]; holes: Cartesian3[][] }
  | { kind: 'polyline'; positions: Cartesian3[] };

class VectorRegistration {
  private cache = new Map<Entity, Orig>();
  private cached = false;

  private buildCache() {
    if (this.cached) return;
    const t = JulianDate.now();
    for (const id of LAYER_IDS) {
      const ds = layerManager.getDataSource(id);
      if (!ds) continue;
      for (const e of ds.entities.values) {
        if (e.polygon) {
          const h = e.polygon.hierarchy?.getValue(t) as PolygonHierarchy | undefined;
          if (h) {
            this.cache.set(e, {
              kind: 'polygon',
              positions: h.positions.map((p) => p.clone()),
              holes: (h.holes ?? []).map((hole) => hole.positions.map((p) => p.clone())),
            });
          }
        } else if (e.polyline) {
          const pts = e.polyline.positions?.getValue(t) as Cartesian3[] | undefined;
          if (pts) this.cache.set(e, { kind: 'polyline', positions: pts.map((p) => p.clone()) });
        } else if (e.position) {
          const p = e.position.getValue(t);
          if (p) this.cache.set(e, { kind: 'point', pos: p.clone() });
        }
      }
    }
    this.cached = true;
  }

  /** Applies an absolute ECEF offset. */
  setOffset(offset: Cartesian3) {
    this.buildCache();
    const add = (p: Cartesian3) => Cartesian3.add(p, offset, new Cartesian3());
    for (const [e, o] of this.cache) {
      if (o.kind === 'point') {
        e.position = new ConstantPositionProperty(add(o.pos));
      } else if (o.kind === 'polygon' && e.polygon) {
        e.polygon.hierarchy = new ConstantProperty(
          new PolygonHierarchy(
            o.positions.map(add),
            o.holes.map((hole) => new PolygonHierarchy(hole.map(add))),
          ),
        );
      } else if (o.kind === 'polyline' && e.polyline) {
        e.polyline.positions = new ConstantProperty(o.positions.map(add));
      }
    }
  }
}

export const vectorRegistration = new VectorRegistration();
