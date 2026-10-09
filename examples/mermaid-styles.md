# Mermaid 配色示例

墨阅默认使用浅蓝节点、蓝色文字、灰色连线、圆角边框和白色连线标签。原有 Mermaid 源码不需要修改；切换深色主题时会自动适配。

## 为指定节点和连线设置颜色

`classDef` 定义可复用样式，`style` 修改单个节点，`linkStyle` 修改连线。这些颜色会覆盖应用默认值，并在深浅主题中保留。

```mermaid
flowchart LR
    A[已完成] -->|下一步| B[等待处理]
    classDef success fill:#dcfce7,stroke:#22c55e,color:#166534
    class A success
    style B fill:#fff7ed,stroke:#fb923c,color:#9a3412
    linkStyle default stroke:#f97316,stroke-width:2px,color:#9a3412
```

## 为整张图设置主题

在 Mermaid 代码块内部添加 YAML 配置，使用 `base` 主题及 `themeVariables` 设置整张图的颜色。这里的配置只影响当前图表。

```mermaid
---
config:
  theme: base
  themeVariables:
    primaryColor: '#fff0f6'
    primaryTextColor: '#9d174d'
    primaryBorderColor: '#f472b6'
    lineColor: '#db2777'
---
flowchart LR
    A[开始编辑] --> B[实时预览]
```

## 不写样式时使用默认配色

上一张图的自定义颜色不会影响这一张图。

```mermaid
flowchart LR
    A[Markdown 文档] -->|渲染| B[图文预览]
```
