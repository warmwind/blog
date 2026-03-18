---
title: "发布 GPT-5.4 mini 与 nano（中文翻译）"
pubDatetime: 2026-03-18T22:00:00+08:00
description: "OpenAI 文章《Introducing GPT-5.4 mini and nano》中文翻译（含原文引用）。"
slug: introducing-gpt-5-4-mini-and-nano-zh
---

> 原文标题：Introducing GPT-5.4 mini and nano  
> 原文链接：https://openai.com/index/introducing-gpt-5-4-mini-and-nano

# 发布 GPT-5.4 mini 与 nano

![GPT-5.4 mini and nano Hero](https://images.ctfassets.net/kftzwdyauwt9/6EnJZAuVLIIArGkpgWz9Mh/92ab6109d7f17ca20ebc70e830294c66/5.4_Mini_Nano_Hero___SEO.png?w=1600&h=900&fit=fill)

今天我们发布 GPT‑5.4 mini 和 nano，这是我们目前能力最强的小型模型。它们把 GPT‑5.4 的许多优势带到更快、更高效、面向高吞吐工作负载的模型上。

GPT‑5.4 mini 在编码、推理、多模态理解和 tool use 上相较 GPT‑5 mini 明显提升，同时运行速度超过 2 倍。它在多项评测上也接近更大体量的 GPT‑5.4，包括 SWE-Bench Pro 与 OSWorld-Verified。

GPT‑5.4 nano 是 GPT‑5.4 系列中最小、最便宜的版本，面向速度与成本最关键的任务。它相较 GPT‑5 nano 也有显著升级。我们推荐将它用于分类、数据提取、排序，以及处理较简单支撑任务的 coding subagents。

这些模型面向的工作负载类型中，延迟会直接影响产品体验：需要即时响应的 coding assistants、快速完成支撑任务的 subagents、需要捕获并解释截图的 computer-using systems，以及可对图像进行实时推理的多模态应用。在这些场景中，最优模型通常不是最大模型，而是能够快速响应、可靠使用 tools，并且在复杂专业任务上仍有良好表现的模型。

## 评测对比（xhigh）

| Benchmark | GPT-5.4 | GPT-5.4 mini | GPT-5.4 nano | GPT-5 mini (high¹) |
| --- | ---: | ---: | ---: | ---: |
| SWE-Bench Pro (Public) | 57.7% | 54.4% | 52.4% | 45.7% |
| Terminal-Bench 2.0 | 75.1% | 60.0% | 46.3% | 38.2% |
| Toolathlon | 54.6% | 42.9% | 35.5% | 26.9% |
| GPQA Diamond | 93.0% | 88.0% | 82.8% | 81.6% |
| OSWorld-Verified | 75.0% | 72.1% | 39.0% | 42.0% |

¹ GPT‑5 mini 可用的最高 reasoning_effort 为 `high`。

以下是客户在工作流中测试 GPT‑5.4 mini 与 nano 后的反馈：

GPT‑5.4 mini 与 nano 在需要快速迭代的编码工作流中尤其有效。模型可以在低延迟下处理定向修改、代码库导航、前端生成和调试循环，因此非常适合那些需要以更快速度、更低成本完成的编码任务。

在基准测试中，GPT‑5.4 mini 在相近延迟下持续优于 GPT‑5 mini，并且在更快速度下接近 GPT‑5.4 级别的通过率，在编码工作流中呈现了很强的“性能/延迟”平衡。

我们通过观察模型在生产环境中的行为，并在离线环境中进行模拟来估算延迟。该延迟估算考虑了 tool 调用时长（代码执行时间）、采样 token 与输入 token。真实场景中的延迟可能存在显著差异，并会受到模拟未覆盖因素的影响。同样，成本估算基于撰写本文时这些模型的 API 定价，未来可能变化。reasoning effort 从 low 到 xhigh 进行了扫描。

GPT‑5.4 mini 也适合把不同体量模型组合在一起的系统。以 Codex 为例，更大的模型（如 GPT‑5.4）可以负责规划、协调和最终判断，同时把更窄的并行子任务委派给 GPT‑5.4 mini subagents，例如搜索代码库、审阅大文件或处理辅助文档。可在文档中了解 Codex 的 subagents 工作方式：<https://developers.openai.com/codex/subagents/>。

随着小模型变得更快、更强，这种模式会更有价值。开发者不必用单个模型处理所有工作，而是可以构建这样的系统：大模型负责决策，小模型负责高并发快速执行。对于这类工作方式，GPT‑5.4 mini 是我们迄今最强的 mini 模型。

GPT‑5.4 mini 在多模态任务上也表现强劲，特别是与 computer use 相关的任务。模型可以快速理解密集用户界面的截图，以更快速度完成 computer use 任务。在 OSWorld-Verified 上，GPT‑5.4 mini 接近 GPT‑5.4，同时显著优于 GPT‑5 mini。

## 可用性与价格

GPT‑5.4 mini 今日已在 API、Codex 与 ChatGPT 中提供。

在 API 中，GPT‑5.4 mini 支持文本与图像输入、tool use、function calling、web search、file search、computer use 与 skills。它拥有 400k context window，价格为每 1M 输入 token 0.75 美元、每 1M 输出 token 4.50 美元。

在 Codex 中，GPT‑5.4 mini 可用于 Codex app、CLI、IDE extension 与 web。它仅消耗 GPT‑5.4 配额的 30%，开发者可以用约三分之一成本更快处理更简单的编码任务。Codex 也可将推理强度更低的工作委派给 GPT‑5.4 mini subagents，在更便宜的模型上运行。

在 ChatGPT 中，GPT‑5.4 mini 通过 “Thinking” 功能向 Free 与 Go 用户提供（在 `+` 菜单中）。对其他用户，GPT‑5.4 mini 作为 GPT‑5.4 Thinking 的限流回退模型提供。

GPT‑5.4 nano 仅在 API 中提供，价格为每 1M 输入 token 0.20 美元、每 1M 输出 token 1.25 美元。

关于模型安全防护的更多信息，请参考 Deployment Safety Hub 上的 System Card 增补：<https://deploymentsafety.openai.com/gpt-5-4-thinking/appendix-gpt-5.4-mini>。

## 分项基准

### Coding

| Benchmark | GPT-5.4 (xhigh) | GPT-5.4 mini (xhigh) | GPT-5.4 nano (xhigh) | GPT-5 mini (high¹) |
| --- | ---: | ---: | ---: | ---: |
| SWE-bench Pro (Public) | 57.7% | 54.4% | 52.4% | 45.7% |
| Terminal-Bench 2.0 | 75.1% | 60.0% | 46.3% | 38.2% |

### Tool-calling

| Benchmark | GPT-5.4 (xhigh) | GPT-5.4 mini (xhigh) | GPT-5.4 nano (xhigh) | GPT-5 mini (high¹) |
| --- | ---: | ---: | ---: | ---: |
| MCP Atlas | 67.2% | 57.7% | 56.1% | 47.6% |
| Toolathlon | 54.6% | 42.9% | 35.5% | 26.9% |
| τ2-bench (telecom) | 98.9% | 93.4% | 92.5% | 74.1% |

### Intelligence

| Benchmark | GPT-5.4 (xhigh) | GPT-5.4 mini (xhigh) | GPT-5.4 nano (xhigh) | GPT-5 mini (high¹) |
| --- | ---: | ---: | ---: | ---: |
| GPQA Diamond | 93.0% | 88.0% | 82.8% | 81.6% |
| HLE w/ tool | 52.1% | 41.5% | 37.7% | 31.6% |
| HLE w/o tools | 39.8% | 28.2% | 24.3% | 18.3% |

### MM / Vision / CUA

| Benchmark | GPT-5.4 (xhigh) | GPT-5.4 mini (xhigh) | GPT-5.4 nano (xhigh) | GPT-5 mini (high¹) |
| --- | ---: | ---: | ---: | ---: |
| OSWorld-Verified | 75.0% | 72.1% | 39.0% | 42.0% |
| MMMUPro w/ Python | 81.5% | 78.0% | 69.5% | 74.1% |
| MMMUPro | 81.2% | 76.6% | 66.1% | 67.5% |
| OmniDocBench 1.5 (no tools)² — lower is better | 0.109 | 0.1263 | 0.2419 | 0.1791 |

### Long context

| Benchmark | GPT-5.4 (xhigh) | GPT-5.4 mini (xhigh) | GPT-5.4 nano (xhigh) | GPT-5 mini (high¹) |
| --- | ---: | ---: | ---: | ---: |
| OpenAI MRCR v2 8-needle 64K–128K | 86.0% | 47.7% | 44.2% | 35.1% |
| OpenAI MRCR v2 8-needle 128K–256K | 79.3% | 33.6% | 33.1% | 19.4% |
| Graphwalks BFS 0K–128K | 93.1% | 76.3% | 73.4% | 73.4% |
| Graphwalks parents 0–128K (accuracy) | 89.8% | 71.5% | 50.8% | 64.3% |

¹ GPT‑5 mini 可用的最高 reasoning_effort 为 `high`。  
² Overall Edit Distance。OmniDocBench 在 reasoning_effort 设为 `none` 的条件下运行，以反映低成本、低延迟表现。

## 引用

- OpenAI. *Introducing GPT-5.4 mini and nano*.  
  https://openai.com/index/introducing-gpt-5-4-mini-and-nano
- OpenAI Developers. *Codex subagents*.  
  https://developers.openai.com/codex/subagents/
- OpenAI Deployment Safety Hub. *GPT-5.4 mini appendix*.  
  https://deploymentsafety.openai.com/gpt-5-4-thinking/appendix-gpt-5.4-mini
