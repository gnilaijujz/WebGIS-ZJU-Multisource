# 实习五：WebGIS开发

## 实习目的

1. 了解 WebGIS 系统对三维场景数据和栅格影像数据的基本要求，理解为什么需要在发布前进行格式转换、空间配准和索引优化。

1. 掌握 3DGS PLY、倾斜摄影 OSGB 数据转换为 3D Tiles 的基本流程，理解 tileset.json、瓦片树、瓦片内容文件和按需加载之间的关系。

1. 掌握三维控制点测定和配准矩阵计算的基本方法，能够区分原始模型坐标、应用 transform 后的场景坐标和 Cesium 使用的 ECEF 坐标。

1. 掌握 ENVI BIP 高光谱影像转换为 Cloud Optimized GeoTIFF（COGTiff）的基本方法，理解 COGTiff 中像元、波段、瓦片块、概览层和地理参考信息的存储方式。

1. 能够在 WebGIS 场景中加载 3D Tiles 和 COGTiff 数据，并完成基本的模型浏览、影像渲染、波段选择和像元值查询。

## 实习内容

本次实习面向一个完整 WebGIS 系统的数据准备过程。学生需要将前几个实习中得到的三维重建成果、倾斜摄影模型、高光谱影像和外业控制点整理为 WebGIS 前端可以稳定加载的数据，并在应用中验证显示效果。

1. 3DGS 数据处理：将 3D Gaussian Splatting 训练结果中的 PLY 文件转换为 3D Tiles 数据集；通过模型控制点和地表控制点建立对应关系；计算 3D Tiles 可用的 transform 矩阵；在 Cesium 中加载和检查配准效果。

1. 倾斜摄影 OSGB 数据处理：识别倾斜摄影模型根目录中的 metadata.xml、Data 目录或 Block 平铺结构；调用本地 3dtile 转换程序生成 3D Tiles；在通用 3D Tiles 预览页中检查瓦片加载、范围和空间位置。

1. 高光谱影像处理：将 ENVI BIP 数据及其 HDR 头文件转换为 COGTiff；设置压缩、块大小、目标空间参考和四至范围；在 WebGIS 中以单波段或 RGB 组合方式渲染 COGTiff，并查询点击位置的多波段像元值。

当前教学应用的功能导航包括“OSGB 转 3DTiles”“3DGS PLY 转 3D Tiles”“控制点测定”“3DTiles 地理配准”“BIP 转 COGTiff”“3D Tiles 测试”和“COGTiff 测试”。学生在实习中主要关注输入数据是否正确、参数含义是否清楚、输出文件是否完整，以及 WebGIS 加载后是否与真实地理位置一致。

## 实习步骤

1. 按只读原则盘点并核查数据路径，确认 3DGS、OSGB、COG、RTK、航线、ASD 和 2DGS 数据都已就位，派生文件统一写入本项目目录。

2. 搭建 webgis-app 和 data-server，配置 Vite 代理与 Cesium 集成，并先让基础三维场景能够稳定打开。

3. 完成底图切换和图层管理，再把 OSGB、3DGS、控制点和 RTK 面接入场景，检查空间叠加和控制点显示效果。

4. 接入高光谱 COG 并实现单波段、RGB 组合、指数渲染、当前波段查询和全波段光谱曲线查询。

5. 接入 RTK、航线、拍摄点、ASD、统计图表和 2DGS 网格，并实现分屏对比、相机联动和模型配准。

6. 逐项测试，记录 bug、修复 bug。

## 实习结果

### 预处理

  1. 报告中提交转换后的 3DGS 3D Tiles 数据目录截图，模型信息（应用中显示的）截图。

![图片 46](实习五_media/image1.png)

![57251c5d8584b4852399cee7d7d32f16](实习五_media/image2.png)

![图片 7](实习五_media/image3.png)

3DGS 转换结果数据目录与模型信息、Cesium应用截图

  1. 报告中提交转换后的倾斜摄影 3D Tiles 数据目录，模型信息（应用中显示的）截图。

![图片 47](实习五_media/image4.png)

![图片 48](实习五_media/image5.png)

![图片 6](实习五_media/image6.png)

OSGB 转换结果数据目录与模型信息、Cesium应用截图

  1. 报告中提交用于配准的控制点表，包含模型坐标、地表经纬高或 ECEF 坐标、点号对应关系、Transform 模式和残差统计。均未加载transform.

![图片 49](实习五_media/image7.png)

![图片 50](实习五_media/image8.png)

3dgs（左边model,右边surface）

OSGB（左边model,右边surface）

![图片 51](实习五_media/image9.png)

![图片 52](实习五_media/image10.png)

  1. 报告中提交最终写入 tileset.json 的 transform 矩阵。

