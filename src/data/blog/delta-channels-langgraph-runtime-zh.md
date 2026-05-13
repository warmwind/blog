---
title: Delta Channel：我们如何演进 LangGraph Runtime 以支持长时间运行的 Agent
pubDatetime: 2026-05-13T10:00:00+08:00
description: LangGraph 1.2 引入 DeltaChannel 原语，通过仅存储每步的差量来解决长时间运行 Agent 中 O(N²) 检查点存储增长问题，在 200 轮编码 Agent 场景中实现超过 40 倍的存储压缩。
slug: delta-channels-langgraph-runtime-zh
originalTitle: "Delta Channels: How We're Evolving our Runtime for Long-Running Agents"
originalUrl: https://www.langchain.com/blog/delta-channels-evolving-agent-runtime
tags:
  - LangGraph
  - Agent
  - 翻译
---

原文标题：Delta Channels: How We're Evolving our Runtime for Long-Running Agents<br>
原文链接：https://www.langchain.com/blog/delta-channels-evolving-agent-runtime

![Delta Channels 封面图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a02945979ee92b3ee28b009_05.12%20delta%20channels.png)

**核心要点：**

- 在默认的全快照模型下，检查点存储以 O(N²) 增长——对于消息历史较长且使用文件系统上下文的 Agent 来说，这会很快带来实际的运营成本压力。
- `DeltaChannel` 每步只存储差量，并每 K 步写一次完整快照，在会话变长时保持存储成本平稳，同时将恢复延迟控制在合理范围内。
- 升级过程透明无感：现有线程继续正常工作，`messages` 和 `files` 在 Deep Agents v0.6 中默认采用 Delta 存储，完整的 LangGraph API（中断、时间回溯、工具链）保持不变。

Deep Agents 构建在 LangGraph 运行时之上，后者会在每一步为 Agent 的执行进度创建检查点。正是这一机制使可观测性、人在回路（human-in-the-loop）和故障恢复成为可能：你始终可以精确知道 Agent 当前所处的位置，并能从任意节点恢复执行。

随着 Agent 能力的不断增强：

1. 它们运行时间更长，消息历史跨越数十甚至数百步持续增长
2. 它们使用的上下文更多，借助文件系统进行上下文管理和卸载

对于 Deep Agents 来说，消息历史和文件都存储在 Agent 状态中，而采用"每步全量快照"的方式，检查点存储会以 **O(N²)** 的速度增长。对于运行 200 轮的编码 Agent，当前的检查点方式会向检查器序列化 5.3GB 的数据。Delta Channel 将其压缩至 129 MB，超过 40 倍的降幅，而状态重建的性能几乎没有下降。

Delta Channel 正是我们为跟上这一趋势而演进运行时的方式。`DeltaChannel` 是 `langgraph 1.2` 中引入的新原语，它改变了累积型状态字段的检查点方式。每一步不再序列化完整快照，而是只存储差量（diff）。系统会定期写入完整快照，以控制恢复成本。对 Deep Agents 而言，这意味着 `messages` 和 `files` 均采用基于 Delta 的存储。你依然能获得完整的 Agent 执行历史，只是存储成本大幅降低。

LangGraph 中对于消息历史较长的 Agent，检查点存储以 O(N²) 增长。对于运行 200 轮的编码 Agent，这意味着 5.3 GB。Delta Channel 将其压缩至 129 MB——降低 41 倍，且完全免费。

## 问题：O(N²) 的检查点存储

LangGraph 默认的检查点模型会在每一步写入 Agent 状态的完整快照。对于小型、短生命周期的 Agent 来说，这完全没问题。但 `messages` 和 `files` 是*仅追加的累积器*——它们只会不断增长。

在全量快照检查点机制下，第 N 个检查点包含从第 1 步到第 N 步的所有内容：

![全量快照检查点示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a036b2b0e08283c346e78c0_checkpoint_before_split%20(1)%201.png)

