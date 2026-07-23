import { Button, Steps, Tag, Alert, message } from 'antd';
import { AimOutlined, CheckOutlined, ReloadOutlined, CloseOutlined } from '@ant-design/icons';
import { useGeorefStore } from '../features/mesh/georefStore';
import { meshController } from '../features/mesh/meshController';

// Control-point georeferencing for the 2DGS mesh.
export default function GeorefPanel() {
  const { active, pairs, pending, rmse, set } = useGeorefStore();

  if (!active) {
    return (
      <div className="georef-start">
        <Alert
          type="info"
          message="交互式控制点配准"
          description="2DGS 网格坐标系独立、无法自动配准。可用控制点交互配准：在网格上点一个地物、再在真实场景(倾斜摄影/底图)上点同一个地物，重复 ≥3 次，自动算出精确变换。"
        />
        <Button
          type="primary"
          block
          icon={<AimOutlined />}
          style={{ marginTop: 10 }}
          onClick={() => meshController.beginGeoref()}
        >
          开始交互配准
        </Button>
      </div>
    );
  }

  const step = pending ? 1 : 0;

  return (
    <div className="georef-run">
      <Steps
        size="small"
        current={step}
        items={[
          { title: '点网格', description: '点击网格上的地物' },
          { title: '点场景', description: '点真实场景同一地物' },
        ]}
      />

      <div className="georef-status">
        已采集控制点对：<Tag color="blue">{pairs}</Tag>
        {pending && <Tag color="gold">待在场景上点对应点</Tag>}
      </div>

      {pairs < 3 ? (
        <Alert type="warning" showIcon message={`还需 ${3 - pairs} 对(至少 3 对)`} />
      ) : (
        <Alert type="success" showIcon message="控制点足够，可求解" />
      )}

      {rmse != null && (
        <Alert
          type={rmse < 2 ? 'success' : 'warning'}
          showIcon
          message={`配准残差 RMSE ≈ ${rmse.toFixed(2)} m`}
          description={rmse >= 2 ? '残差较大，可重采质量更好的控制点(选清晰、分散的地物角点)。' : '已应用到网格。'}
        />
      )}

      <div className="georef-actions">
        <Button
          type="primary"
          icon={<CheckOutlined />}
          disabled={pairs < 3}
          onClick={() => {
            const r = meshController.solveGeoref();
            if (r) message.success(`已求解并应用，残差 ${r.rmse.toFixed(2)} m`);
          }}
        >
          求解并应用
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => meshController.resetGeorefPairs()}>
          重采
        </Button>
        <Button
          icon={<CheckOutlined />}
          onClick={() => {
            meshController.endGeoref(true);
            set({ active: false });
          }}
        >
          完成
        </Button>
        <Button
          danger
          icon={<CloseOutlined />}
          onClick={() => {
            meshController.endGeoref(false);
            set({ active: false });
          }}
        >
          取消
        </Button>
      </div>

      <p className="hint">
        提示：先点网格上的一个明显角点(黄点)，再在倾斜摄影/底图上点同一个角点(青点)，即完成一对。
        尽量选分散在不同位置的 4 个点，残差更小。
      </p>
    </div>
  );
}
