import { Tabs } from 'antd';
import CogPanel from './CogPanel';
import FlightPanel from './FlightPanel';
import ChartsPanel from './ChartsPanel';
import ASDPanel from './ASDPanel';

// Right-side dock.
export default function RightDock() {
  const items = [
    {
      key: 'cog',
      label: '高光谱',
      children: <CogPanel />,
    },
    {
      key: 'flight',
      label: '航线',
      children: <FlightPanel />,
    },
    {
      key: 'charts',
      label: '图表',
      children: <ChartsPanel />,
    },
    {
      key: 'asd',
      label: '地物光谱',
      children: <ASDPanel />,
    },
  ];
  return (
    <div className="right-dock">
      <div className="dock-card">
        <Tabs items={items} size="small" />
      </div>
    </div>
  );
}
