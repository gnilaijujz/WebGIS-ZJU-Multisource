// Q3 handles vectors; otherwise we probe the hyperspectral COG.
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Cartesian2,
  Cartesian3,
  Color,
  Math as CesiumMath,
  Entity,
  defined,
  type Viewer,
  ConstantPositionProperty,
} from 'cesium';
import { cogReader } from '../cog/cogReader';
import { useCogStore } from '../cog/cogStore';
import { useGeorefStore } from '../mesh/georefStore';
import { useQueryStore, type PickedFeature } from './queryStore';

const MARKER_ID = '__query_marker__';

class QueryController {
  private handler: ScreenSpaceEventHandler | null = null;
  private viewer: Viewer | null = null;
  private marker: Entity | null = null;
  private queryToken = 0; // guards against overlapping pixel queries

  init(viewer: Viewer) {
    if (this.handler) return;
    this.viewer = viewer;
    this.handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    this.handler.setInputAction(
      (e: ScreenSpaceEventHandler.PositionedEvent) => this.onClick(e.position),
      ScreenSpaceEventType.LEFT_CLICK,
    );
  }

  private pickCartesian(pos: Cartesian2): Cartesian3 | undefined {
    const scene = this.viewer!.scene;
    // Try depth pick first.
    let c: Cartesian3 | undefined = scene.pickPosition(pos);
    if (!defined(c)) {
      const ray = this.viewer!.camera.getPickRay(pos);
      if (ray) c = scene.globe.pick(ray, scene) as Cartesian3 | undefined;
    }
    if (!defined(c)) c = this.viewer!.camera.pickEllipsoid(pos);
    return c;
  }

  private onClick(pos: Cartesian2) {
    // Mesh georef takes priority.
    if (useGeorefStore.getState().active) return;
    const viewer = this.viewer!;
    const q = useQueryStore.getState();

    // Vector feature pick.
    const picked = viewer.scene.pick(pos);
    if (defined(picked) && picked.id instanceof Entity) {
      const ent = picked.id as Entity;
      const props = ent.properties?.getValue?.(viewer.clock.currentTime) ?? {};
      
      if (ent.id !== MARKER_ID) {
        const dsName = this.dataSourceOf(ent);
        const f: PickedFeature = {
          layer: dsName,
          title: this.featureTitle(ent, props, dsName),
          props,
        };
        q.setFeature(f);
        q.setPixel(null);
        return;
      }
    }

    // Hyperspectral pixel query.
    const cart = this.pickCartesian(pos);
    if (!defined(cart)) return;
    const carto = Cartographic.fromCartesian(cart);
    const lon = CesiumMath.toDegrees(carto.longitude);
    const lat = CesiumMath.toDegrees(carto.latitude);

    q.setFeature(null);
    void this.runPixelQuery(lon, lat, cart);
  }

  private async runPixelQuery(lon: number, lat: number, cart: Cartesian3) {
    const q = useQueryStore.getState();
    await cogReader.ready();
    if (!cogReader.contains(lon, lat)) {
      q.setPixel(null);
      return; // click outside hyperspectral coverage — ignore silently
    }
    const px = cogReader.lonLatToPixel(lon, lat);
    if (!px) {
      q.setPixel(null);
      return;
    }
    this.dropMarker(cart);

    // Latest click wins.
    const my = ++this.queryToken;
    const band = useCogStore.getState().band;
    q.setPixel({
      lon,
      lat,
      col: px.col,
      row: px.row,
      band,
      bandValue: null,
      spectrum: null,
      loading: true,
    });

    // Current band first.
    try {
      const v = await cogReader.readBandValue(lon, lat, band);
      if (my === this.queryToken) q.patchPixel({ bandValue: v });
    } catch {
      /* non-fatal */
    }

    // Then the full spectrum.
    try {
      const spectrum = await cogReader.readSpectrum(lon, lat);
      if (my === this.queryToken) q.patchPixel({ spectrum, loading: false });
    } catch (err) {
      if (my === this.queryToken) q.patchPixel({ loading: false, error: String(err) });
    }
  }

  private dropMarker(cart: Cartesian3) {
    const viewer = this.viewer!;
    if (!this.marker) {
      this.marker = viewer.entities.add({
        id: MARKER_ID,
        position: cart,
        point: {
          pixelSize: 12,
          color: Color.RED,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    } else {
      this.marker.position = new ConstantPositionProperty(cart);
    }
  }

  private dataSourceOf(ent: Entity): string {
    const viewer = this.viewer!;
    for (let i = 0; i < viewer.dataSources.length; i++) {
      const ds = viewer.dataSources.get(i);
      if (ds.entities.getById(ent.id)) return ds.name ?? '';
    }
    return '';
  }

  private featureTitle(ent: Entity, props: Record<string, unknown>, ds: string): string {
    // Prefer a useful attribute name.
    const cand =
      (props['id'] as string) ||
      (props['地物类'] as string) ||
      (props['name'] as string) ||
      (ent.name as string);
    const dataset = props['dataset'] as string | undefined;
    if (dataset && cand) return `${dataset}-${cand}`;
    return cand || ds || '要素';
  }
}

export const queryController = new QueryController();
