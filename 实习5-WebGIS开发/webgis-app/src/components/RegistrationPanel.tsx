import { useRef, useState } from 'react';
import { Slider, Button, Select, InputNumber, Divider } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
import { Cartesian3, Matrix4, Transforms } from 'cesium';
import { layerManager } from '../cesium/LayerManager';
import { meshController } from '../features/mesh/meshController';
import { vectorRegistration } from '../features/registration/vectorRegistration';
import { useUiStore } from '../store/uiStore';
import { AREA_CENTER } from '../config';
import GeorefPanel from './GeorefPanel';

// ENU nudge for registration.
const CENTER = Cartesian3.fromDegrees(AREA_CENTER.lon, AREA_CENTER.lat, 14);
const ENU = Transforms.eastNorthUpToFixedFrame(CENTER);

function enuToEcef(e: number, n: number, u: number): Cartesian3 {
  const local = new Cartesian3(e, n, u);
  return Matrix4.multiplyByPointAsVector(ENU, local, new Cartesian3());
}

export default function RegistrationPanel() {
  const setRegistration = useUiStore((s) => s.setRegistration);
  const [target, setTarget] = useState('osgb');
  const [enu, setEnu] = useState({ e: 0, n: 0, u: 0 });
  const [heading, setHeading] = useState(0);
  const [scale, setScale] = useState(1);

  // Drag the title bar.
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const startDrag = (e: React.MouseEvent) => {
    const rect = panelRef.current!.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const oL = rect.left;
    const oT = rect.top;
    const move = (ev: MouseEvent) =>
      setPos({
        left: Math.max(0, Math.min(window.innerWidth - 80, oL + ev.clientX - sx)),
        top: Math.max(0, Math.min(window.innerHeight - 40, oT + ev.clientY - sy)),
      });
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
  };

  const isMesh = target === 'mesh2dgs';
  const isVectors = target === 'vectors';
  const range = isMesh ? 150 : 100; // Wider range for the mesh.

  const applyEnu = (next: { e: number; n: number; u: number }) => {
    setEnu(next);
    if (isMesh) meshController.setPlacement({ ...next, heading, scale });
    else if (isVectors) vectorRegistration.setOffset(enuToEcef(next.e, next.n, next.u));
    else layerManager.applyOffset(target, enuToEcef(next.e, next.n, next.u));
  };

  const switchTarget = (t: string) => {
    setTarget(t);
    if (t === 'mesh2dgs') {
      const p = meshController.getPlacement();
      setEnu({ e: p.e, n: p.n, u: p.u });
      setHeading(p.heading);
      setScale(p.scale);
    } else {
      setEnu({ e: 0, n: 0, u: 0 });
    }
  };

  const reset = () => {
    setHeading(0);
    setScale(1);
    if (isMesh) meshController.setPlacement({ e: 0, n: 0, u: 0, heading: 0, scale: 1 });
    else if (isVectors) vectorRegistration.setOffset(new Cartesian3(0, 0, 0));
    else layerManager.applyOffset(target, new Cartesian3(0, 0, 0));
    setEnu({ e: 0, n: 0, u: 0 });
  };

  const axis = (key: 'e' | 'n' | 'u', label: string) => (
    <div className="row">
      <span className="lbl">{label}</span>
      <Slider
        className="grow"
        min={-range}
        max={range}
        step={0.5}
        value={enu[key]}
        onChange={(v) => applyEnu({ ...enu, [key]: v as number })}
      />
      <InputNumber
        size="small"
        min={-range}
        max={range}
        step={0.5}
        value={enu[key]}
        onChange={(v) => applyEnu({ ...enu, [key]: v ?? 0 })}
        style={{ width: 68 }}
      />
    </div>
  );

  return (
    <div
      ref={panelRef}
      className="registration-panel"
      style={pos ? { left: pos.left, top: pos.top, transform: 'none' } : undefined}
    >
      <div className="query-head reg-drag" onMouseDown={startDrag}>
        <span className="query-title">
          <HolderOutlined style={{ marginRight: 6, opacity: 0.6 }} />
          三维模型配准微调
        </span>
        <Button size="small" type="text" onClick={() => setRegistration(false)}>
          收起
        </Button>
      </div>
      <div className="reg-body">
        <div className="row">
          <span className="lbl">对象</span>
          <Select
            className="grow"
            size="small"
            value={target}
            onChange={switchTarget}
            options={[
              { label: '倾斜摄影 (OSGB)', value: 'osgb' },
              { label: '矢量测量组 (RTK/拍摄点/航线)', value: 'vectors' },
              { label: '三维高斯泼溅 (3DGS)', value: 'zju3dgs' },
              { label: '2DGS 表面网格', value: 'mesh2dgs' },
            ]}
          />
        </div>
        {axis('e', '东 (m)')}
        {axis('n', '北 (m)')}
        {axis('u', '天 (m)')}

        {isMesh && (
          <>
            <div className="row">
              <span className="lbl">朝向°</span>
              <Slider
                className="grow"
                min={0}
                max={360}
                step={1}
                value={heading}
                onChange={(v) => {
                  setHeading(v as number);
                  meshController.setPlacement({ ...enu, heading: v as number, scale });
                }}
              />
              <InputNumber size="small" min={0} max={360} value={heading} style={{ width: 68 }}
                onChange={(v) => { setHeading(v ?? 0); meshController.setPlacement({ ...enu, heading: v ?? 0, scale }); }} />
            </div>
            <div className="row">
              <span className="lbl">缩放</span>
              <Slider
                className="grow"
                min={1}
                max={150}
                step={1}
                value={scale}
                onChange={(v) => {
                  setScale(v as number);
                  meshController.setPlacement({ ...enu, heading, scale: v as number });
                }}
              />
              <InputNumber size="small" min={1} max={150} step={1} value={scale} style={{ width: 68 }}
                onChange={(v) => { setScale(v ?? 1); meshController.setPlacement({ ...enu, heading, scale: v ?? 1 }); }} />
            </div>
          </>
        )}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="hint">
            {isMesh
              ? '手动摆放：拖动滑块粗对齐；或用下方“交互配准”精确对齐。'
              : isVectors
                ? 'RTK/拍摄点/航线为真实测量坐标，与卫星底图有系统偏差。拖动东/北使其对齐到底图/3DGS。'
                : '以底图/3DGS 为基准，拖动东/北使 OSGB 与之重合。'}
          </span>
          <Button size="small" onClick={reset}>
            归零
          </Button>
        </div>

        {isMesh && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <GeorefPanel />
          </>
        )}
      </div>
    </div>
  );
}
