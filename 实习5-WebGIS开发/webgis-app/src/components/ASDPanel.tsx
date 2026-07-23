import { useEffect, useMemo, useState } from 'react';
import { Select, Switch, Image, Empty, Tag, Spin, Segmented } from 'antd';
import { LOCAL } from '../config';
import { useQueryStore } from '../features/query/queryStore';
import SpectralChart, { type SpectralSeries } from './SpectralChart';

interface AsdSample {
  id: number;
  label: string;
  category: string | null;
  photo: string | null;
  range: [number, number];
  wavelengths: number[];
  reflectance: number[];
}

const PALETTE = ['#51cf66', '#ffd43b', '#ff922b', '#4dabf7', '#f06595', '#845ef7', '#22b8cf', '#e8a87c'];
const ASD_WL_MIN = 350;
const ASD_WL_MAX = 2500;
const COG_WL_MIN = 389.764;
const COG_WL_MAX = 1029.634;
const FOCUS_RANGE: [number, number] = [400, 1000];
const FULL_RANGE: [number, number] = [ASD_WL_MIN, ASD_WL_MAX];
type RangeMode = 'focus' | 'full';

// Downsample the ASD curve for the chart.
function downsample(wl: number[], rf: number[], step = 5): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < wl.length; i += step) out.push([wl[i], rf[i]]);
  return out;
}

export default function ASDPanel() {
  const [samples, setSamples] = useState<AsdSample[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [showHyper, setShowHyper] = useState(true);
  const [rangeMode, setRangeMode] = useState<RangeMode>('focus');
  const pixel = useQueryStore((s) => s.pixel);

  useEffect(() => {
    fetch(LOCAL.asdSpectra)
      .then((r) => r.json())
      .then((d: { samples: AsdSample[] }) => {
        const labelled = d.samples.filter((s) => s.category);
        setSamples(labelled);
        // Default to grass, sand, and asphalt.
        const pick = labelled
          .filter((s) => ['草地', '沙地', '柏油路面'].includes(s.label))
          .map((s) => s.id);
        setSelected(pick.length ? pick : labelled.slice(0, 2).map((s) => s.id));
      });
  }, []);

  const series = useMemo<SpectralSeries[]>(() => {
    if (!samples) return [];
    const list: SpectralSeries[] = selected.map((id, i) => {
      const s = samples.find((x) => x.id === id)!;
      return {
        name: s.label,
        color: PALETTE[i % PALETTE.length],
        data: downsample(s.wavelengths, s.reflectance),
      };
    });
    // Overlay the queried hyperspectral spectrum.
    if (showHyper && pixel?.spectrum) {
      const n = pixel.spectrum.length;
      list.push({
        name: '高光谱像元(波段映射)',
        color: '#ff6b6b',
        data: pixel.spectrum.map((v, i) => [
          COG_WL_MIN + ((COG_WL_MAX - COG_WL_MIN) * i) / (n - 1),
          v,
        ]),
      });
    }
    return list;
  }, [samples, selected, showHyper, pixel]);

  if (!samples) return <div className="charts-loading"><Spin /></div>;

  const selectedSamples = selected
    .map((id) => samples.find((s) => s.id === id))
    .filter((s): s is AsdSample => !!s);
  const xRange = rangeMode === 'focus' ? FOCUS_RANGE : FULL_RANGE;
  const chartSeries = series.map((s) => ({
    ...s,
    data: s.data.filter(([x]) => x >= xRange[0] && x <= xRange[1]),
  }));

  return (
    <div className="asd-panel">
      <p className="hint">
        ASD 地物光谱仪野外实测反射率（350–2500 nm，25 条 / 23 类）。可多选叠加对比，并与查询到的
        航空高光谱像元曲线做<b>地面—航空对照</b>。
      </p>

      <div className="row">
        <span className="lbl">地物</span>
        <Select
          className="grow"
          mode="multiple"
          size="small"
          maxTagCount="responsive"
          value={selected}
          onChange={setSelected}
          options={samples.map((s) => ({ label: s.label, value: s.id }))}
          placeholder="选择地物类别"
        />
      </div>

      <div className="row">
        <span className="lbl">范围</span>
        <Segmented
          size="small"
          value={rangeMode}
          onChange={(v) => setRangeMode(v as RangeMode)}
          options={[
            { label: '400-1000 nm', value: 'focus' },
            { label: '350-2500 nm', value: 'full' },
          ]}
        />
      </div>

      <div className="row">
        <Switch size="small" checked={showHyper} onChange={setShowHyper} disabled={!pixel?.spectrum} />
        <span className="hint">
          叠加高光谱像元曲线{' '}
          {pixel?.spectrum ? (
            <Tag color="red">已查询</Tag>
          ) : (
            <span style={{ color: '#7f8ea8' }}>（先在地图上点击高光谱区域）</span>
          )}
        </span>
      </div>

      <SpectralChart series={chartSeries} xName="波长 (nm)" height={230} xRange={xRange} />
      <p className="hint" style={{ marginTop: -4 }}>
        注：默认聚焦 400-1000 nm，可见光-近红外段更容易看出植被、土壤、道路等地物差异。本高光谱
        150 波段覆盖约 389.8-1029.6 nm；红色曲线按该范围映射到 ASD 波长轴，用于地面-航空曲线形态对照。
      </p>

      {selectedSamples.length > 0 && (
        <div className="asd-photos">
          {selectedSamples.map((s) =>
            s.photo ? (
              <div className="asd-photo-item" key={s.id}>
                <Image src={s.photo} alt={s.label} height={64} style={{ borderRadius: 4, objectFit: 'cover' }} />
                <span>{s.label}</span>
              </div>
            ) : null,
          )}
        </div>
      )}

      {selectedSamples.length === 0 && <Empty description="请选择地物类别" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    </div>
  );
}
