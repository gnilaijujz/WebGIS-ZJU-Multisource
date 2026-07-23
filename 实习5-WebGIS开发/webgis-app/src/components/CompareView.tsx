import { useEffect, useRef } from 'react';
import { compareController } from '../features/compare/compareController';

// Right-hand compare view.
// Mounted only in compare mode.
export default function CompareView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    void compareController.enable(ref.current).catch((error) => {
      console.error('compare: enable failed', error);
    });
    const onResize = () => compareController.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      compareController.disable();
    };
  }, []);

  return (
    <div className="compare-right">
      <div ref={ref} className="compare-canvas" />
      <div className="compare-badge compare-badge-right">倾斜摄影 OSGB</div>
    </div>
  );
}
