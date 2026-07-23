import { useEffect, useRef, useState } from 'react';
import { Button, Tooltip, Select } from 'antd';
import { HomeOutlined, SplitCellsOutlined, AimOutlined } from '@ant-design/icons';
import type { Viewer } from 'cesium';
import { createViewer, flyHome, BASEMAP_OPTIONS, type BasemapKind } from './cesium/viewer';
import { layerManager } from './cesium/LayerManager';
import { initScene } from './cesium/initScene';
import { installRenderErrorRecovery, observeViewerSize, safeViewerResize } from './cesium/renderSafety';
import { queryController } from './features/query/queryController';
import { basemapController } from './features/basemap/basemapController';
import { useUiStore } from './store/uiStore';
import LayerPanel from './components/LayerPanel';
import RightDock from './components/RightDock';
import QueryResult from './components/QueryResult';
import CompareView from './components/CompareView';
import RegistrationPanel from './components/RegistrationPanel';
import './App.css';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [ready, setReady] = useState(false);
  const compareOn = useUiStore((s) => s.compareOn);
  const setCompare = useUiStore((s) => s.setCompare);
  const registrationOpen = useUiStore((s) => s.registrationOpen);
  const setRegistration = useUiStore((s) => s.setRegistration);
  // Default basemap.
  const [basemap, setBasemap] = useState<BasemapKind>('cesium-img');

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    const container = containerRef.current;
    const viewer = createViewer(container);
    const stopSizeObserver = observeViewerSize(viewer, container);
    const stopRenderRecovery = installRenderErrorRecovery(viewer, container);
    viewerRef.current = viewer;
    layerManager.init(viewer);
    basemapController.set('cesium-img');
    queryController.init(viewer);
    initScene().then(() => setReady(true));
    return () => {
      stopSizeObserver();
      stopRenderRecovery();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Resize after compare mode changes.
  useEffect(() => {
    const t = window.setTimeout(() => safeViewerResize(viewerRef.current, containerRef.current), 80);
    return () => window.clearTimeout(t);
  }, [compareOn]);

  return (
    <div className={`app-root ${compareOn ? 'compare-mode' : ''}`}>
      <div className="compare-left">
        <div ref={containerRef} className="cesium-container" />
        {compareOn && <div className="compare-badge compare-badge-left">三维高斯泼溅 3DGS</div>}
      </div>
      {compareOn && <CompareView />}

      <header className="app-header">
        <span className="app-title">多源数据 WebGIS · 浙大紫金港校区</span>
        <div className="app-header-actions">
          <Select
            size="small"
            value={basemap}
            onChange={(v) => {
              if (basemapController.set(v)) setBasemap(v);
            }}
            options={BASEMAP_OPTIONS}
            style={{ width: 104 }}
          />
          <Tooltip title="3DGS / 倾斜摄影 分屏对比（相机联动）">
            <Button
              size="small"
              type={compareOn ? 'primary' : 'default'}
              icon={<SplitCellsOutlined />}
              onClick={() => setCompare(!compareOn)}
            >
              分屏对比
            </Button>
          </Tooltip>
          <Tooltip title="三维模型配准微调">
            <Button
              size="small"
              type={registrationOpen ? 'primary' : 'default'}
              icon={<AimOutlined />}
              onClick={() => setRegistration(!registrationOpen)}
            >
              模型配准
            </Button>
          </Tooltip>
          <Tooltip title="回到初始视角">
            <Button
              size="small"
              icon={<HomeOutlined />}
              onClick={() => viewerRef.current && flyHome(viewerRef.current)}
            >
              初始视角
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className="left-dock">
        <LayerPanel />
      </div>

      <RightDock />
      <QueryResult />
      {registrationOpen && <RegistrationPanel />}

      {!ready && <div className="loading-badge">场景加载中…</div>}
    </div>
  );
}
