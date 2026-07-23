# 多源遥感数据 WebGIS 应用

面向浙江大学紫金港校区局部研究区的综合 GIS 实践项目。项目把无人机摄影测量、无人机高光谱、ASD 地物光谱、RTK 外业测量和三维重建成果整理为一套可交互的 WebGIS 应用，在同一个 Cesium 三维场景中完成数据浏览、图层管理、模型配准、高光谱查询和多源成果对照。

## 演示视频

<video src="assets/webgis-demo.mp4" controls muted preload="metadata" width="100%"></video>

[如果 GitHub 未直接显示播放器，请点击查看 WebGIS 演示视频。](assets/webgis-demo.mp4)

![WebGIS 主界面](实习5-WebGIS开发/实习五_media/image42.png)

## 项目重点

本仓库的核心成果是 [实习5-WebGIS开发/webgis-app](实习5-WebGIS开发/webgis-app)，一个基于 React、TypeScript、Vite 和 Cesium 的多源数据 WebGIS 应用。

应用围绕“实习成果如何在 WebGIS 中被稳定加载、查询和对照”展开，重点解决三类问题：

1. 三维成果接入：加载倾斜摄影 OSGB 转换得到的 3D Tiles、3DGS 转换得到的 3D Tiles，以及 2DGS 表面网格 GLB。
2. 遥感影像接入：将无人机高光谱 BIP 数据整理为 COGTiff，并在前端支持单波段、RGB 组合、指数计算和像元光谱查询。
3. 外业与光谱成果融合：叠加 RTK 测量面、无人机航线、拍摄点、三维控制点和 ASD 地物光谱库，用于空间定位、属性查询和光谱对照。

## WebGIS 功能

| 模块 | 能力 |
| --- | --- |
| 三维场景 | Cesium 三维浏览、底图切换、初始视角定位、2D/3D 场景切换 |
| 三维模型 | 倾斜摄影 OSGB 3D Tiles、3DGS 3D Tiles、2DGS 表面网格叠加显示 |
| 模型配准 | 3DGS、OSGB、2DGS 的平移微调，2DGS 网格支持朝向和缩放调整 |
| 高光谱 | COGTiff 单波段渲染、RGB 假彩色组合、NDVI/NDWI/GNDVI/NDRE/VARI 等指数计算 |
| 像元查询 | 点击地图读取当前波段反射率，并可读取 150 个波段的完整光谱曲线 |
| 矢量成果 | RTK 面、RTK 顶点、无人机航线、拍摄点、3DGS/OSGB 控制点展示与属性查询 |
| 光谱对照 | ASD 地面光谱库、现场照片和无人机高光谱像元曲线联动对照 |
| 图表分析 | 地物类别面积统计、飞行高程/精度剖面、控制点误差统计 |
| 分屏对比 | 3DGS/OSGB 分屏查看和相机联动，用于检查模型空间对应关系 |

## 数据链路

| 实习阶段 | 输入或成果 | 在 WebGIS 中的用途 |
| --- | --- | --- |
| 实习1 无人机摄影测量 | 航摄影像、POS、3DGS/2DGS 重建成果 | 生成无人机航线、拍摄点、3DGS 3D Tiles 和 2DGS 网格 |
| 实习2 无人机高光谱影像 | 高光谱反射率影像 | 转换为 COGTiff，用于波段渲染、指数计算和像元光谱查询 |
| 实习3 ASD 地物波谱仪 | ASD 光谱曲线和地物照片 | 形成地面光谱库，与航空高光谱曲线进行对照 |
| 实习4 RTK 外业测量 | 地块面要素和属性 | 转换为 GeoJSON，在三维场景中叠加并支持属性查询 |
| 实习5 WebGIS 开发 | 数据预处理脚本、前端应用、数据服务 | 统一发布和展示前四个实习的多源成果 |

完整依赖文件清单见 [WebGIS依赖文件相对路径清单.md](实习5-WebGIS开发/WebGIS依赖文件相对路径清单.md)。

## 快速运行

进入 WebGIS 应用目录：

```bash
cd 实习5-WebGIS开发/webgis-app
pnpm install
```

