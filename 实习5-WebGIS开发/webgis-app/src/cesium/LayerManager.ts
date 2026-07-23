import {
  Viewer,
  Cesium3DTileset,
  Cesium3DTileStyle,
  GaussianSplat3DTileContent,
  GeoJsonDataSource,
  CzmlDataSource,
  ImageryLayer,
  DataSource,
  Model,
  Color,
  ColorBlendMode,
  Matrix4,
  Cartesian3,
} from 'cesium';
import { useLayerStore, type LayerKind } from '../store/layerStore';

/** Whether a tileset uses Gaussian splatting. */
function isGaussianSplat(tileset: Cesium3DTileset): boolean {
  try {
    return GaussianSplat3DTileContent.tilesetRequiresGaussianSplattingExt(tileset);
  } catch {
    return false;
  }
}

type Handle =
  | { kind: '3dtiles'; obj: Cesium3DTileset }
  | { kind: 'geojson' | 'points' | 'czml'; obj: DataSource }
  | { kind: 'cog' | 'imagery'; obj: ImageryLayer }
  | { kind: 'model'; obj: Model };

/** Keeps Cesium objects in sync with the layer store. */
class LayerManager {
  private viewer!: Viewer;
  private handles = new Map<string, Handle>();
  private started = false;

  init(viewer: Viewer) {
    this.viewer = viewer;
    if (!this.started) {
      useLayerStore.subscribe((state) => this.sync(state.layers));
      this.started = true;
    }
  }

  get cesium() {
    return this.viewer;
  }

  private sync(layers: Record<string, { visible: boolean; opacity: number }>) {
    for (const [id, h] of this.handles) {
      const ui = layers[id];
      if (!ui) continue;
      this.applyVisible(h, ui.visible);
      this.applyOpacity(h, ui.opacity);
    }
  }

  private applyVisible(h: Handle, v: boolean) {
    if (h.kind === '3dtiles') h.obj.show = v;
    else if (h.kind === 'cog' || h.kind === 'imagery') h.obj.show = v;
    else h.obj.show = v;
  }

  private applyOpacity(h: Handle, o: number) {
    if (h.kind === '3dtiles') {
      // Skip styling for splat tilesets.
      if (isGaussianSplat(h.obj)) return;
      h.obj.style = new Cesium3DTileStyle({ color: `color('white', ${o})` });
    } else if (h.kind === 'cog' || h.kind === 'imagery') {
      h.obj.alpha = o;
    } else if (h.kind === 'model') {
      // Preserve the model's shading while adjusting alpha.
      h.obj.color = Color.WHITE.withAlpha(o);
      h.obj.colorBlendMode = ColorBlendMode.HIGHLIGHT;
    }
    // GeoJSON/points/CZML handle opacity elsewhere.
  }

  /** Applies an ECEF translation to a tileset. */
  applyOffset(id: string, ecefOffset: Cartesian3) {
    const h = this.handles.get(id);
    if (h?.kind !== '3dtiles') return;
    h.obj.modelMatrix = Matrix4.fromTranslation(ecefOffset);
  }

  // ---------------- loaders ----------------
  async addTileset(opts: {
    id: string; name: string; group: string; url: string;
    visible?: boolean; maximumScreenSpaceError?: number;
    // Use bare fromUrl(url) for splat tilesets.
    minimal?: boolean;
  }): Promise<Cesium3DTileset | null> {
    const store = useLayerStore.getState();
    store.upsert({ id: opts.id, name: opts.name, group: opts.group, kind: '3dtiles',
      visible: opts.visible ?? true, supportsOpacity: true, loading: true });
    try {
      const tileset = opts.minimal
        ? await Cesium3DTileset.fromUrl(opts.url)
        : await Cesium3DTileset.fromUrl(opts.url, {
            maximumScreenSpaceError: opts.maximumScreenSpaceError ?? 16,
            // Small cache to limit memory use.
            cacheBytes: 256 * 1024 * 1024,
            maximumCacheOverflowBytes: 256 * 1024 * 1024,
          });
      this.viewer.scene.primitives.add(tileset);
      tileset.show = opts.visible ?? true;
      this.handles.set(opts.id, { kind: '3dtiles', obj: tileset });
      // Hide opacity for splats.
      store.patch(opts.id, { loading: false, supportsOpacity: !isGaussianSplat(tileset) });
      return tileset;
    } catch (e) {
      store.patch(opts.id, { loading: false, error: String(e) });
      console.error(`addTileset ${opts.id} failed`, e);
      return null;
    }
  }

