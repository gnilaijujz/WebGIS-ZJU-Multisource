import ReactECharts from 'echarts-for-react';

export interface SpectralSeries {
  name: string;
  color: string;
  // [x, y] pairs.
  data: [number, number][];
  yAxisIndex?: number;
}

/** Shared spectral chart for hyperspectral and ASD curves. */
export default function SpectralChart({
  series,
  xName,
  height = 220,
  x2Name,
  xRange,
}: {
  series: SpectralSeries[];
  xName: string;
  x2Name?: string;
  height?: number;
  xRange?: [number, number];
}) {
  const option = {
    animationDuration: 300,
    grid: { left: 44, right: x2Name ? 44 : 12, top: 28, bottom: 34 },
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#cdd8ea', fontSize: 11 },
      type: 'scroll',
    },
    xAxis: {
      type: 'value',
      name: xName,
      nameLocation: 'middle',
      nameGap: 20,
      nameTextStyle: { color: '#8aa', fontSize: 10 },
      axisLabel: { color: '#8aa', fontSize: 10 },
      axisLine: { lineStyle: { color: '#456' } },
      splitLine: { show: false },
      min: xRange?.[0],
      max: xRange?.[1],
    },
    yAxis: [
      {
        type: 'value',
        name: '反射率',
        nameTextStyle: { color: '#8aa', fontSize: 10 },
        axisLabel: { color: '#8aa', fontSize: 10 },
        axisLine: { lineStyle: { color: '#456' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
    ],
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: s.color },
      itemStyle: { color: s.color },
      data: s.data,
    })),
  };
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />;
}
