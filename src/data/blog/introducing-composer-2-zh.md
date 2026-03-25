---
title: "Cursor 发布 Composer 2：前沿水准的编程模型（中文翻译）"
pubDatetime: 2026-03-25T23:00:00+08:00
description: "Cursor 研究博客《Introducing Composer 2》中文翻译（含原文引用）。Composer 2 在多项编程基准测试中大幅领先，以极具竞争力的定价提供前沿级编程智能。"
slug: introducing-composer-2-zh
---

> 原文标题：Introducing Composer 2
> 原文链接：https://cursor.com/blog/composer-2

# Composer 2 发布

*Cursor 团队 — 2026 年 3 月 19 日*

Composer 2 现已在 Cursor 中可用。

它在编程方面达到了前沿水准，定价为 $0.50/M 输入 token 和 $2.50/M 输出 token，成为智能与成本的全新最优组合。

## 前沿级编程智能

我们正在快速提升模型质量。Composer 2 在我们衡量的所有[基准测试](https://cursor.com/blog/cursorbench)上都取得了大幅提升，包括 Terminal-Bench 2.0 和 SWE-bench Multilingual：

![CursorBench 散点图](https://ptht05hbb1ssoooe.public.blob.vercel-storage.com/assets/blog/composer-2-scatter-r4.png)

| 模型 | CursorBench | Terminal-Bench 2.0 | SWE-bench Multilingual |
|------|-------------|-------------------|----------------------|
| Composer 2 | 61.3 | 61.7 | 73.7 |
| Composer 1.5 | 44.2 | 47.9 | 65.9 |
| Composer 1 | 38.0 | 40.0 | 56.9 |

![Terminal-Bench 分数对比](https://ptht05hbb1ssoooe.public.blob.vercel-storage.com/assets/blog/composer-2-terminal-bench-score-r9.png)

这些质量提升得益于我们首次进行的持续预训练（continued pretraining），这为扩展强化学习提供了更强的基础。

在此基础上，我们通过强化学习在[长时间段编程任务](https://cursor.com/blog/self-driving-codebases)上进行训练。Composer 2 能够解决需要数百次操作的高难度任务。

## 试用 Composer 2

Composer 2 定价为 $0.50/M 输入 token 和 $2.50/M 输出 token。

我们还提供了一个**具有相同智能的更快变体**，定价为 $1.50/M 输入 token 和 $7.50/M 输出 token，其成本低于其他快速模型。快速版本现已成为默认选项。完整详情请参阅[模型文档](https://cursor.com/docs/models/cursor-composer-2)。

![速度与成本对比](https://ptht05hbb1ssoooe.public.blob.vercel-storage.com/assets/blog/composer-speed-cost-r12.png)

在个人计划中，Composer 的使用量属于一个独立的[使用池](https://cursor.com/docs/models-and-pricing#usage-pools)，包含慷慨的免费额度。立即在 Cursor 或[新界面的早期 Alpha 版本](https://cursor.com/glass)中试用 Composer 2。

---

**注释：**

1. Terminal-Bench 2.0 由 Laude Institute 维护。Anthropic 使用 Claude Code harness；OpenAI 使用 Simple Codex harness。Cursor 的分数使用 Harbor 评估框架在默认设置下计算，每个模型-Agent 对取 5 次迭代的平均值。

2. TPS 数据来自 2026 年 3 月 18 日 Cursor 流量快照。Anthropic 的 token 约比标准 token 小 15%，已做相应归一化处理。速度因服务商容量不同而有所差异。

---

## 引用

- 原文：[Introducing Composer 2](https://cursor.com/blog/composer-2) — Cursor Research Blog，2026 年 3 月 19 日