  async addGeoJson(opts: {
    id: string; name: string; group: string; url: string; kind?: LayerKind;
    visible?: boolean; style?: Partial<GeoJsonDataSource.LoadOptions>;
    decorate?: (ds: GeoJsonDataSource) => void;
  }): Promise<GeoJsonDataSource | null> {
    const store = useLayerStore.getState();
    store.upsert({ id: opts.id, name: opts.name, group: opts.group, kind: opts.kind ?? 'geojson',
      visible: opts.visible ?? true, supportsOpacity: false, loading: true });
    try {
      const ds = await GeoJsonDataSource.load(opts.url, { clampToGround: false, ...opts.style });
      ds.name = opts.id;
      opts.decorate?.(ds);
      await this.viewer.dataSources.add(ds);
      ds.show = opts.visible ?? true;
      this.handles.set(opts.id, { kind: (opts.kind as 'geojson') ?? 'geojson', obj: ds });
      store.patch(opts.id, { loading: false });
      return ds;
    } catch (e) {
      store.patch(opts.id, { loading: false, error: String(e) });
      console.error(`addGeoJson ${opts.id} failed`, e);
      return null;
    }
  }

  async addCzml(opts: {
    id: string; name: string; group: string; url: string; visible?: boolean;
  }): Promise<CzmlDataSource | null> {
    const store = useLayerStore.getState();
    store.upsert({ id: opts.id, name: opts.name, group: opts.group, kind: 'czml',
      visible: opts.visible ?? true, supportsOpacity: false, loading: true });
    try {
      const ds = await CzmlDataSource.load(opts.url);
      // CzmlDataSource.name is read-only.
      await this.viewer.dataSources.add(ds);
      ds.show = opts.visible ?? true;
      this.handles.set(opts.id, { kind: 'czml', obj: ds });
      store.patch(opts.id, { loading: false });
      return ds;
    } catch (e) {
      store.patch(opts.id, { loading: false, error: String(e) });
      console.error(`addCzml ${opts.id} failed`, e);
      return null;
    }
  }

  registerImagery(id: string, name: string, group: string, layer: ImageryLayer, visible = true) {
    const store = useLayerStore.getState();
    this.handles.set(id, { kind: 'cog', obj: layer });
    store.upsert({ id, name, group, kind: 'cog', visible, supportsOpacity: true, loading: false });
    layer.show = visible;
  }

  /** Replaces an imagery layer while keeping UI state. */
  replaceImagery(id: string, layer: ImageryLayer) {
    const h = this.handles.get(id);
    if (h?.kind !== 'cog' && h?.kind !== 'imagery') return;
    this.handles.set(id, { kind: h.kind, obj: layer });
    const ui = useLayerStore.getState().layers[id];
    if (ui) {
      layer.show = ui.visible;
      layer.alpha = ui.opacity;
    }
  }

  get(id: string): Handle | undefined {
    return this.handles.get(id);
  }

  getTileset(id: string): Cesium3DTileset | undefined {
    const h = this.handles.get(id);
    return h?.kind === '3dtiles' ? h.obj : undefined;
  }

  getDataSource(id: string): DataSource | undefined {
    const h = this.handles.get(id);
    return h?.kind === 'geojson' || h?.kind === 'points' || h?.kind === 'czml'
      ? (h.obj as DataSource)
      : undefined;
  }

  registerModel(id: string, name: string, group: string, model: Model, visible = true) {
    const store = useLayerStore.getState();
    this.handles.set(id, { kind: 'model', obj: model });
    store.upsert({ id, name, group, kind: 'model', visible, supportsOpacity: true, loading: false });
    model.show = visible;
  }

  async flyTo(id: string) {
    const h = this.handles.get(id);
    if (!h) return;
    if (h.kind === '3dtiles') await this.viewer.flyTo(h.obj);
    else if (h.kind === 'cog' || h.kind === 'imagery') {
      const r = h.obj.imageryProvider.rectangle;
      if (r) this.viewer.camera.flyTo({ destination: r });
    } else if (h.kind === 'model') {
      if (h.obj.boundingSphere) this.viewer.camera.flyToBoundingSphere(h.obj.boundingSphere);
    } else await this.viewer.flyTo(h.obj as DataSource);
  }
}

export const layerManager = new LayerManager();
