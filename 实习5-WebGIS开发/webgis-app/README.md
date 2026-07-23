# 多源数据 WebGIS 应用 · 浙江大学紫金港校区

将**倾斜摄影(OSGB)、三维高斯泼溅(3DGS)、无人机高光谱(COG)、ASD 地物光谱、RTK 测量面、无人机航线/POS、2DGS 表面网格**等多源数据集成到同一 Cesium 三维场景，实现统一可视化、图层管理与定制化查询。

## 技术栈
- **Vite + React + TypeScript**，`vite-plugin-cesium` 集成 Cesium
- 高光谱 COG 渲染：单波段/RGB 使用 `tiff-imagery-provider`；NDVI/NDWI/GNDVI/NDRE/VARI 指数使用 `geotiff.js` 读取 overview 后在 CPU 生成 Canvas 覆盖层
- 像元/光谱读取：`geotiff.js`（HTTP Range 按需读取）
- 图表：`echarts`；UI：`antd`；状态：`zustand`

## 运行

需要两个进程：**数据服务器**（提供大文件）+ **前端**。

```bash
# 1. 安装依赖
pnpm install

# 2. 启动大数据静态服务（:8686，指向只读源数据，支持 HTTP Range）
node data-server/server.mjs

# 3. 启动前端（:5173，经 Vite 代理访问 /data-server）
pnpm.cmd run dev
```

浏览器打开前端终端输出的本地地址（通常是 http://localhost:5173；若端口被占用，Vite 会自动换到 5174/5175 等）。生产构建：`pnpm.cmd run build`，预览：`pnpm.cmd run preview`。

Cesium 影像需要 Cesium Ion token。复制 `.env.local.example` 为 `.env.local`，填写 `VITE_CESIUM_ION_TOKEN=你的token` 后重启开发服务。

天地图影像需要个人 tk。可在页面首次选择「天地图影像(需tk)」时粘贴并保存到浏览器；也可在 `.env.local` 中填写 `VITE_TIANDITU_TOKEN=你的tk` 后重启开发服务。

> 数据服务器挂载的绝对路径见 `data-server/server.mjs`（zju 3D Tiles、osgb 3D Tiles、COG）。若源数据位置变化请对应修改。**所有源数据只读，派生文件写在本项目内。**

## 功能对照

| 编号 | 功能 | 位置 |
|---|---|---|
| F1 | 基础三维场景、2D/3D 切换、底图 | Cesium Viewer |
| F2 | 3DGS + OSGB 两套 3D Tiles 叠加 | `三维模型`图层组 |
| F3 | **高光谱 COG**：单波段+12 种配色+域拉伸+直方图辅助、RGB 任意三波段假彩色、波段运算(指数) | 右侧「高光谱」页 |
| F4 | RTK 面 / 航线 / 拍摄点 / 控制点矢量成果 | `矢量成果`图层组 |
| F5 | 图层管理：分组显隐 / 透明度 / 一键定位 | 左侧「图层管理」 |
| Q1 | 点击读取当前波段反射率 | 点地图（COG 范围内） |
| Q2 | **点击读取全 150 波段光谱曲线**，可固定多条对比 | 左下查询浮窗 |
| Q3 | 矢量要素属性查询（RTK 地物类别、GCP 误差等） | 点要素 → 左下浮窗 |
| Q4 | **3DGS / OSGB 分屏对比 + 相机联动同步** | 顶栏「分屏对比」 |
| Q5 | **无人机航线时序动画**（播放/倍速/跟随视角） | 右侧「航线」页 + 底部时间轴 |
| Q6 | **ASD 地面光谱库 与 高光谱像元曲线对照**（含现场照片） | 右侧「地物光谱」页 |
| Q7 | 统计图表：地物类别面积、飞行高程/精度剖面、GCP 中误差 | 右侧「图表」页 |
| Q8 | 2DGS 表面网格叠加（`ply→glb`，手动配准） | `三维模型`图层组 + 顶栏「模型配准」 |
| — | 模型配准微调（3DGS/OSGB/2DGS 的 ENU 平移，网格另含朝向/缩放） | 顶栏「模型配准」 |

## 目录结构
```
webgis-app/
├─ data-server/server.mjs     # 大数据静态服务（Express + Range）
├─ scripts/                   # 一次性数据预处理脚本
│   ├─ shp2geojson.mjs        # RTK shp → geojson（UTF-8 DBF）
│   ├─ pos2route.mjs          # POS csv → 航线/点/CZML
│   ├─ asd2json.mjs           # ASD txt → 光谱库 + 复制现场照片
│   ├─ gcp2json.mjs           # 控制点 → geojson
│   ├─ cog_info.mjs           # COG 元数据 → cog_meta.json
│   └─ ply2glb.py             # 2DGS ply → glb（trimesh + 手写 GLB）
├─ public/data/               # 派生的小矢量/光谱/元数据 JSON
├─ public/asd_photos/         # ASD 现场照片
├─ public/models/             # 2DGS glb
└─ src/
    ├─ cesium/                # viewer / initScene / LayerManager
    ├─ features/              # cog / query / flight / compare / mesh
    ├─ components/            # 各面板与查询浮窗
    └─ store/                 # zustand（图层、COG 渲染、查询、UI）
```

## 数据预处理（如需重新生成派生文件）
```bash
node scripts/shp2geojson.mjs
node scripts/pos2route.mjs
node scripts/asd2json.mjs
node scripts/gcp2json.mjs
node scripts/cog_info.mjs
"<arcgispro-py3>/python.exe" scripts/ply2glb.py   # 需要 trimesh 环境
```

## 底图
顶栏左侧下拉切换：Cesium 影像（默认，WGS84 对齐）、Esri 影像、无底图、天地图影像（需免费 tk，CGCS2000≈WGS84 对齐最好）。高德底图因 GCJ-02 偏移较大，天地图矢量在当前网络/token 下不可用，均已从界面选项中移除。天地图 tk 申请见上级目录 `底图与Token说明.md`。

## 已知说明
- **3DGS 默认关闭**：Cesium 1.143 的高斯泼溅 WASM 排序器在此大模型上可能崩溃停止渲染（最新版实验特性的已知问题，非数据问题）。已默认隐藏、按需在图层面板开启；若渲染停止，刷新页面。
- 分屏对比右侧使用无 globe/无底图的轻量 Viewer,只渲染 OSGB 3D Tiles,避免常规 Globe/ImageryLayer 带来的 `GlobeDepth`/shader 压力。若浏览器仍报告 shader 编译失败,应用会自动退出分屏并恢复进入前的图层状态。
- 高光谱 COG 为 150 个有效波段 + 1 个 alpha sample；`final.hdr` 提供中心波长，范围约 **389.8–1029.6 nm**。波段本身仍来自 Spectral Math Result `[(s1)/s2]`，因此 NDVI/NDWI 等指数按反射率比值近似解释；指数层由 CPU 计算低分辨率 overview 并以 Canvas 单瓦片贴回 Cesium，不依赖独立显卡。ASD 对照时把航空高光谱曲线映射到 389.8–1029.6 nm，而 ASD 原始曲线仍覆盖 350–2500 nm。
- 2DGS 网格与 3DGS/OSGB 属不同重建、坐标系不一致，无法自动精确配准，需用「模型配准」手动摆放。
- 开发过程与问题解决详见上级目录 `开发日志.md`。
