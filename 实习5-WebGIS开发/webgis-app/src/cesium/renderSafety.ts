import type { Viewer } from 'cesium';

const ZERO_SIZE_RENDER_ERROR = /Expected (width|height) to be greater than 0/i;

export function hasRenderableSize(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1;
}

export function safeViewerResize(viewer: Viewer | null | undefined, element?: HTMLElement | null): boolean {
  if (!viewer || viewer.isDestroyed()) return false;
  const target = element ?? (viewer.container as HTMLElement);
  if (!hasRenderableSize(target)) return false;
  viewer.resize();
  if (!viewer.useDefaultRenderLoop) viewer.useDefaultRenderLoop = true;
  viewer.scene.requestRender();
  return true;
}

export function installRenderErrorRecovery(viewer: Viewer, element?: HTMLElement | null): () => void {
  let queued = false;

  const recover = () => {
    if (viewer.isDestroyed()) return;
    if (safeViewerResize(viewer, element ?? (viewer.container as HTMLElement))) return;
    window.setTimeout(recover, 120);
  };

  const handler = (_scene: unknown, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!ZERO_SIZE_RENDER_ERROR.test(message) || queued) return;
    queued = true;
    console.warn('Cesium render stopped by a transient zero-size canvas; scheduling resize recovery.', error);
    window.setTimeout(() => {
      queued = false;
      recover();
    }, 120);
  };

  return viewer.scene.renderError.addEventListener(handler);
}

export function observeViewerSize(viewer: Viewer, element: HTMLElement): () => void {
  let frame: number | null = null;

  const apply = () => {
    frame = null;
    if (viewer.isDestroyed()) return;
    if (hasRenderableSize(element)) {
      safeViewerResize(viewer, element);
    } else {
      viewer.useDefaultRenderLoop = false;
    }
  };

  const queue = () => {
    if (frame != null) return;
    frame = window.requestAnimationFrame(apply);
  };

  const observer = new ResizeObserver(queue);
  observer.observe(element);
  window.addEventListener('resize', queue);
  queue();

  return () => {
    if (frame != null) window.cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('resize', queue);
  };
}

export function waitForRenderableSize(element: HTMLElement, timeoutMs = 1000, stableFrames = 2): Promise<boolean> {
  const started = performance.now();
  let stable = 0;
  return new Promise((resolve) => {
    const tick = () => {
      if (hasRenderableSize(element)) {
        stable += 1;
        if (stable >= stableFrames) {
          resolve(true);
          return;
        }
      } else {
        stable = 0;
      }
      if (performance.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}