![图片 53](实习五_media/image11.png)

3DGS 配准矩阵

![图片 54](实习五_media/image12.png)

OSGB 配准矩阵

  1. 报告中提交转换后的 COGTiff 文件，并说明转换参数、影像尺寸、波段数、数据类型、空间参考和是否包含有效四至范围。

转换参数使用默认配置：DEFLATE 压缩、Predictor=AUTO、块大小 512、BigTIFF=YES、COG 交错方式为 BAND、目标空间参考为 EPSG:4326.原始影像已经有完整地理范围，不勾选“写入四至范围”。

![343dfc1045d06501aa40ba47301ecfee](实习五_media/image13.png)

COGTiff 转换结果与参数

### 系统总体界面与底图切换

应用启动后，左侧为图层管理，右侧为高光谱、航线、图表和地物光谱标签页，中间是 Cesium 三维场景。底图可在 Cesium 影像、Esri 影像、天地图影像和无底图之间切换，满足不同展示需求。

![图片 1](实习五_media/image14.png)

![图片 2](实习五_media/image15.png)

![图片 3](实习五_media/image16.png)

![图片 4](实习五_media/image17.png)

![图片 5](实习五_media/image18.png)

系统总体界面与底图切换

### 三维模型集成与控制点配准

OSGB 和 3DGS 两套 3D Tiles 都已接入。OSGB 作为倾斜摄影模型，适合贴合地表几何；3DGS 作为高斯泼溅重建，细节表达更强，但在 Cesium 1.143 上渲染相对敏感，因此默认关闭，按需开启。为了便于查看，我实现了分屏对比：左侧显示 3DGS，右侧显示 OSGB，并通过双向相机联动同步视角。

在控制点方面，项目区分了 3DGS 控制点和 OSGB 控制点，两组控制点可以独立显示、定位和查看属性；同时保留 RTK 测量面和无人机航线、拍摄点，保证模型与矢量成果在空间上基本一致。

![图片 6](实习五_media/image6.png)

![图片 7](实习五_media/image3.png)

![图片 8](实习五_media/image19.png)

![图片 9](实习五_media/image20.png)

![图片 10](实习五_media/image21.png)

![图片 11](实习五_media/image22.png)

![图片 12](实习五_media/image23.png)

![图片 13](实习五_media/image24.png)

三维模型集成、控制点与分屏对比

### 高光谱 COG 渲染与像元查询

高光谱部分将 ENVI BIP/HDR 转换得到的 COGTiff 接入 Cesium，支持单波段、RGB 组合和波段运算三种模式。单波段模式可以切换 1–150 号波段、选择配色、拖动拉伸区间并查看直方图；RGB 模式可任意选择三波段合成假彩色；波段运算模式提供 NDVI、NDWI、GNDVI、NDRE 和 VARI 等具有遥感语义的指数。

由于该数据是 150 波段 + alpha 的 BIP COG，且在本机 GPU 环境下单波段表达式渲染不够稳定，我将指数模式改成 CPU 低分辨率计算后再用 Canvas 单瓦片影像覆盖回 COG footprint，这样即使在没有独立显卡的电脑上也能稳定显示。

点击高光谱影像后，可以先读出当前显示波段的像元值，再读取全部 150 个波段并绘制光谱曲线，形成“点位反射率 + 全谱曲线”的查询结果。

![图片 14](实习五_media/image25.png)

![图片 15](实习五_media/image26.png)

![图片 16](实习五_media/image27.png)

![图片 17](实习五_media/image28.png)

![图片 18](实习五_media/image29.png)

![图片 19](实习五_media/image30.png)

![图片 20](实习五_media/image31.png)

![图片 21](实习五_media/image32.png)

![图片 22](实习五_media/image33.png)

![图片 23](实习五_media/image34.png)

![图片 24](实习五_media/image35.png)

高光谱 COG 单波段、RGB、指数渲染与像元查询

### 矢量成果、航线动画、ASD 对照、图表和 2DGS

RTK 测量面、无人机航线、拍摄点以及两组控制点均已统一加载为 GeoJSON/CZML，支持显隐、定位和属性查询。航线动画基于 CZML 的 SampledPositionProperty 实现，配合 Cesium 时间轴可播放无人机运动轨迹，并支持倍速和第一视角跟随。

ASD 地物光谱库通过地物多选和现场照片缩略图展示不同地物的地面实测曲线，并可以与高光谱像元曲线叠加对照。统计图表页则汇总了 RTK 地物面积、飞行高程/定位误差剖面和三维模型控制点中误差，便于从统计角度检查数据质量。

2DGS 表面网格则从 PLY 转为 GLB 后以 Cesium Model 方式叠加，并通过模型配准面板手动调整东/北/天、朝向和缩放，使其尽量贴合场景。

