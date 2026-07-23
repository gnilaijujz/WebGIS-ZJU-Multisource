import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './index.css';
import App from './App.tsx';


createRoot(document.getElementById('root')!).render(
  <ConfigProvider
    locale={zhCN}
    theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#2b8cff' } }}
  >
    <App />
  </ConfigProvider>,
);
