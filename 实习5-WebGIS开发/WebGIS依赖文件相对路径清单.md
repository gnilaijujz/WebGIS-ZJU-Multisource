# WebGIS 依赖文件相对路径清单

相对根目录：项目根目录（.）

说明：下表中的路径均为相对路径；*.txt / *.jpg / ** 表示同类文件或递归目录树。

| 类别 | 相对路径 | 说明 |
| --- | --- | --- |
| 源数据 | 实习1-无人机摄影测量/202602-成果数据/AT/report/POS_residual_of_camera.csv | pos2route.mjs 的输入，生成 flight_route.geojson / photo_points.geojson / flight.czml |
| 源数据 | 实习1-无人机摄影测量/2dgs/fuse_post.ply | ply2glb.py 的输入，导出 webgis-app/public/models/mesh_2dgs_v8.glb |
| 源数据 | 实习4-RTK外业测量/RTK要素面/RTK要素面.{shp,dbf,shx,prj,cpg,sbn,sbx,shp.xml} | shp2geojson.mjs 的输入；.shp 和 .dbf 被脚本直接读取，其余是配套的 shapefile 旁文件 |
| 源数据 | 实习3-便携式地物波谱仪(ASD)/2(1)/*.asd.txt（25 个） | asd2json.mjs 的输入 |
| 源数据 | 实习3-便携式地物波谱仪(ASD)/asd地物图片/asd地物图片/*.jpg（23 张） | asd2json.mjs 的类别照片来源；会复制到 webgis-app/public/asd_photos/*.jpg |
| 上游数据 | 实习1-无人机摄影测量/3dgs/fuse_post.ply | 3DGS 数据链路的上游重建结果，当前页面不直接读取，但属于该项目数据树 |
| 三维瓦片 | 实习5-WebGIS开发/zju_big-3dtiles/model-control-points-2026-07-18T07-34-28-726Z.json | gcp2json.mjs 的 3DGS 控制点输入 |
| 三维瓦片 | 实习5-WebGIS开发/zju_big-3dtiles/tileset.json | Cesium 3DGS 入口文件，递归引用 zju_big-3dtiles/ 下的瓦片 |
| 三维瓦片 | 实习5-WebGIS开发/GIS_drone/terra_osgbs-3dtiles/model-control-points-2026-07-18T07-39-19-312Z.json | gcp2json.mjs 的 OSGB 控制点输入 |
| 三维瓦片 | 实习5-WebGIS开发/GIS_drone/terra_osgbs-3dtiles/tileset.json | Cesium OSGB 入口文件，递归引用 terra_osgbs-3dtiles/ 下的瓦片 |
| 高光谱 | 实习5-WebGIS开发/bip_cogtiff/final-cog.tif | cog_info.mjs 的输入，也是 data-server 的 /cogdata 源文件 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/rtk_area.geojson | RTK 面的 GeoJSON 输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/rtk_points.geojson | RTK 面顶点点集输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/flight_route.geojson | 无人机航线输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/photo_points.geojson | 拍摄点输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/flight.czml | 无人机航线动画输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/gcp_3dgs_points.geojson | 3DGS 控制点输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/gcp_osgb_points.geojson | OSGB 控制点输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/gcp_points.geojson | 3DGS 控制点别名输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/asd_spectra.json | ASD 光谱汇总输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/data/cog_meta.json | COG 元数据输出 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/models/mesh_2dgs_v8.glb | 2DGS 表面网格运行时模型 |
| 运行时输出 | 实习5-WebGIS开发/webgis-app/public/asd_photos/*.jpg（23 张） | ASD 照片复制输出 |
