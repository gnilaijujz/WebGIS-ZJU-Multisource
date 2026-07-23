// Q8 2DGS mesh overlay and georeferencing.
import {
  Model,
  Transforms,
  Matrix4,
  Matrix3,
  Cartesian2,
  Cartesian3,
  HeadingPitchRoll,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Color,
  defined,
  Entity,
  Math as CesiumMath,
} from 'cesium';
import { layerManager } from '../../cesium/LayerManager';
import { useLayerStore } from '../../store/layerStore';
import { useGeorefStore } from './georefStore';
import { AREA_CENTER } from '../../config';

const GLB_URL = '/models/mesh_2dgs_v8.glb';
const BASE = Transforms.eastNorthUpToFixedFrame(
  Cartesian3.fromDegrees(AREA_CENTER.lon, AREA_CENTER.lat, 14),
);
interface Placement {
  e: number;
  n: number;
  u: number;
  heading: number; // degrees
  scale: number;
}

class MeshController {
  private model: Model | null = null;
  private loaded = false;
  // Default scale keeps it campus-sized.
  private placement: Placement = { e: 0, n: 0, u: 0, heading: 0, scale: 50 };
  private georefMatrix: Matrix4 | null = null


  private grHandler: ScreenSpaceEventHandler | null = null;
  private grPairs: { local: Cartesian3; ecef: Cartesian3 }[] = [];
  private grPending: Cartesian3 | null = null;
  private grMarkers: Entity[] = [];

  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const model = await Model.fromGltfAsync({
        url: GLB_URL,
        modelMatrix: this.computeMatrix(),
        // GLB is Y-up for Cesium.
      });
      layerManager.cesium.scene.primitives.add(model);
      this.model = model;
      layerManager.registerModel('mesh2dgs', '2DGS 表面网格', '三维模型', model, false);

    } catch (e) {
      console.error('mesh2dgs load failed', e);
    }
  }

  private computeMatrix(): Matrix4 {
    const { e, n, u, heading, scale } = this.placement;
    const translate = Matrix4.fromTranslation(new Cartesian3(e, n, u));
    const rot = Matrix4.fromRotationTranslation(
      Matrix3.fromHeadingPitchRoll(new HeadingPitchRoll(CesiumMath.toRadians(heading), 0, 0)),
    );
    const s = Matrix4.fromUniformScale(scale);
    // BASE * translate * rotation * scale
    const m = Matrix4.multiply(BASE, translate, new Matrix4());
    Matrix4.multiply(m, rot, m);
    Matrix4.multiply(m, s, m);
    return m;
  }

  setPlacement(p: Partial<Placement>) {
    this.placement = { ...this.placement, ...p };
    this.georefMatrix = null; // manual edit discards a solved georeference
    if (this.model) this.model.modelMatrix = this.computeMatrix();
  }

  getPlacement(): Placement {
    return this.placement;
  }


  /** Start georef mode without moving the camera. */
  beginGeoref() {
    if (!this.model) return;
    this.grPairs = [];
    this.grPending = null;
    this.grMarkers = [];
    useLayerStore.getState().setVisible('mesh2dgs', true);
    this.model.show = true;
    useGeorefStore.getState().set({ active: true, pairs: 0, pending: false, rmse: null });

    const viewer = layerManager.cesium;
    this.grHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    this.grHandler.setInputAction(
      (e: ScreenSpaceEventHandler.PositionedEvent) => this.onGeorefClick(e.position),
      ScreenSpaceEventType.LEFT_CLICK,
    );
  }

  private onGeorefClick(pos: Cartesian2) {
    if (!this.model) return;
    const viewer = layerManager.cesium;
    const world = viewer.scene.pickPosition(pos);
    if (!defined(world)) return;

    if (!this.grPending) {
      // Pick a point on the mesh.
      const picked = viewer.scene.pick(pos);
      const onMesh = defined(picked) && (picked as { primitive?: unknown }).primitive === this.model;
      if (!onMesh) return
      const inv = Matrix4.inverse(this.model.modelMatrix, new Matrix4());
      this.grPending = Matrix4.multiplyByPoint(inv, world, new Cartesian3());
      this.addMarker(world, Color.YELLOW);
      this.model.show = false; // Let the next click hit the ground.
      useGeorefStore.getState().set({ pending: true });
    } else {
      // Pick the matching ground point.
      this.grPairs.push({ local: this.grPending, ecef: world.clone() });
      this.grPending = null;
      this.addMarker(world, Color.CYAN);
      this.model.show = true; // restore the mesh for the next pair
      useGeorefStore.getState().set({ pairs: this.grPairs.length, pending: false });
    }
  }

  private addMarker(pos: Cartesian3, color: Color) {
    const ent = layerManager.cesium.entities.add({
      position: pos,
      point: {
        pixelSize: 12,
        color,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    this.grMarkers.push(ent);
  }

  private clearMarkers() {
    const viewer = layerManager.cesium;
    for (const e of this.grMarkers) viewer.entities.remove(e);
    this.grMarkers = [];
  }

  /** Solve yaw + scale + translation from the picked pairs. */
  solveGeoref(): { rmse: number } | null {
    if (this.grPairs.length < 3 || !this.model) return null;
    const invBase = Matrix4.inverse(BASE, new Matrix4());
    const L = this.grPairs.map((p) => p.local)
    const P = this.grPairs.map((p) => Matrix4.multiplyByPoint(invBase, p.ecef, new Cartesian3()))
    const n = L.length;

    let muLx = 0, muLy = 0, muLz = 0, muPx = 0, muPy = 0, muPz = 0;
    for (let i = 0; i < n; i++) {
      muLx += L[i].x; muLy += L[i].y; muLz += L[i].z;
      muPx += P[i].x; muPy += P[i].y; muPz += P[i].z;
    }
    muLx /= n; muLy /= n; muLz /= n; muPx /= n; muPy /= n; muPz /= n;

    // Fit in the horizontal plane.
    let a = 0, b = 0, varL = 0;
    for (let i = 0; i < n; i++) {
      const lx = L[i].x - muLx, ly = L[i].y - muLy;
      const px = P[i].x - muPx, py = P[i].y - muPy;
      a += lx * px + ly * py;
      b += lx * py - ly * px;
      varL += lx * lx + ly * ly;
    }
    const theta = Math.atan2(b, a);
    const s = Math.hypot(a, b) / (varL || 1);
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const e = muPx - s * (cos * muLx - sin * muLy);
    const north = muPy - s * (sin * muLx + cos * muLy);
    const u = muPz - s * muLz; // Vertical stays translation + scale.

    // Compose the final transform.
    const M = Matrix4.multiply(BASE, Matrix4.fromTranslation(new Cartesian3(e, north, u)), new Matrix4());
    Matrix4.multiply(M, Matrix4.fromRotationTranslation(Matrix3.fromRotationZ(theta)), M);
    Matrix4.multiply(M, Matrix4.fromUniformScale(s), M);
    this.georefMatrix = M;
    this.model.modelMatrix = M.clone();

    let sse = 0;
    for (let i = 0; i < n; i++) {
      const px = s * (cos * L[i].x - sin * L[i].y) + e;
      const py = s * (sin * L[i].x + cos * L[i].y) + north;
      const pz = s * L[i].z + u;
      sse += (px - P[i].x) ** 2 + (py - P[i].y) ** 2 + (pz - P[i].z) ** 2;
    }
    const rmse = Math.sqrt(sse / n);
    useGeorefStore.getState().set({ rmse });
    return { rmse };
  }

  /** Exit georef mode. */
  endGeoref(keep = true) {
    if (this.grHandler) {
      this.grHandler.destroy();
      this.grHandler = null;
    }
    this.clearMarkers();
    this.grPending = null;
    if (this.model) {
      this.model.show = true;
      this.model.modelMatrix = keep && this.georefMatrix ? this.georefMatrix.clone() : this.computeMatrix();
    }
    useGeorefStore.getState().set({ active: false, pending: false });
  }

  resetGeorefPairs() {
    this.grPairs = [];
    this.grPending = null;
    this.clearMarkers();
    if (this.model) this.model.show = true
    useGeorefStore.getState().set({ pairs: 0, pending: false, rmse: null });
  }
}

export const meshController = new MeshController();
