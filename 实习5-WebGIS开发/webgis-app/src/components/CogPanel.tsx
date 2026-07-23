import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Segmented,
  Select,
  Slider,
  InputNumber,
  Button,
  Switch,
  Space,
  Tooltip,
  Spin,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { renderColorScaleToCanvas } from 'tiff-imagery-provider';
import {
  useCogStore,
  COLOR_SCALES,
  EXPR_PRESETS,
  type CogMode,
} from '../features/cog/cogStore';
import { cogReader, SPECTRAL_BANDS } from '../features/cog/cogReader';

// RGB presets for false colour.
const RGB_PRESETS: { key: string; label: string; rgb: { r: number; g: number; b: number } }[] = [
  { key: 'wide', label: '宽间隔组合', rgb: { r: 120, g: 75, b: 30 } },
  { key: 'even', label: '均匀三分', rgb: { r: 130, g: 75, b: 20 } },
  { key: 'near', label: '相邻波段', rgb: { r: 90, g: 80, b: 70 } },
];

const MODE_OPTIONS: { label: string; value: CogMode }[] = [
  { label: '单波段', value: 'single' },
  { label: 'RGB 组合', value: 'rgb' },
  { label: '波段运算', value: 'expression' },
];

/** Colour bar legend. */
function ColorBar({ scale, domain }: { scale: string; domain: [number, number] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      try {
        renderColorScaleToCanvas(scale, { canvas: canvasRef.current });
      } catch {
        // Ignore unknown scales.
      }
    }
  }, [scale]);
  return (
    <div className="colorbar">
      <canvas ref={canvasRef} width={256} height={12} className="colorbar-canvas" />
      <div className="colorbar-ticks">
        <span>{domain[0].toFixed(2)}</span>
        <span>{((domain[0] + domain[1]) / 2).toFixed(2)}</span>
        <span>{domain[1].toFixed(2)}</span>
      </div>
    </div>
  );
}

function IndexColorBar({ presetKey, domain }: { presetKey: string; domain: [number, number] }) {
  const gradient = presetKey === 'ndwi_green_nir'
    ? 'linear-gradient(90deg, rgb(120,72,34), rgb(240,238,210), rgb(33,145,204), rgb(8,48,107))'
    : presetKey === 'vari'
      ? 'linear-gradient(90deg, rgb(165,0,38), rgb(255,255,191), rgb(0,104,55))'
      : presetKey === 'ndre'
        ? 'linear-gradient(90deg, rgb(94,60,153), rgb(230,245,152), rgb(49,163,84))'
        : 'linear-gradient(90deg, rgb(166,97,26), rgb(245,245,180), rgb(120,190,80), rgb(0,104,55))';
  return (
    <div className="colorbar">
      <div className="colorbar-canvas" style={{ background: gradient }} />
      <div className="colorbar-ticks">
        <span>{domain[0].toFixed(2)}</span>
        <span>{((domain[0] + domain[1]) / 2).toFixed(2)}</span>
        <span>{domain[1].toFixed(2)}</span>
      </div>
    </div>
  );
}

