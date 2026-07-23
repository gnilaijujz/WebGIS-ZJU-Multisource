import { Button, Descriptions, Spin, Tag, Empty } from 'antd';
import { CloseOutlined, PushpinOutlined, ClearOutlined } from '@ant-design/icons';
import { useQueryStore } from '../features/query/queryStore';
import SpectralChart, { type SpectralSeries } from './SpectralChart';

// Human-readable labels for known property keys.
const PROP_LABELS: Record<string, string> = {
  id: '编号',
  dataset: '来源模型',
  datasetId: '来源标识',
  地物类: '地物类别',
  kind: '类型',
  observations: '观测数',
  error: '中误差 (m)',
  note: '备注',
  generatedAt: '生成时间',
  local: '模型局部坐标',
  fid: 'FID',
  Shape_Leng: '周长 (m)',
  Shape_Area: '面积 (㎡)',
  ecef: 'ECEF',
};

function formatVal(k: string, v: unknown): string {
  if (v == null) return '—';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? x.toFixed(2) : x)).join(', ');
  if (typeof v === 'number') {
    if (k === 'error') return v.toFixed(4);
    if (k === 'Shape_Area' || k === 'Shape_Leng') return v.toFixed(2);
    return String(v);
  }
  return String(v);
}

export default function QueryResult() {
  const { feature, pixel, pinned, setFeature, setPixel, pinSpectrum, clearPins } = useQueryStore();

  if (!feature && !pixel) return null;

  const close = () => {
    setFeature(null);
    setPixel(null);
  };

  return (
    <div className="query-card">
      <div className="query-head">
        <span className="query-title">
          {feature ? '要素属性查询' : '高光谱像元查询'}
        </span>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={close} />
      </div>

      {/* Q3: vector feature attributes */}
      {feature && (
        <div className="query-body">
          <div className="query-subtitle">
            <Tag color="blue">{feature.layer || '矢量'}</Tag>
            {feature.title}
          </div>
          {Object.keys(feature.props).length ? (
            <Descriptions
              size="small"
              column={1}
              bordered
              items={Object.entries(feature.props)
                .filter(([k]) => k !== 'ecef' || true)
                .map(([k, v]) => ({
                  key: k,
                  label: PROP_LABELS[k] ?? k,
                  children: formatVal(k, v),
                }))}
            />
          ) : (
            <Empty description="该要素无属性" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      )}

      {/* Q1/Q2: hyperspectral pixel */}
      {pixel && (
        <div className="query-body">
          <div className="pixel-meta">
            <span>经度 {pixel.lon.toFixed(6)}</span>
            <span>纬度 {pixel.lat.toFixed(6)}</span>
            <span>
              像元 [{pixel.col}, {pixel.row}]
            </span>
          </div>
          <div className="pixel-band">
            当前波段 <Tag color="geekblue">B{pixel.band}</Tag>
            反射率{' '}
            <b>{pixel.bandValue != null ? pixel.bandValue.toFixed(4) : <Spin size="small" />}</b>
          </div>

          {pixel.error && <div className="query-error">读取失败：{pixel.error}</div>}

          {pixel.loading && !pixel.spectrum && (
            <div className="spectrum-loading">
              <Spin size="small" /> <span>正在读取全 150 波段光谱…</span>
            </div>
          )}

          {pixel.spectrum && (
            <>
              <SpectralChart
                xName="波段序号"
                series={
                  [
                    {
                      name: '本像元',
                      color: '#2b8cff',
                      data: pixel.spectrum.map((v, i) => [i + 1, v] as [number, number]),
                    },
                    ...pinned.map(
                      (p): SpectralSeries => ({
                        name: p.label,
                        color: p.color,
                        data: p.values.map((v, i) => [i + 1, v] as [number, number]),
                      }),
                    ),
                  ] as SpectralSeries[]
                }
              />
              <div className="query-actions">
                <Button
                  size="small"
                  icon={<PushpinOutlined />}
                  onClick={() =>
                    pixel.spectrum &&
                    pinSpectrum(`像元[${pixel.col},${pixel.row}]`, pixel.spectrum)
                  }
                >
                  固定此曲线对比
                </Button>
                {pinned.length > 0 && (
                  <Button size="small" type="text" icon={<ClearOutlined />} onClick={clearPins}>
                    清除对比 ({pinned.length})
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