这种增长会在检查点层面形成复合效应：每一步序列化的数据比上一步更多，写入更大的数据块到检查器，并消耗更多内存来持有这些数据。你在为序列化时间、写放大和冗余存储付出代价。

## 解决方案：Delta Channel

Channel 是 LangGraph 用于表示图状态中"字段"的基本原语。不同的 channel 类型控制数据如何在检查点中传递。

`DeltaChannel` 是 LangGraph 新引入的 channel 类型（自 1.2 起进入 Beta 阶段），它改变了累积型字段的检查点表示方式。

在普通步骤中，`DeltaChannel` **只写入该步骤新增的更新内容**，即一个微小的差量。

每隔 `snapshot_frequency=K` 步（`deepagents` 默认为 50），系统会写入一次完整快照。这将恢复时重建状态的成本控制在合理范围内：运行时只需回溯到最近的快照，最多只需重放 K 步的差量。如果没有周期性快照，超长会话的恢复时间会非常慢。

![Delta Channel 快照示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a036b3f6842e4704c5ad797_checkpoint_after_split%201.png)

底层的增长仍然是二次方的（因为快照每 K 步写一次），但系数约为基线的 ~1/K。在实际会话长度下，O(N) 的差量项占主导地位，且由于重建成本以 K 为界，恢复延迟保持平稳。存储收益几乎是免费的。

以下是标准快照方式与 Delta 方式的并排比较：

![存储方式对比图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a029525790bff5c3e6d132d_delta_channel_card_v2%20(1)%20(1).svg)

## 基准测试结果

`DeltaChannel` 是 LangGraph 的原语，但驱动它诞生的工作负载——也是我们在此进行基准测试的场景——是 Deep Agents 编码会话。长消息历史和文件系统上下文卸载，恰恰是那种 O(N²) 检查点增长会产生实际运营问题的状态形态。

我们运行了两种工作负载：

| | 工作负载 A | 工作负载 B |
|---|---|---|
| 场景 | 轻量编码/搜索 Agent | 多文件特性实现 |
| 每轮文件写入 | 1 × 1 KB | 2 × 8 KB |
| 每轮搜索结果 | 1 × 1 KB | 1 × 5 KB |
| 大型搜索结果 | 每 10 轮 82 KB | 每 5 轮 100 KB |
| 每轮 AI 响应 | 极少 | ~200 tokens |

周期性的大型搜索结果超过了 FilesystemMiddleware 的 20k token 驱逐阈值，并从 `messages` 卸载到 `files`。

### 测试方法

所有基准测试使用完全模拟的工作负载——无真实 LLM 调用、`InMemorySaver`、确定性 Mock 模型、完全可复现。表格报告的是**检查器总存储量**：整个会话中保存器中累积的所有字节数。Token 数量使用 `FilesystemMiddleware` 内部驱逐阈值所用的 `total_message_chars / 4` 近似值。

测试配置如下：

```py

checkpointer = InMemorySaver()
agent = create_deep_agent(    
	model=_MockModel(),   # deterministic mock, no API calls    
	tools=[external_search],    
	checkpointer=checkpointer,
)
for i in range(turns):    
	agent.invoke({"messages": [HumanMessage(...)]}, config)
```

### 工作负载 A：轻量编码与搜索

存储一开始增长缓慢，然后随着全量快照大小的复合增长急剧加速。到 500 轮时，基线已累积 4 GB；Delta Channel 则保持在 110 MB 以下。

![工作负载 A 数据表](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a029690503100adf662db3f_table_workload_a%20(2)%20(1).svg)

节省比率从 10 轮时的 6 倍增长到 500 轮时的 41 倍——仍在攀升，但随着逼近理论上的 ~K 倍上限而减速。该上限并不固定：`snapshot_frequency` 是可配置的，因此你可以根据工作负载在恢复延迟和存储节省之间进行权衡。K 越大，每个会话的完整写入次数越少，存储降幅越大，代价是恢复时需要重放的差量略多。

![工作负载 A 图表](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a0296a4e72ef4424a04dd6a_chart_workload_a%20(2).svg)

### 工作负载 B：多文件编码会话

