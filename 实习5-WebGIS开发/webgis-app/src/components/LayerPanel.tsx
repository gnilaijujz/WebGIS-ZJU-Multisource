import { Switch, Slider, Button, Collapse, Tooltip, Spin } from 'antd';
import { AimOutlined, WarningOutlined } from '@ant-design/icons';
import { useLayerStore, type LayerUI } from '../store/layerStore';
import { layerManager } from '../cesium/LayerManager';

function LayerRow({ l }: { l: LayerUI }) {
  const setVisible = useLayerStore((s) => s.setVisible);
  const setOpacity = useLayerStore((s) => s.setOpacity);
  return (
    <div className="layer-row">
      <div className="layer-row-top">
        <Switch size="small" checked={l.visible} onChange={(v) => setVisible(l.id, v)} disabled={l.loading} />
        <span className="layer-name" title={l.name}>
          {l.name}
          {l.loading && <Spin size="small" style={{ marginLeft: 6 }} />}
          {l.error && (
            <Tooltip title={l.error}>
              <WarningOutlined style={{ color: '#faad14', marginLeft: 6 }} />
            </Tooltip>
          )}
        </span>
        <Tooltip title="定位到此图层">
          <Button
            size="small"
            type="text"
            icon={<AimOutlined />}
            onClick={() => layerManager.flyTo(l.id)}
            disabled={l.loading}
          />
        </Tooltip>
      </div>
      {l.supportsOpacity && (
        <div className="layer-row-opacity">
          <span>透明度</span>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={l.opacity}
            onChange={(v) => setOpacity(l.id, v as number)}
            tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function LayerPanel() {
  const order = useLayerStore((s) => s.order);
  const layers = useLayerStore((s) => s.layers);

  // Group by `group`.
  const groups: Record<string, LayerUI[]> = {};
  for (const id of order) {
    const l = layers[id];
    if (!l) continue;
    (groups[l.group] ||= []).push(l);
  }

  const items = Object.entries(groups).map(([group, ls]) => ({
    key: group,
    label: `${group} (${ls.length})`,
    children: ls.map((l) => <LayerRow key={l.id} l={l} />),
  }));

  return (
    <div className="layer-panel">
      <div className="panel-title">图层管理</div>
      <Collapse items={items} defaultActiveKey={Object.keys(groups)} size="small" ghost />
    </div>
  );
}
