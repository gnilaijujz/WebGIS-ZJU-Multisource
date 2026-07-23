// Q4 split-screen compare with synced cameras.
import {
  Viewer,
  Cesium3DTileset,
  Color,
  SceneMode,
  ShadowMode,
  type Camera,
} from 'cesium';
import { layerManager } from '../../cesium/LayerManager';
import {
  installRenderErrorRecovery,
  observeViewerSize,
  safeViewerResize,
  waitForRenderableSize,
} from '../../cesium/renderSafety';
import { useLayerStore } from '../../store/layerStore';
import { useUiStore } from '../../store/uiStore';
import { ENDPOINTS } from '../../config';

type VisibilitySnapshot = Partial<Record<'osgb' | 'zju3dgs', boolean>>;

const FATAL_SHADER_ERROR = /Fragment shader failed to compile|Vertex shader failed to compile|Failed to link shader program/i;

class CompareController {
  private second: Viewer | null = null;
  private container: HTMLElement | null = null;
  private osgb: Cesium3DTileset | null = null;
  private lock = false;
  private token = 0;
  private previousVisibility: VisibilitySnapshot | null = null;
  private mainCameraPercentageChanged: number | null = null;
  private unlinkers: (() => void)[] = [];
  private renderCleanup: (() => void)[] = [];

  async enable(container: HTMLElement) {
    this.disable();
    const token = ++this.token;
    const main = layerManager.cesium;
    this.container = container;
    await waitForRenderableSize(container, 1500, 3);
    if (token !== this.token) return;

    this.renderCleanup = [this.installFatalRenderGuard(main, '主视图 3DGS')];

    // Show 3DGS on the left.
    this.rememberLayerVisibility();
    const layerStore = useLayerStore.getState();
    layerStore.setVisible('osgb', false);
    layerStore.setVisible('zju3dgs', true);

    // Build a minimal OSGB viewer.
    const second = new Viewer(container, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      animation: false,
      timeline: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: false,
      globe: false,
      skyBox: false,
      skyAtmosphere: false,
      sceneMode: SceneMode.SCENE3D,
      scene3DOnly: true,
      orderIndependentTranslucency: false,
      shouldAnimate: false,
      useDefaultRenderLoop: false,
      targetFrameRate: 30,
      showRenderLoopErrors: false,
      useBrowserRecommendedResolution: true,
      automaticallyTrackDataSourceClocks: false,
      requestRenderMode: true,
      maximumRenderTimeChange: 1,
      msaaSamples: 1,
      shadows: false,
      terrainShadows: ShadowMode.DISABLED,
      contextOptions: {
        allowTextureFilterAnisotropic: false,
        webgl: {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
          stencil: false,
        },
      },
    });
    this.configureCompareScene(second);
    second.scene.backgroundColor = Color.fromCssColorString('#0b1020');
    this.second = second;
    this.renderCleanup.push(
      observeViewerSize(second, container),
      installRenderErrorRecovery(second, container),
      this.installFatalRenderGuard(second, '右侧 OSGB 对比视图'),
    );

    
    this.copyCamera(main.camera, second.camera);
    safeViewerResize(second, container);
    try {
      this.osgb = await Cesium3DTileset.fromUrl(ENDPOINTS.tilesetOsgb, {
        maximumScreenSpaceError: 24,
        cacheBytes: 128 * 1024 * 1024,
        maximumCacheOverflowBytes: 128 * 1024 * 1024,
        dynamicScreenSpaceError: true,
        progressiveResolutionHeightFraction: 0.5,
        cullRequestsWhileMoving: true,
        cullRequestsWhileMovingMultiplier: 80,
        skipLevelOfDetail: true,
        baseScreenSpaceError: 1024,
        skipScreenSpaceErrorFactor: 16,
        skipLevels: 1,
        immediatelyLoadDesiredLevelOfDetail: false,
        loadSiblings: false,
        shadows: ShadowMode.DISABLED,
      });
      if (token !== this.token || this.second !== second || second.isDestroyed()) {
        if (!this.osgb.isDestroyed()) this.osgb.destroy();
        this.osgb = null;
        return;
      }
      second.scene.primitives.add(this.osgb);
      second.scene.requestRender();
    } catch (e) {
      console.error('compare: OSGB load failed', e);
    }

    // Link cameras both ways.
    this.copyCamera(main.camera, second.camera);
    second.scene.requestRender();
    this.mainCameraPercentageChanged = main.camera.percentageChanged;
    main.camera.percentageChanged = 0.002;
    second.camera.percentageChanged = 0.002;
    this.unlinkers.push(this.link(main.camera, second.camera, second));
    this.unlinkers.push(this.link(second.camera, main.camera, main));
  }

  private link(from: Camera, to: Camera, targetViewer: Viewer): () => void {
    const handler = () => {
      if (this.lock) return;
      this.lock = true;
      this.copyCamera(from, to);
      targetViewer.scene.requestRender();
      this.lock = false;
    };
    const remove = from.changed.addEventListener(handler);
    return remove;
  }

  private copyCamera(from: Camera, to: Camera) {
    to.setView({
      destination: from.positionWC.clone(),
      orientation: {
        heading: from.heading,
        pitch: from.pitch,
        roll: from.roll,
      },
    });
  }

  private configureCompareScene(viewer: Viewer) {
    viewer.scene.highDynamicRange = false;
    viewer.scene.postProcessStages.fxaa.enabled = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.sunBloom = false;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    viewer.scene.requestRender();
  }

  private rememberLayerVisibility() {
    const layers = useLayerStore.getState().layers;
    this.previousVisibility = {
      osgb: layers.osgb?.visible,
      zju3dgs: layers.zju3dgs?.visible,
    };
  }

  private restoreLayerVisibility() {
    if (!this.previousVisibility) return;
    const store = useLayerStore.getState();
    if (this.previousVisibility.osgb !== undefined) store.setVisible('osgb', this.previousVisibility.osgb);
    if (this.previousVisibility.zju3dgs !== undefined) store.setVisible('zju3dgs', this.previousVisibility.zju3dgs);
    this.previousVisibility = null;
  }

  private installFatalRenderGuard(viewer: Viewer, label: string): () => void {
    let handled = false;
    const remove = viewer.scene.renderError.addEventListener((_scene, error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (handled || !FATAL_SHADER_ERROR.test(message)) return;
      handled = true;
      console.warn(`compare: ${label} shader failed; leaving split-screen compare.`, error);
      window.setTimeout(() => {
        useUiStore.getState().setCompare(false);
        safeViewerResize(layerManager.cesium, layerManager.cesium.container as HTMLElement);
      }, 0);
    });
    return remove;
  }

  disable() {
    this.token += 1;
    for (const u of this.unlinkers) u();
    this.unlinkers = [];
    for (const cleanup of this.renderCleanup) cleanup();
    this.renderCleanup = [];
    if (this.second) {
      this.second.destroy();
      this.second = null;
    }
    this.container = null;
    this.osgb = null;
    this.restoreLayerVisibility();
    const main = layerManager.cesium;
    if (this.mainCameraPercentageChanged !== null) {
      main.camera.percentageChanged = this.mainCameraPercentageChanged;
      this.mainCameraPercentageChanged = null;
    }
    safeViewerResize(main, main.container as HTMLElement);
  }

  /** Resize the second viewer. */
  resize() {
    safeViewerResize(this.second, this.container);
  }
}

export const compareController = new CompareController();