启动数据服务。该服务为 3D Tiles 和 COGTiff 提供静态访问，并支持 HTTP Range：

```bash
node data-server/server.mjs
```

另开一个终端启动前端：

```bash
pnpm dev
```

浏览器打开 Vite 输出的本地地址，通常是 `http://localhost:5173`。如果端口被占用，Vite 会自动切换到其他端口。

生产构建：

```bash
pnpm build
```

Cesium 影像需要 Cesium Ion token。可以复制 `实习5-WebGIS开发/webgis-app/.env.local.example` 为 `.env.local`，填写 `VITE_CESIUM_ION_TOKEN=你的token` 后重新启动前端。

天地图影像需要个人 token。可以在同一个 `.env.local` 中填写 `VITE_TIANDITU_TOKEN=你的token`，也可以在页面首次选择「天地图影像(需tk)」时粘贴并保存到浏览器。

## 目录结构

```text
.
├─ 实习1-无人机摄影测量/
│  ├─ 实习一.md
│  └─ 实习一_media/
├─ 实习2-无人机高光谱影像/
│  ├─ 实习二.md
│  └─ 实习二_media/
├─ 实习3-便携式地物波谱仪(ASD)/
│  ├─ 实习三.md
│  └─ 实习三_media/
├─ 实习4-RTK外业测量/
│  ├─ 实习四.md
│  └─ 实习四_media/
├─ 实习5-WebGIS开发/
│  ├─ webgis-app/                         # WebGIS 前端、数据服务和预处理脚本
│  ├─ zju_big-3dtiles/                    # 3DGS 3D Tiles 数据，完整数据包中提供
│  ├─ GIS_drone/terra_osgbs-3dtiles/      # 倾斜摄影 OSGB 3D Tiles 数据，完整数据包中提供
│  ├─ bip_cogtiff/                        # 高光谱 COGTiff 数据，完整数据包中提供
│  ├─ 实习五.md
│  └─ WebGIS依赖文件相对路径清单.md
└─ README.md
```

## 文档入口

| 文档 | 内容 |
| --- | --- |
| [实习五 WebGIS 开发报告](实习5-WebGIS开发/实习五.md) | WebGIS 数据准备、功能实现和展示截图 |
| [WebGIS 应用说明](实习5-WebGIS开发/webgis-app/README.md) | WebGIS 更详细的运行方式、功能对照和技术说明 |
| [依赖文件相对路径清单](实习5-WebGIS开发/WebGIS依赖文件相对路径清单.md) | WebGIS 所需源数据、派生文件和运行时输出 |
| [实习一 无人机摄影测量](实习1-无人机摄影测量/实习一.md) | 摄影测量、3DGS、2DGS 和三维重建成果 |
| [实习二 无人机高光谱影像](实习2-无人机高光谱影像/实习二.md) | 高光谱影像处理和典型地物光谱分析 |
| [实习三 ASD 地物波谱仪](实习3-便携式地物波谱仪%28ASD%29/实习三.md) | ASD 实测光谱、地物照片和反射曲线记录 |
| [实习四 RTK 外业测量](实习4-RTK外业测量/实习四.md) | RTK 地块采集、面要素构建和拓扑检查 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端框架 | React 19、TypeScript、Vite |
| 三维 GIS | Cesium、vite-plugin-cesium |
| 栅格与光谱 | COGTiff、geotiff.js、tiff-imagery-provider |
| 图表与界面 | ECharts、Ant Design、Zustand |
| 数据服务 | Express，提供 3D Tiles 和 COGTiff 静态服务 |
| 数据预处理 | Node.js 脚本、Python 脚本、GeoJSON、GLB、CZML |

## GitHub 说明

本项目包含 3D Tiles、COGTiff、GLB、视频等大文件。GitHub 仓库仅保留代码、Markdown 报告、截图和小型派生数据；完整原始数据、三维瓦片、高光谱 COGTiff 和演示视频通过外部完整数据包提供。

`WebGIS网站展示.mp4` 是本地演示视频，文件较大，不建议作为 README 首屏依赖。当前 README 使用报告中的 WebGIS 截图作为首页预览图。
