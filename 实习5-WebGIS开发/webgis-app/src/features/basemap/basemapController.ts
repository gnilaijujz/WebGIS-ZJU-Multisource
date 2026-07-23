// Basemap switching while keeping the COG above it.
import { message } from 'antd';
import { layerManager } from '../../cesium/LayerManager';
import { makeBaseLayers, type BasemapKind } from '../../cesium/viewer';
import { getTiandituToken, saveTiandituToken, CESIUM_ION_TOKEN } from '../../config';
import type { ImageryLayer } from 'cesium';

class BasemapController {
  private layers: ImageryLayer[] = [];
  private kind: BasemapKind = 'cesium-img';

  get current(): BasemapKind {
    return this.kind;
  }

  set(kind: BasemapKind): boolean {
    if (kind === 'tianditu-img' && !this.ensureTiandituToken()) {
      return false;
    }
    if (kind === 'cesium-img' && !CESIUM_ION_TOKEN) {
      message.warning('未配置 Cesium Ion Token（.env.local: VITE_CESIUM_ION_TOKEN）');
      return false;
    }
    this.kind = kind;
    const stack = layerManager.cesium.imageryLayers;
    for (const l of this.layers) stack.remove(l, true);
    this.layers = [];
    // Keep basemaps below the COG.
    const layers = makeBaseLayers(kind);
    let index = 0;
    for (const l of layers) {
      stack.add(l, index++);
      this.layers.push(l);
    }
    return true;
  }

  private ensureTiandituToken(): boolean {
    const currentToken = getTiandituToken();
    const token = window.prompt(
      '天地图底图需要服务密钥 tk。',
      currentToken || '',
    );
    const nextToken = token?.trim() || currentToken;
    if (!nextToken) {
      message.warning('未配置天地图 tk，已保留当前底图');
      return false;
    }
    if (nextToken !== currentToken) {
      saveTiandituToken(nextToken);
      message.success('天地图 tk 已保存到当前浏览器');
    }
    return true;
  }
}

export const basemapController = new BasemapController();