/** Band histogram. */
function BandHistogram({
  band,
  domain,
  onStretch,
}: {
  band: number;
  domain: [number, number];
  onStretch: (d: [number, number]) => void;
}) {
  const [hist, setHist] = useState<{ counts: number[]; edges: number[]; min: number; max: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cogReader
      .bandHistogram(band, 40)
      .then((h) => {
        if (!cancelled) setHist(h);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [band]);

  const option = hist && {
    grid: { left: 6, right: 6, top: 6, bottom: 18 },
    xAxis: {
      type: 'category',
      data: hist.edges.slice(0, -1).map((e) => e.toFixed(2)),
      axisLabel: { fontSize: 9, color: '#8aa', interval: 9 },
      axisLine: { lineStyle: { color: '#456' } },
    },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        data: hist.counts,
        itemStyle: { color: '#2b8cff' },
        barCategoryGap: '10%',
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: '#ffcc33', type: 'dashed' },
          data: [
            { xAxis: Math.round(((domain[0] - hist.min) / (hist.max - hist.min || 1)) * 40) },
            { xAxis: Math.round(((domain[1] - hist.min) / (hist.max - hist.min || 1)) * 40) },
          ],
        },
      },
    ],
  };

  return (
    <div className="cog-hist">
      {loading && (
        <div className="cog-hist-loading">
          <Spin size="small" />
        </div>
      )}
      {hist && <ReactECharts option={option} style={{ height: 90 }} notMerge />}
      {hist && (
        <div className="cog-hist-actions">
          <span className="hint">
            实测 min {hist.min.toFixed(3)} / max {hist.max.toFixed(3)}
          </span>
          <Button
            size="small"
            type="link"
            onClick={() => onStretch([hist.min, hist.max])}
          >
            按此波段自动拉伸
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CogPanel() {
  const s = useCogStore();
  const [sweep, setSweep] = useState(false);
  const sweepRef = useRef<number | null>(null);

  // Auto-sweep bands in single mode.
  useEffect(() => {
    if (sweep && s.mode === 'single') {
      sweepRef.current = window.setInterval(() => {
        const cur = useCogStore.getState().band;
        useCogStore.getState().setBand(cur >= SPECTRAL_BANDS ? 1 : cur + 1);
      }, 350);
    }
    return () => {
      if (sweepRef.current) window.clearInterval(sweepRef.current);
      sweepRef.current = null;
    };
  }, [sweep, s.mode]);

  const applyRgbPreset = useCallback((key: string) => {
    const p = RGB_PRESETS.find((x) => x.key === key);
    if (p) useCogStore.getState().setRgb(p.rgb);
  }, []);

  return (
    <div className="cog-panel">
      <Segmented
        block
        size="small"
        options={MODE_OPTIONS}
        value={s.mode}
        onChange={(v) => s.setMode(v as CogMode)}
      />

      {s.mode === 'single' && (
        <div className="cog-section">
          <div className="row">
            <span className="lbl">波段</span>
            <Slider
              className="grow"
              min={1}
              max={SPECTRAL_BANDS}
              value={s.band}
              onChange={(v) => s.setBand(v as number)}
            />
            <InputNumber
              size="small"
              min={1}
              max={SPECTRAL_BANDS}
              value={s.band}
              onChange={(v) => v && s.setBand(v)}
              style={{ width: 64 }}
            />
            <Tooltip title={sweep ? '停止波段扫描' : '逐波段播放'}>
              <Button
                size="small"
                type="text"
                icon={sweep ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => setSweep((x) => !x)}
              />
            </Tooltip>
          </div>

          <div className="row">
            <span className="lbl">配色</span>
            <Select
              className="grow"
              size="small"
              value={s.colorScale}
              onChange={(v) => s.setColorScale(v)}
              options={COLOR_SCALES.map((c) => ({ label: c, value: c }))}
            />
          </div>

          <ColorBar scale={s.colorScale} domain={s.domain} />

          <div className="row">
            <span className="lbl">拉伸</span>
            <Slider
              className="grow"
              range
              min={0}
              max={1}
              step={0.01}
              value={s.domain}
              onChange={(v) => s.setDomain(v as [number, number])}
            />
          </div>

          <div className="row">
            <Space size="large">
              <span>
                <Switch size="small" checked={s.clampLow} onChange={(v) => s.setClamp(v, s.clampHigh)} />{' '}
                <span className="hint">低值裁剪</span>
              </span>
              <span>
                <Switch size="small" checked={s.clampHigh} onChange={(v) => s.setClamp(s.clampLow, v)} />{' '}
                <span className="hint">高值裁剪</span>
              </span>
            </Space>
          </div>

          <BandHistogram band={s.band} domain={s.domain} onStretch={(d) => s.setDomain(d)} />
        </div>
      )}

      {s.mode === 'rgb' && (
        <div className="cog-section">
          <div className="row">
            <span className="lbl">预设</span>
            <Space wrap size={4}>
              {RGB_PRESETS.map((p) => (
                <Button key={p.key} size="small" onClick={() => applyRgbPreset(p.key)}>
                  {p.label}
                </Button>
              ))}
            </Space>
          </div>
          {(['r', 'g', 'b'] as const).map((ch) => (
            <div className="row" key={ch}>
              <span className="lbl" style={{ color: ch === 'r' ? '#ff6b6b' : ch === 'g' ? '#51cf66' : '#4dabf7' }}>
                {ch.toUpperCase()}
              </span>
              <Slider
                className="grow"
                min={1}
                max={SPECTRAL_BANDS}
                value={s.rgb[ch]}
                onChange={(v) => s.setRgb({ [ch]: v as number })}
              />
              <InputNumber
                size="small"
                min={1}
                max={SPECTRAL_BANDS}
                value={s.rgb[ch]}
                onChange={(v) => v && s.setRgb({ [ch]: v })}
                style={{ width: 64 }}
              />
            </div>
          ))}
          <div className="row">
            <span className="lbl">拉伸</span>
            <Slider
              className="grow"
              range
              min={0}
              max={1}
              step={0.01}
              value={s.domain}
              onChange={(v) => s.setDomain(v as [number, number])}
            />
          </div>
          <p className="hint">
            将任意三个波段映射到 R/G/B 合成假彩色影像；拉伸范围对三通道统一生效。
          </p>
        </div>
      )}

      {s.mode === 'expression' && (
        <div className="cog-section">
          <div className="row">
            <span className="lbl">
              <ThunderboltOutlined /> 指数
            </span>
            <Select
              className="grow"
              size="small"
              value={s.exprKey}
              onChange={(v) => s.setExprKey(v)}
              options={EXPR_PRESETS.map((e) => ({ label: e.label, value: e.key }))}
            />
          </div>
          {(() => {
            const p = EXPR_PRESETS.find((e) => e.key === s.exprKey) ?? EXPR_PRESETS[0];
            return (
              <>
                <div className="expr-formula">{p.expression}</div>
                <IndexColorBar presetKey={p.key} domain={p.domain} />
                <p className="hint">
                  {p.description}
                  <br />
                  基于 final.hdr 的 389.8–1029.6 nm 波长表计算。当前使用 CPU 低分辨率指数覆盖层，不依赖独立显卡；
                  本数据没有 SWIR，因此水体指数采用 Green-NIR 版本。
                </p>
              </>
            );
          })()}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button
          size="small"
          type="text"
          icon={<ReloadOutlined />}
          onClick={() => {
            s.setDomain([0, 0.6]);
            s.setColorScale('viridis');
          }}
        >
          重置渲染
        </Button>
      </div>
    </div>
  );
}
