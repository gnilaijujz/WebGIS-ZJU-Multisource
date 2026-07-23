import { useEffect, useState } from 'react';
import { Button, Slider, Switch, Space, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { flightController } from '../features/flight/flightController';

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 30];

function nearestSpeedIndex(speed: number) {
  let best = 0;
  let diff = Number.POSITIVE_INFINITY;
  SPEEDS.forEach((s, i) => {
    const d = Math.abs(s - speed);
    if (d < diff) {
      best = i;
      diff = d;
    }
  });
  return best;
}

function formatSpeed(speed: number) {
  return `${Number.isInteger(speed) ? speed.toFixed(0) : speed.toFixed(2)}×`;
}

export default function FlightPanel() {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(false);
  const [time, setTime] = useState('');

  // Refresh the clock readout.
  useEffect(() => {
    const t = window.setInterval(() => {
      setTime(flightController.formatTime());
      setPlaying(flightController.isPlaying());
      setSpeed(flightController.getSpeed());
    }, 300);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flight-panel">
      <p className="hint">
        无人机摄影测量航线时序回放：基于 POS 的 530 个曝光点生成 CZML 轨迹，沿路径拖尾飞行。
        也可用底部时间轴手动拖动。
      </p>

      <div className="flight-time">{time || '—'}</div>

      <Space>
        <Tooltip title="回到起点">
          <Button
            size="small"
            icon={<StepBackwardOutlined />}
            onClick={() => flightController.reset()}
          />
        </Tooltip>
        <Button
          type="primary"
          size="small"
          icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={() => setPlaying(flightController.toggle())}
        >
          {playing ? '暂停' : '播放'}
        </Button>
        <Tooltip title="定位到航线中的位置">
          <Button size="small" icon={<EnvironmentOutlined />} onClick={() => flightController.frame()} />
        </Tooltip>
      </Space>

      <div className="row" style={{ marginTop: 10 }}>
        <span className="lbl">倍速</span>
        <Slider
          className="grow"
          min={0}
          max={SPEEDS.length - 1}
          step={1}
          value={nearestSpeedIndex(speed)}
          marks={SPEEDS.reduce((m, s, i) => ({ ...m, [i]: formatSpeed(s) }), {})}
          tooltip={{ formatter: (i) => formatSpeed(SPEEDS[i ?? 0]) }}
          onChange={(i) => {
            const s = SPEEDS[i as number];
            setSpeed(s);
            flightController.setSpeed(s);
          }}
        />
      </div>

      <div className="flight-speed-readout">实际倍率：{formatSpeed(speed)}</div>

      <div className="row" style={{ marginTop: 14 }}>
        <Switch
          size="small"
          checked={follow}
          onChange={(v) => {
            setFollow(v);
            flightController.follow(v);
          }}
        />
        <span className="hint">跟随无人机第一视角</span>
      </div>
    </div>
  );
}
