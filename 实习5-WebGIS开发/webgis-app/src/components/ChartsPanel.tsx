import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { LOCAL } from '../config';

interface Agg {
  cats: { name: string; area: number; group: string }[];
  alts: number[];
  errs: number[];
  gcp: { id: string; dataset: string; err: number }[];
}

const GROUP_COLOR: Record<string, string> = {
  植被: '#51cf66',
  人造地物: '#4dabf7',
  土壤: '#e8a87c',
  水体: '#22b8cf',
  其他: '#adb5bd',
};

const GCP_COLOR: Record<string, string> = {
  '3DGS': '#ff4d4f',
  OSGB: '#22b8cf',
};

function topGroup(cat: string): string {
  const g = cat.split('——')[0];
  return GROUP_COLOR[g] ? g : '其他';
}

export default function ChartsPanel() {
  const [data, setData] = useState<Agg | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rtk, photos, gcp3dgs, gcpOsgb] = await Promise.all([
        fetch(LOCAL.rtkArea).then((r) => r.json()),
        fetch(LOCAL.photoPoints).then((r) => r.json()),
        fetch(LOCAL.gcp3dgsPoints).then((r) => r.json()),
        fetch(LOCAL.gcpOsgbPoints).then((r) => r.json()),
      ]);
      // RTK area by class
      const map = new Map<string, number>();
      for (const f of rtk.features) {
        const c = (f.properties['地物类'] as string) || '未分类';
        map.set(c, (map.get(c) ?? 0) + (f.properties.Shape_Area ?? 0));
      }
      const cats = [...map.entries()]
        .map(([name, area]) => ({ name, area, group: topGroup(name) }))
        .sort((a, b) => b.area - a.area);
      // Flight altitude and error profile
      const feats = [...photos.features].sort(
        (a, b) => (a.properties.index ?? 0) - (b.properties.index ?? 0),
      );
      const alts = feats.map((f) => f.properties.altitude ?? f.geometry.coordinates[2] ?? 0);
      const errs = feats.map((f) => (f.properties.error_m ?? 0) * 100)
      // GCP model-point errors.
      const gcpPts = [...gcp3dgs.features, ...gcpOsgb.features]
        .filter((f: { properties: { kind: string } }) => f.properties.kind === 'model')
        .map((f: { properties: { id: string; dataset: string; error: number } }) => ({
          id: f.properties.id,
          dataset: f.properties.dataset,
          err: f.properties.error ?? 0,
        }));
      if (!cancelled) setData({ cats, alts, errs, gcp: gcpPts });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <div className="charts-loading"><Spin /></div>;

  const areaOption = {
    grid: { left: 8, right: 16, top: 10, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => `${v.toFixed(0)} ㎡` },
    xAxis: { type: 'value', axisLabel: { color: '#8aa', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: data.cats.map((c) => c.name),
      axisLabel: { color: '#cdd8ea', fontSize: 10 },
    },
    series: [
      {
        type: 'bar',
        data: data.cats.map((c) => ({ value: c.area, itemStyle: { color: GROUP_COLOR[c.group] } })),
        barMaxWidth: 14,
        label: { show: true, position: 'right', color: '#8aa', fontSize: 9, formatter: (p: { value: number }) => p.value.toFixed(0) },
      },
    ],
  };

  const altOption = {
    grid: { left: 40, right: 40, top: 20, bottom: 24 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#cdd8ea', fontSize: 10 } },
    xAxis: { type: 'category', name: '曝光序号', nameTextStyle: { color: '#8aa', fontSize: 9 }, axisLabel: { color: '#8aa', fontSize: 9 }, boundaryGap: false },
    yAxis: [
      { type: 'value', name: '高程 m', scale: true, nameTextStyle: { color: '#8aa', fontSize: 9 }, axisLabel: { color: '#8aa', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
      { type: 'value', name: '误差 cm', nameTextStyle: { color: '#8aa', fontSize: 9 }, axisLabel: { color: '#8aa', fontSize: 9 }, splitLine: { show: false } },
    ],
    series: [
      { name: '飞行高程', type: 'line', showSymbol: false, data: data.alts, lineStyle: { color: '#2b8cff', width: 1.2 }, itemStyle: { color: '#2b8cff' } },
      { name: '定位中误差', type: 'line', yAxisIndex: 1, showSymbol: false, data: data.errs, lineStyle: { color: '#ff922b', width: 1 }, itemStyle: { color: '#ff922b' } },
    ],
  };

  const gcpOption = {
    grid: { left: 8, right: 12, top: 20, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v.toFixed(4)} m` },
    xAxis: { type: 'category', data: data.gcp.map((g) => `${g.dataset}-${g.id}`), axisLabel: { color: '#cdd8ea', fontSize: 9, rotate: 30 } },
    yAxis: { type: 'value', name: 'm', nameTextStyle: { color: '#8aa', fontSize: 9 }, axisLabel: { color: '#8aa', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
    series: [
      {
        type: 'bar',
        data: data.gcp.map((g) => ({
          value: g.err,
          itemStyle: { color: GCP_COLOR[g.dataset] ?? '#f06595' },
        })),
        barMaxWidth: 22,
      },
    ],
  };

  const totalArea = data.cats.reduce((s, c) => s + c.area, 0);

  return (
    <div className="charts-panel">
      <div className="chart-block">
        <div className="chart-title">
          RTK 地物类别面积（{data.cats.length} 类 · 合计 {totalArea.toFixed(0)} ㎡）
        </div>
        <ReactECharts option={areaOption} style={{ height: 260 }} notMerge />
      </div>

      <div className="chart-block">
        <div className="chart-title">无人机飞行高程与定位精度剖面（530 曝光点）</div>
        <ReactECharts option={altOption} style={{ height: 180 }} notMerge />
      </div>

      <div className="chart-block">
        <div className="chart-title">三维模型控制点中误差（3DGS / OSGB）</div>
        <ReactECharts option={gcpOption} style={{ height: 160 }} notMerge />
      </div>
    </div>
  );
}
