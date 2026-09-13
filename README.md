# TKF

塔科夫 **交互地图 / 小地图 / 截图定位** 本地工具。不依赖 kaedeori 会员服。

## 做什么

- 监听 `文档\Escape from Tarkov\Screenshots`，从截图文件名解析 `x, y, z` 并在地图上打点
- 监听游戏 `logs` 最新一场的 `application` / `push-notifications` / `network-connection`，识别进图并自动切图
- 主窗口大地图 + 右上角小地图悬浮窗（置顶）

地图底图使用本地 SVG：`public/maps/svg/`（来源为 tarkov.dev 开源矢量图）。运行时不再请求远程瓦片。

实验室对应 `Labs.svg`；迷宫 / 破冰者目前没有公开 SVG，选单里不会出现。

## 运行

需要已安装 Node.js 18+。

```bat
cd /d D:\tkf
npm install
npm run dev
```

首次启动后在主窗口「设置」里确认：

1. 日志目录：游戏安装目录下的 `logs`
2. 截图目录：通常是 `文档\Escape from Tarkov\Screenshots`

进游戏后按游戏截图键，地图上应出现红点。

## 说明

- 小地图窗口无边框、始终置顶；关闭主窗口会一起退出
- 「读完删除」会在解析截图文件名后删除该文件，避免截图目录堆满
- 本工具不做准星、物价、会员校验
- 多层图按截图坐标的高度 `y` 和平面范围切换 SVG 分组（如 `Ground_Level` / `Second_Floor`）