![图片 25](实习五_media/image36.png)

![图片 26](实习五_media/image37.png)

![图片 27](实习五_media/image38.png)

![图片 28](实习五_media/image39.png)

![图片 29](实习五_media/image40.png)

![图片 30](实习五_media/image41.png)

![图片 1](实习五_media/image42.png)

![图片 2](实习五_media/image43.png)

![图片 3](实习五_media/image44.png)

![图片 4](实习五_media/image45.png)

![图片 31](实习五_media/image46.png)

![图片 32](实习五_media/image47.png)

![图片 33](实习五_media/image48.png)

![图片 34](实习五_media/image49.png)

![图片 35](实习五_media/image50.png)

![图片 36](实习五_media/image51.png)

矢量成果、航线动画、ASD 对照、统计图表与 2DGS 网格

### 技术问题回答

1. 3D Tiles 适合三维 WebGIS 的原因，是它把复杂三维内容拆成带层次结构的瓦片树，能够按视距和视锥进行逐级细节加载与裁剪；同时 tileset.json 统一描述空间范围、层级关系和内容文件位置，特别适合网络端按需传输。

2. OSGB 与 3DGS 的数据结构不同：OSGB 本质上更接近传统的倾斜摄影网格和纹理切片，强调表面几何；3DGS 则是由大量高斯斑点及其位置、协方差、颜色和不透明度等参数构成，更偏向外观重建。两者最终都可以转换成 3D Tiles，但底层表达方式并不相同。

3. COGTiff 适合网络栅格访问，是因为它内部自带瓦片块和概览层，并支持 HTTP Range 按需读取。WebGIS 在浏览时只需要请求当前视野相关的局部像元，而不用下载整幅大影像，因此能明显降低网络和内存压力。

4. 高光谱 COGTiff 中一个像元的数据，不再只是普通 RGB 图像里的 3 个颜色值，而是包含 150 个波段的反射率序列，外加可能的 alpha 通道。它既能用于显示，也能进一步计算植被指数、地物差异和完整光谱曲线。

### AI 工具辅助开发过程与体验

本次实习中，AI 工具主要承担三类辅助工作：第一，帮助我根据任务、开发规划拆解功能模块，形成分阶段实施方案；第二，在调试时根据报错日志快速缩小问题范围；第三，在我给出明确业务目标后，协助生成 TypeScript / React / Cesium 的代码骨架，再由我结合项目约束完成修改。

例如，遇到 vite-plugin-cesium 的模块解析报错、Cesium 容器在分屏时出现的零尺寸画布错误、3DGS 高斯泼溅渲染停止、COG 指数模式不渲染、3DGS/OSGB 的 502 请求以及天地图底图密钥输入异常等问题时，我会把开发日志、相关源码文件和浏览器控制台报错一起交给 AI，让它判断问题更可能出现在模块解析、布局尺寸、shader 编译、COG 贴图路径还是数据服务层。

随后我再根据 AI 提出的候选方案在本地验证，并用 oxlint、tsc -b 和浏览器实测确认修复是否有效。这个过程让我感受到，AI 更适合做协作、审阅、排障助手，而不是直接替代开发者；真正决定最终方案的，仍然是对 WebGIS 坐标系、瓦片加载、GPU / CPU 取舍和项目结构的理解。

![图片 37](实习五_media/image52.png)

![图片 38](实习五_media/image53.png)

![图片 39](实习五_media/image54.png)

![图片 40](实习五_media/image55.png)

![图片 41](实习五_media/image56.png)

![图片 42](实习五_media/image57.png)

![图片 43](实习五_media/image58.png)

![图片 44](实习五_media/image59.png)

AI 辅助开发与调试过程

## 实习感想

通过这次 WebGIS 实习，我对多源数据在同一三维场景中的组织方式有了更完整的认识，也更清楚地理解了“格式转换、空间配准、索引优化”在工程实现中的必要性。与单纯做数据处理相比，真正把数据放进可交互的 WebGIS 场景后，才会遇到底图坐标系、模型精度、渲染性能、浏览器内存和异步加载等一系列工程问题。

这次开发中最有收获的地方，是把课程中的摄影测量、高光谱、ASD、RTK 等成果串成了一个完整应用，并通过 AI 辅助提高了排障效率。但我也更明确地意识到，AI 只能帮助我更快地定位问题、整理思路和生成初稿，最后仍然需要我自己对代码、数据和结果负责。

**录了一个WebGIS网站展示视频，详细介绍各功能。在https://pan.baidu.com/s/1g4kkfCbQGiwV4zV2tGpAPg?pwd=dmzj**

**实验五完整实验数据可见百度网盘**

**https://pan.baidu.com/s/5WLPZ7ZkptuOIYUO-2xv-Sg**
