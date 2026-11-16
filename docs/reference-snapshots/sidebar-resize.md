---
kind: reference
---

# 侧栏宽度与精确范围输入参考

2026-11-17 核对官方演示、文档和组件源码。本页是人工取证笔记，未作为上游原文登记。

## 实测

- [Mantine AppShell 演示](https://mantine.dev/app-shell/?e=ResizableAppShell)的导航宽度初始为 300 px，拖动区使用 `role="separator"`，支持焦点与方向键。按右键后为 310 px，向右拖动 100 px 后为 410 px，点击 Reset layout 后恢复 300 px。分隔条自身的左坐标比宽度少 4 px。
- [shadcn Dashboard](https://ui.shadcn.com/view/new-york-v4/dashboard-01)展示了独立导航栏、底部账号入口和内容区，布局及像素已查看。可拖宽行为另参考 [Resizable Sidebar 演示](https://shadcn-resizable-sidebar.vercel.app/)的说明和 DOM，其实际拖动与持久化未实测。
- [Ant Design Slider](https://ant.design/components/slider/#slider-demo-input-number)的官方示例将 Slider 与 InputNumber 绑定到同一数值，同时提供整数和小数步长示例。页面 DOM 与示例代码已读取。

## 源码与文档

- [Mantine AppShell](https://mantine.dev/core/app-shell/#resizing-sections)提供最小、最大尺寸、提交时保存与重置控制器。
- [GitHub Primer usePaneWidth](https://github.com/primer/react/blob/main/packages/react/src/PageLayout/usePaneWidth.ts)将最小、默认与最大宽度作为配置管理。
- [React Aria useMove](https://react-aria.adobe.com/useMove)处理鼠标、触屏、键盘移动和拖动时禁止选择文字。Peach 复用已安装的 React Aria 3.53.1（Apache-2.0），未复制其他组件库的源码。

## Peach 取舍

固定侧栏继续使用现有壳和样式体系，通过 CSS 变量同步侧栏宽度与正文让位。拖动直接跟手，松手时在常用宽度 8 px 范围内吸附，重置与吸附采用 BoardUI 的 200 ms ease-out 曲线。默认宽度为 260 px，范围为 220–480 px，并为正文预留 480 px。窗口变窄时临时夹持显示宽度，保存的偏好在窗口恢复后重新应用。

分隔条支持左右方向键逐像素调整，Shift 加速至 10 px，Home、End 调整到边界，Enter 和双击重置，Esc 撤销当前拖动。宽度只在松手或键盘调整结束时保存到当前浏览器。

分隔线沿视口全高显示。拖动期间沿用玻璃开合的完整模糊面，松手后按最终宽度补画折射贴图，避免旧尺寸 SVG 滤镜在新增宽度处产生透明残留。

时长继续复用原生双滑块与查询入口，每步 1 分钟。精确输入组合现有 BoardUI TextField、InputBase 和 Label，允许小数分钟，回车或失焦时应用，查询参数精确到秒。空上限表示不限，明确输入 180 分钟或更长上限仍保持有效。

本文件汇总多个组件库的人工操作证据、源码阅读与 Peach 取舍，没有单一对应的上游正文副本，因此不登记为 docs/reference-sources.json 的自动更新快照。
