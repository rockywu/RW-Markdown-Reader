---
title: Markdown 兼容性样本
tags: [Markdown, Mermaid, 数学]
---

# Markdown 兼容性样本

这里检查中文、**粗体**、*斜体*、~~删除线~~、`行内代码` 和 https://example.com 自动链接。

[跳到公式](#数学公式) · [打开关联文档](welcome.md#公式也很自然) · [外部链接](https://example.com)

## 表格与任务

| 功能 | 结果 |
| :--- | ---: |
| 表格 | 支持 |
| 中文 | 正常 |

- [x] 已完成任务
- [ ] 待办事项

## 原始架构图

```mermaid
flowchart TB
    AUTH["可信认证方<br/>核定用户与 workspace"]
    W["workspace W1 的 Web<br/>用户 U1：手机、PC 多页面<br/>用户 U2：PC 页面"]
    subgraph SERVER["同一个 gateway 服务"]
        C["通信处理<br/>认证、连接、寻址、状态推送"]
        B["基础任务处理<br/>创建、领取、取消、恢复、结果"]
        E[("gateway.endpoints<br/>通信身份")]
        T[("gateway.tasks<br/>任务内容、队列、检查点、结果")]
        M["内存<br/>Socket、心跳、在线状态"]
        C --> E
        C <--> M
        C <--> B
        B <--> T
    end
    D1["Desktop D1<br/>当前执行任务 + 本地恢复记录"]
    D2["Desktop D2<br/>当前执行任务 + 本地恢复记录"]
    AUTH -->|登记已授权通信身份| E
    W <-->|提交、查询、状态同步| C
    C <-->|只向指定设备派发| D1
    C <-->|只向指定设备派发| D2
```

## 时序图

```mermaid
sequenceDiagram
    participant 用户
    participant 阅读器
    用户->>阅读器: 打开文档
    阅读器-->>用户: 展示内容
```

## 数学公式

行内公式 $E = mc^2$，GitHub 风格 $`\sqrt{3x-1}`$。价格 $10 和 $20 应保留原文。

$$
\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
\qquad \sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

```math
\int_0^1 x^2\,dx = \frac{1}{3}
```

## 提示与折叠

> [!NOTE]
> 这是 GitHub 风格提示。

> [!WARNING]
> 这是注意事项。

::: tip 小提示
这是 VitePress 风格的提示容器，支持 **Markdown**。
:::

::: details 展开详情
折叠区中的内容。
:::

<details><summary>HTML 折叠区</summary>

允许安全的 HTML 排版。<br/>这一行经过换行。

</details>

## 图片与代码

![相对路径 SVG 示例](assets/sample.svg)

```typescript
const greeting: string = '你好，Markdown';
console.log(greeting);
```

这里有一条脚注[^note]。

[^note]: 脚注内容可以包含 **格式**。

## 错误隔离

下面是故意写错的图，应显示错误和原文，后面的正文仍可阅读。

```mermaid
flowchart TB
    A[broken
```

**图表错误后，文档仍然可读。**
