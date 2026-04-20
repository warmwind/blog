---
title: Ecom-RLVE：面向电商对话 Agent 的自适应可验证环境
pubDatetime: 2026-04-20T11:00:00+08:00
description: 本文介绍 EcomRLVE-GYM——将 RLVE 框架从单轮推理扩展到多轮、工具增强的电商对话场景，提供 8 个可验证环境和 12 轴难度课程，并展示使用 DAPO 训练 Qwen 3 8B 的早期结果。
slug: ecom-rlve-adaptive-verifiable-environments-zh
originalTitle: "Ecom-RLVE: Adaptive Verifiable Environments for E-Commerce Conversational Agents"
originalUrl: https://huggingface.co/blog/ecom-rlve
tags:
  - 强化学习
  - 电商
  - Agent
  - RLVR
---

原文标题：Ecom-RLVE: Adaptive Verifiable Environments for E-Commerce Conversational Agents<br>
原文链接：https://huggingface.co/blog/ecom-rlve

> **摘要** — 我们将 RLVE 框架从单轮推理谜题扩展到**多轮、工具增强的电商对话**。EcomRLVE-GYM 提供 8 个可验证环境——商品发现、替代品推荐、购物车构建、退货处理、订单追踪、政策问答、套装规划和多意图旅程——每个环境都包含程序化问题生成、12 轴难度课程以及可算法验证的奖励。我们在 300 步内使用 DAPO 训练了 Qwen 3 8B 模型，并呈现早期结果，证明环境扩展和自适应难度能迁移到真实世界的 Agentic 任务完成。