每轮状态量更大，O(N²) 曲线上升更陡。基线仅在 200 轮时就达到 5.3 GB——这不过是一个下午的 Agent 工作量。

![工作负载 B 数据表](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a0296bb2b7db2e536d0d613_table_workload_b%20(2)%20(1).svg)

在 200 轮时节省比率达到 41 倍且仍在攀升——两种工作负载都趋向同一 ~K 倍的渐近线，但更重的工作负载到达得更快，因为每轮更大的写入量会更激进地放大二次系数。

![工作负载 B 图表](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/6a0296c77f447828189b0736_chart_workload_b%20(1).svg)

在每个轮次计数下，工作负载 B 的节省比率持续高于工作负载 A，因为每轮更大的状态量会更快地放大 O(N²) 系数。两种工作负载都趋向同一渐近线（~`snapshot_frequency` 倍），但更重的工作负载更早到达。

## API

### **Deep Agents 中**

Delta Channel 在 `deepagents v0.6` 中默认开启。`messages` 和 `files` 均采用 Delta Channel 存储。无需任何配置。

### **LangGraph 中**

DeltaChannel 是 LangGraph 中的一等公民原语，你可以将其用于任何状态字段。

```python
from typing_extensions import Annotated

from langgraph.channels.delta import DeltaChannel

def append(state: list[str], writes: list[list[str]]) -> list[str]:
	return state + [item for batch in writes for item in batch]

class MyAgentState(TypedDict):   
	items: Annotated[list[str], DeltaChannel(reducer=append, snapshot_frequency=50)]
```

两个参数：

- **`reducer`** — 一个纯函数 `(state, list[writes]) -> new_state`，必须满足批处理不变性：`reducer(reducer(s, xs), ys) == reducer(s, xs + ys)`。详见下文的 [reducer 约束](#the-reducer-contract-associativity-across-folds)。
- **`snapshot_frequency`** — 写入完整快照的频率（默认：1000）。值越高，每个会话的完整写入次数越少，但恢复时需要重放更多差量。`deepagents` 使用 50。

这就是整个 API 层面的变化。现有的工具、中断处理和时间回溯全部继续工作。

### **reducer 约束：跨折叠的结合性**

`DeltaChannel` 对 reducer 施加了比旧版 `BinaryOperatorAggregate` channel 更严格的要求。这是定义自己的 Delta 存储状态时唯一需要搞对的事情。

### **旧版约束**

```python
def reducer(existing: T, update: T) -> T: ...
```

### **新版约束**

```python
# 批量折叠——一次性传入所有累积的写入
def reducer(state: T, writes: list[T]) -> T: ...
```

`DeltaChannel` 在单次调用中传入自上次加载以来累积的所有写入。无论这些写入如何分批，重建结果必须完全相同：

```python
reducer(reducer(state, [w1, w2]), [w3, w4]) == reducer(state, [w1, w2, w3, w4])
```

这被称为**批处理不变性**。如果你的 reducer 违反了这一约束，Delta Channel 的状态将与完整快照悄悄地产生分歧，而且只会在跨越快照边界的会话中出现。

### **从 pre-delta 线程迁移**

无需数据迁移。当 `DeltaChannel.from_checkpoint` 遇到普通状态值（而非 `_DeltaSnapshot`）时，会直接将其用作基础状态。现有线程继续正常工作——升级后的第一个新检查点会开始在这个普通值种子之上写入差量。

## 下一步

Delta Channel 已发布于 `deepagents v0.6` 和 `langgraph v1.2`。升级路径应该是无缝的。

Delta Channel 带来的收益随着会话变长而不断复利增长。具有深度上下文的长时间运行 Agent 是这个领域的发展方向，而 Delta Channel 正是我们的运行时用来满足这一需求的演进方式。

## 引用

- 原文：[Delta Channels: How We're Evolving our Runtime for Long-Running Agents](https://www.langchain.com/blog/delta-channels-evolving-agent-runtime)
- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [Deep Agents](https://www.langchain.com/deep-agents)