本项目起源于 [Pytorch OpenEnv Hackathon](https://cerebralvalley.ai/e/openenv-hackathon-sf)，目前仍在持续演进，欢迎关注获取更新 🔥

## 为什么将强化学习用于购物 Agent？

大语言模型能够进行流畅对话，但将它们部署为购物助手时，会暴露出一个持续存在的差距：**流畅性 ≠ 任务完成**。一个询问"帮我找一个 25 美元以内、两天内发货的 USB-C 充电器"的客户，需要一个 Agent 能够调用正确的商品搜索、在三个硬性约束上进行过滤、避免幻构从未检索过的商品 ID，并在最佳结果缺货时处理后续问题。

监督微调可以从示范中教授表面层次的工具使用，但它无法扩展到真实电商所需的约束配置组合空间、部分信息对话和多步骤事务性工作流。

带可验证奖励的强化学习（RLVR）提供了一种替代方案：Agent 对*结果*进行优化——商品是否满足了约束？购物车是否正确？退货是否为正确的订单行发起？挑战在于构建既**可验证**（无大语言模型评判的主观性）又**自适应**（难度随策略能力增长）的奖励函数。

### 从 RLVE-Gym 到 EcomRLVE-GYM

RLVE-Gym 为排序、乘法、数独和其他算法推理任务提供了 400 个环境；然而，这些都是**单轮、文本输入/文本输出**的谜题——扩展到 Agentic 领域被留作未来工作。

EcomRLVE-GYM 填补了这一空白：我们保持在**可验证**的体制内（电商结果*可以*通过算法验证），同时扩展到**多轮、工具增强的 Agentic** 对话——Agent 必须*行动*（调用工具、修改世界状态）而非仅仅*推理*（生成文本答案），并补偿搜索系统的不足。

EcomRLVE-GYM 将客户服务结果转化为结构可验证的形式：

![可验证信号](https://cdn-uploads.huggingface.co/production/uploads/6893dd21467f7d2f5f358a95/dA0i6ZB3JDG-rqQtLRCy0.png)

上述所有信号都可以由能够访问隐藏真实目标的程序进行评估。无需人工标注或大语言模型评判。

---

## 训练 episode 的样子

在解释框架之前，让我们先看看难度 `d = 4` 时单个 EcomRLVE episode 的样子。环境生成一个隐藏目标，模拟用户发起对话，Agent 必须使用工具来满足请求。每个动作都通过算法验证——无需大语言模型评判。

<center><img src="https://cdn-uploads.huggingface.co/production/uploads/6893dd21467f7d2f5f358a95/qDXS-CPl8DT4JN6Uq6nrt.png" width="300" height="400" alt="Sample Episode" /></center>

奖励完全由代码计算：对 `(商品, 变体, 数量)` 元组的 F1 分数，用更少轮次完成的效率奖励，以及检查每个推荐商品 ID 是否确实在会话中被检索过的幻构惩罚。如果 Agent 选择了 Lightning 版本而非 USB-C，模拟用户会在对话中途纠正——F1 分数也会随之下降。

## 八个环境

每个环境覆盖一个不同的真实购物场景。Agent 必须使用工具（商品搜索、购物车操作、订单查询、政策查询）完成任务，并由程序评分——而非人工或另一个大语言模型。

| 环境 | Agent 必须做什么 |
|------|-----------------|
| **商品发现** | 找到满足用户所有约束的商品 |
| **替代品推荐** | 商品缺货——找到一个类似的、兼容的替代品 |
| **购物车构建** | 按照用户要求添加精确的商品、变体和数量 |
| **退货 + 换货** | 识别正确的订单行，发起退货，推荐替代品 |
| **订单追踪** | 解析用户指的是哪个订单并报告当前状态 |
| **政策问答** | 回答关于店铺政策的确定性问题（退货窗口、运费规则等） |
| **套装规划** | 在预算内为某个项目推荐完整购物清单 |
| **多意图旅程** | 处理按顺序串联 2-5 个上述任务的对话 |

每个环境使用相同的三部分奖励信号：

- **任务奖励** — Agent 是否真正完成了目标？（例如，是否推荐了正确的商品，购物车是否正确，是否追踪了正确的订单？）
- **效率奖励** — Agent 是否未浪费轮次就完成了任务？由*用户*引起的轮次（提出后续问题、确认操作）不计入 Agent——只有 Agent 犯错导致的轮次才计入。
- **幻构惩罚** — Agent 是否只推荐了在会话中实际检索过的商品？推荐从未查询过的商品 ID 会受到惩罚，因此 Agent 无法凭记忆捏造结果。

无效输出（格式错误的 JSON、非法工具调用）会立即触发失败分数，从第一步起就产生强烈的格式良好响应激励。

## 自适应难度课程

单个难度数字 `d` 同时控制任务的 12 个独立方面。这很重要，因为电商对话在很多不同方面同时存在难度——而不仅仅是沿单一维度。

![难度轴示意图](https://cdn-uploads.huggingface.co/production/uploads/6893dd21467f7d2f5f358a95/SALZRvBC6TP1HG1ZxqWsh.png)

以下是四个有代表性的难度轴：

| 变化内容 | 简单（`d = 0`） | 中等（`d = 6`） | 困难（`d = 12`） |
|----------|----------------|----------------|-----------------|
| 用户有**多少约束** | 2 | 5 | 8 |
| 用户**省略约束的频率** | 5% | 70% | ~80% |
| 搜索结果中**干扰项占比** | 0% | 12% | 24% |
| 对话中途**缺货的商品** | 0% | 30% | 50% |

其他八个轴涵盖轮次预算、输入噪声（错别字、俚语）、上下文切换、检索深度、订单历史规模、政策复杂度和工具预算。完整说明见[技术报告](https://github.com/owlgebra-ai/EcomRLVE-Gym)。

**自适应调度。** 每个环境独立追踪 Agent 的成功率，只有当 Agent 在当前级别稳定通过后才推进到更难的问题。这使每个环境都保持在 Agent 能力的前沿训练——既避免"太简单无法学习"，也避免"太困难无法取得进展"。

## 深度剖析：购物车构建（E_CART）

购物车构建是很好的展示案例，因为它需要完整的"搜索 → 检查 → 澄清 → 行动"循环，具有二元真实标签，并引入了大多数推荐基准中不存在的挑战：**变体选择**。

要成功完成任务，Agent 必须掌握五项不同技能：

| 技能 | 实际含义 |
|------|----------|
| **商品发现** | 使用良好构建的查询搜索商品目录以找到正确商品 |
| **变体选择** | 识别正确的颜色、尺寸或接口类型——而不仅仅是正确的商品 |
| **购物车管理** | 以用户要求的精确变体和数量添加商品 |
| **澄清对话** | 当请求模糊时（例如，缺少尺寸信息），向用户提出有针对性的后续问题 |
| **多商品订单** | 在单次对话中处理包含多种不同商品的购物清单 |

Agent 使用六种工具完成这些任务：

| 工具 | 功能 |
|------|------|
| `catalog_search` | 使用自然语言查询搜索商品目录 |
| `catalog_get_variants` | 返回商品的可用变体（颜色、尺寸、接口等） |
| `cart_add` | 以特定变体和数量将商品添加到购物车 |
| `cart_view` | 读取当前购物车以验证是否符合请求 |
| `user_get_visit_history` | 获取用户最近浏览的商品 |
| `ask_user` | 当缺少详细信息时向客户发送澄清问题 |

### 问题设置

生成器对 1-5 个目标商品进行采样（随难度 `d` 扩展），每个商品可能需要特定变体（USB-C vs Lightning，磨砂 vs 光滑）和数量 > 1。Agent 必须：

1. 搜索商品目录找到每个商品
2. 调用 `catalog.get_variants` 查看可用选项
3. 将正确的 `(商品_id, 变体_id, 数量)` 元组添加到购物车

### 为什么变体很重要

真实商品目录的变体数据很稀疏——许多商品没有变体，有变体的商品通常只按颜色或尺寸区分。为了创造更丰富的辨别任务，我们在**每个 episode 初始化时合成变体**：

- 每个类别的优先级列表选择最自然的变体属性（电子产品 → `connector_type`；服装 → `size`；厨具 → `material`）。
- 对于每个目标商品，生成 3 个变体：1 个目标 + 2 个似乎合理的干扰项。一款"Anker 65W USB-C 充电器"会产生 `{USB-C, Lightning, HDMI}`。
- 验证器检查**复合键** `(商品_id, 变体_id)` — 商品正确但变体错误意味着该单元不匹配。

### 难度扩展

| 轴 | d = 0 | d = 3 | d = 6 | d = 9 |
|----|-------|-------|-------|-------|
| **不同商品数** | 1 | 2 | 3 | 4 |
| **需要变体** | 21% | 66% | 93% | 99% |
| **多数量** | 0% | 30% | 50% | 50% |

在 `d = 0` 时，Agent 添加一个没有变体复杂度的单一商品——学习基础的 `catalog.search → cart.add` 工作流。在 `d = 6` 时，它要处理 3 个商品，几乎所有商品都需要特定变体，其中一半需要数量 > 1。

### 评分

购物车必须完全正确——正确的商品、正确的变体、正确的数量。对部分正确的购物车给予部分分数，但完美分数要求每个商品都匹配。如果 Agent 添加了错误的变体，模拟用户会在对话中途纠正（*"那是 Lightning 版本，但我需要 USB-C"*），给 Agent 一个在 episode 结束前自我纠正的机会。

### 轨迹：简单 vs 困难

来自 Qwen 3 8B Agent 的两个真实 E_CART episodes。相同的环境，相同的 Agent——仅仅是难度改变了游戏规则。

| | **d = 1** — 1 个商品，无变体 | **d = 8** — 3 个商品，变体 + 错别字 |
|---|---|---|
| **用户消息** | *"购物清单：SonicWave Keypad。请添加所有商品。"* | *"请将以下商品添加到我的**购物车**（cart 拼写错误）：GreenLeaf 的 Eco-**Frienly** **HrenLefa** 充电器，高性能 **AqaPure** 空气炸锅，**Lighrweiht** PixelVault Tank Top（3件）。"* — 来自噪声轴的错别字 |
| **第 1 轮** | `user.get_visit_history()` → 4 个结果。立即发现目标。 | `user.get_visit_history()` → 9 个结果。必须在充电器、空气炸锅和上衣之间消歧。 |
| **第 2 轮** | `cart.add("syn_000162", qty=1)` → 购物车：1 件商品，$2.74。*"我找到了 SonicWave Keypad。"* 用户：*"很好，就是这个。"* | 无工具调用——展示 3 个商品卡片。用户：*"添加 100W 输出的充电器、活性炭过滤器的空气炸锅，以及 3 件 XS 码的 Tank Top。"* |
| **第 3 轮** | `answer: { "done": true }` — **3 轮完成。** | `catalog.get_variants` × 3 → 充电器：6 个变体（100W、120W、30W...），空气炸锅：6 个（竹制、永久、**活性炭**...），Tank Top：7 个（**XS**、S、XL...）。用户：*"我需要三件 XS 的 Tank Top。"* |
| **第 4 轮** | | `cart.add(充电器, "100W", qty=1)` ✓ `cart.add(空气炸锅, "竹制", qty=1)` ✗ 应该是活性炭。`cart.add(tank_top, "size_XL", qty=3)` ✗ 应该是 XS。用户：*"空气炸锅是竹制而不是活性炭，Tank Top 是 XL 而不是 XS。"* |
| **第 5 轮** | | 重新获取 Tank Top 变体，添加 2 件 XS——**没有修复空气炸锅**。用户：*"空气炸锅还是显示竹制的。我需要三件 XS，不是两件。"* |
| **第 6 轮** | | 再次重新获取 Tank Top 变体——**仍然忽略空气炸锅**。用户：*"请更改空气炸锅变体。"* |
| **第 7 轮** | | *"我找不到活性炭过滤器变体。"* — 它确实存在；Agent 在第 3 轮看到了它，但从未选择。用户：*"那就跳过空气炸锅吧。"* |
| **第 8 轮** | | `answer: { "done": true }` — 购物车仍然错误：充电器 ✓，空气炸锅（竹制）✗，Tank Top（3件 XL + 2件 XS）✗ |
| **奖励** | `r_task` = +1.00，`r_eff` = +0.33，`r_hall` = 0.00，**r_total = +0.80** ✓ | `r_task` ≈ 0.00，`r_eff` = −0.43，`r_hall` = 0.00，**r_total = −0.06** ✗ |
| **结果** | 购物车与目标匹配。3 轮，2 轮有效。 | 变体错误，数量错误，用户放弃。8 轮，6 轮有效。 |

在 d=1 时，Agent 在 3 轮内干净利落地解决了任务。在 d=8 时，它陷入螺旋——选择竹制而非活性炭，XL 而非 XS，尽管用户两次纠正仍未修复空气炸锅，然后幻构说变体不存在。这正是难度课程所暴露的多步骤错误级联，也是自适应训练应该教会 Agent 从中恢复的。

## 用户模拟

可验证环境需要一个真实行为的用户模拟器。我们使用 **Qwen3.5（9.7B）** 生成自然、多样的用户消息，而不是固定模板——涵盖从充满错别字的请求到对话中途的话题切换。

两个设计选择对训练质量至关重要：

**偏好与陈述的约束匹配。** 每个模拟用户都有一组隐藏的偏好（价格敏感度、品牌忠诚度、配送速度等）。这些偏好故意偏向用户传达的任何约束——因此如果用户说"25 美元以内"，奖励函数实际上关心价格。没有这一点，Agent 可能因为正确遵循用户指令而受到惩罚。

**战略性省略。** 大语言模型故意在开场消息中保留某些约束，以迫使 Agent 提出澄清问题。系统精确跟踪什么被提及了、什么没有，因此 Agent 不会因为从未得到的信息而受到惩罚。

## 环境扩展

遵循 RLVE 的方法论，我们定义了嵌套的环境集合：

**C1 ⊂ C2 ⊂ C4 ⊂ C8**

| 集合 | 环境 | 训练技能 |
|------|------|----------|
| **C1** | 购物车 | 搜索查询构建、购物车操作 |
| **C2** | + 替代品推荐 | 约束下的相似性推理 |
| **C4** | + 商品发现、退货 | 事务性工作流（检索 + 推荐、退货发起） |
| **C8** | + 状态追踪、政策、套装、旅程 | 知识检索、规划、组合性 |

我们假设——与 RLVE 的发现一致——C8 Agent 的表现优于单环境专家，即使在专家的本职任务上也是如此。

## 早期结果

我们以 C1（购物车构建）为初始可行性研究，使用 DAPO 对 Qwen 3 8B 训练了 300 步。

| | 配置 |
|---|------|
| **基础模型** | Qwen 3 8B |
| **算法** | DAPO（G = 8 次 rollout/提示词） |
| **学习率** | 1e-5 |
| **商品目录** | 200 万商品，使用 `Alibaba-NLP/gte-modernbert-base`（768 维）的 FAISS 索引 |
| **用户模拟** | Qwen3.5 9.7B |

![难度级别准确率](https://cdn-uploads.huggingface.co/production/uploads/6893dd21467f7d2f5f358a95/eWQqFP-PbCJeNsn8klCQZ.png)

我们看到了达到难度级别的渐进式增长，证实自适应调度产生了稳定的学习信号，而非 RLVE 论文所预测的饱和（静态低难度）或饥饿（静态高难度）模式。

## 自己试试

使用下方嵌入的演示，直接在浏览器中运行一个实时 episode。以下是入门方法：

1. 从下拉菜单中**选择一个环境**（例如，`E_CART` 用于购物车构建，`E_PD` 用于商品发现）。
2. **设置难度** — `0` 是单约束的简单任务；`6+` 引入缺失信息、嘈杂检索和变体选择。
3. **点击"Reset Episode"** — 模拟用户将发起购物请求。
4. 现在你就是 Agent 了：进行工具调用，分析输出，并提交最终的商品 ID 列表。
5. 在运行之间点击 **"Reset Episode"** 以开始新的场景。

## 资源

[![模型](https://img.shields.io/badge/🤗%20Models-WUFUS-blue)](https://huggingface.co/collections/owlgebra-ai/wufus)
[![数据](https://img.shields.io/badge/🤗%20Catalog%20Data-Amazebay2M-yellow)](https://huggingface.co/datasets/owlgebra-ai/Amazebay-catalog-2M)
[![代码](https://img.shields.io/badge/Github-Code-black)](https://github.com/owlgebra-ai/EcomRLVE-Gym)
[![演示](https://img.shields.io/badge/🤗-Space-red)](https://huggingface.co/spaces/owlgebra-ai/EcomRLVE-Gym)

环境、验证器和训练配置均已开源：

```bash
git clone https://github.com/owlgebra-ai/EcomRLVE-Gym
cd EcomRLVE-Gym
pip install -e .
```

200 万商品目录已发布在 Hub 上：

```python
from datasets import load_dataset

catalog = load_dataset("owlgebra-ai/Amazebay-catalog-2M", split="train")
print(f"{len(catalog)} products loaded")
```

## 参考文献

1. Zeng, Z., Ivison, H., Wang, Y., et al. (2025). *RLVE: Scaling Up Reinforcement Learning for Language Models with Adaptive Verifiable Environments.* ICML 2025. [arXiv:2511.07317](https://arxiv.org/abs/2511.07317)

2. Yu, Q., Zhang, Z., Zhu, R., et al. (2025). *DAPO: An Open-Source LLM Reinforcement Learning System at Scale.* [arXiv:2503.14476](https://arxiv.org/abs/2503.14476)

3. Shao, Z., Wang, P., Zhu, Q., et al. (2024). *DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models.* [arXiv:2402.03300](https://arxiv.org/abs/2402.03300)

4. DeepSeek-AI. (2025). *DeepSeek-R1: Incentivizing Reasoning in LLMs through Reinforcement Learning.* Nature.

5. Meta AI. (2024). *Llama 3.1: A Foundation Model for General Intelligence.* [llama.meta.com](https://llama.meta.com)

6. Qwen Team. (2025). *Qwen3 Technical Report.* [arXiv:2505.09388](https://arxiv.org/abs/2505.09388)

## 引用

- 原文：[Ecom-RLVE: Adaptive Verifiable Environments for E-Commerce Conversational Agents](https://huggingface.co/blog/ecom-rlve)
- GitHub：[owlgebra-ai/EcomRLVE-Gym](https://github.com/owlgebra-ai/EcomRLVE-Gym)
- 数据集：[owlgebra-ai/Amazebay-catalog-2M](https://huggingface.co/datasets/owlgebra-ai/Amazebay-catalog-2M)
