---
title: RAG 对时间视而不见——我在生产环境中构建了一个时序层来修复这一问题
pubDatetime: 2026-05-11T10:00:00+08:00
description: 作者在构建 RAG 驱动的 AI 辅导助手时发现，向量搜索毫无时间概念，会持续返回已过期的旧文档。本文详细介绍了在检索器与 LLM 之间插入一个时序层的完整方案：对过期事实强制过滤、对时效性信号进行提升、用指数衰减使系统优先选取仍然正确的内容。
slug: rag-temporal-layer-zh
originalTitle: "RAG Is Blind to Time — I Built a Temporal Layer to Fix It in Production"
originalUrl: "https://towardsdatascience.com/rag-is-blind-to-time-i-built-a-temporal-layer-to-fix-it-in-production/"
tags:
  - RAG
  - LLM
  - AI
---

原文标题：RAG Is Blind to Time — I Built a Temporal Layer to Fix It in Production<br>
原文链接：https://towardsdatascience.com/rag-is-blind-to-time-i-built-a-temporal-layer-to-fix-it-in-production/

![RAG Temporal Layer](https://towardsdatascience.com/wp-content/uploads/2026/05/RAG-Temporal-Layer.jpg)

测试开始三周后，一位学员发消息说我给出了错误答案。

她向辅导助手询问了我某篇生成式 AI 教程中的一个概念。那个回答看起来没问题，但实际上并不对。我已经在两个月前重写了那部分内容，而我的 RAG 系统却拉取了六个月前的旧版本——不是明显错误，只是错得足以产生误导。

她以为是自己理解有误。但其实不是。是我自己的系统在用我早已替换掉的旧知识教她。

我正在为 [EmiTechLogic](https://emitechlogic.com/)（我的技术教育平台）构建一个 RAG 驱动的助手——将内容库转化为一个能够直接从我自己的文章中生成答案的系统。我在[这里](https://emitechlogic.com/building-an-ai-powered-tutor-with-rag-and-vector-databases/)记录了最初的架构设计。最初的架构还算可控，真正的挑战从真实学员开始使用这个在线系统时才出现。

当我查看检索日志时，我清楚地看到了问题所在。向量存储中同时存在两个版本的文档。旧版本因为拥有更多匹配的词元和更高的余弦相似度而排名靠前。更新的版本排在第二位，有时甚至排第三。

我原以为较新的文档会自动胜出，但余弦相似度并不是这样工作的。

系统做的正是它被设计要做的事，而这恰恰成了问题所在。

这种模式在其他查询中也反复出现——我更新过的 Python 教程、我修订过的模型对比指南，旧版本总是首先浮现。我正在构建的 AI 工具悄悄地用我早已替换掉的旧知识教导着用户。

下面是一个实际案例，同样的查询，同样的语料库，用朴素 RAG：

```
QUERY: What are the API rate limits? Will I get a 429 error?

NAIVE RAG
  1. [policy_v1]          age=540d | EXPIRED | sim=0.447
     "API rate limits are set to 100 requests per minute..."
  2. [announcement_today] age=0d   | valid   | sim=0.329
  3. [tutorial_old]       age=600d | EXPIRED | sim=0.303
```

一份已过期 540 天的文档高居榜首，而 48 小时前发布的最新公告却排在第二位。检索器完全不在乎新鲜度，它只匹配词汇。

我以为新鲜度会在流水线的某个环节被处理，但事实并非如此，没有人想到要添加这一功能。

这篇文章讲的就是我如何修复这个问题。我构建了一个**时序层**——一个位于向量搜索结果和 LLM 之间的层，让系统真正关注时间。

---

## TL;DR

如果你时间有限：向量搜索对"某件事何时为真"毫无概念。我通过在检索器和 LLM 之间添加一个重排序步骤来修复这一问题——它强制移除已过期的事实，提升当前有效的时效性信号，并使用指数衰减来优先选取较新的文档。棘手的部分是确保"新鲜"不会凌驾于"相关"之上。

**一句话总结**：朴素 RAG 找到的是相似的内容，时序 RAG 找到的是仍然正确的内容。

> **完整代码：[https://github.com/Emmimal/temporal-rag/](https://github.com/Emmimal/temporal-rag/)**

---

## 适用对象

任何知识库会随时间变化的 RAG 系统。如果你的系统曾经基于你已更新、已弃用或已替换的文档给出了自信满满的回答——那这篇文章就是为你写的。

这一问题在以下场景中最为突出：API 和产品文档、事故与故障管理、客服知识库、内部维基和政策系统，以及内容不断演进的教育平台。

如果你的知识库是静态且永不变化的，可以跳过。如果你的内容完全没有过期、版本迭代或时效性信号的概念，也可以跳过。如果返回过时答案不会造成实质性影响，同样可以跳过。

---

## 向量搜索为何对时间没有概念

标准的 RAG 流水线会对文档进行向量化编码，对查询也进行编码，找出最近邻匹配，然后将它们发送给模型 [1, 2]。如果你的信息从不改变，这没什么问题。但如果你在不断发布新指南并重写旧内容，这就会悄无声息地失效——你甚至可能直到有用户抱怨才会察觉。

向量存储只知道向量之间的夹角 [10]，它完全不知道哪份文档有六个月的历史，哪份是上周才发布的。

常见的解决方法是删除旧文档或添加元数据过滤器。我都试过了，有效期大约两周，然后我再次更新内容，同样的问题又出现了。一份被施加了 20% 惩罚的文档，如果词汇重叠度足够强，仍然可以排第一。

当我深入研究后，我意识到这不是一个大问题，而是三个独立的问题，每一个都需要不同的解决方案。

我一直把三者都归入"过期内容"这一大类，并对所有问题施加同样的修复。这就是为什么什么都解决不了的原因。

---

## 三类时间问题，三种不同的解决方案

### 1. 过期（Expiration）：一个现在已经错误的事实

有些文档有明确的过期日期。在过期日期之后展示它们，不是新鲜度问题——而是在撒谎。你不能只是降低它们的权重，必须在模型看到它们之前就完全移除它们。

### 2. 时效性（Temporality）：仅在当下为真的事实

有些信息在一个短暂的时间窗口内极为重要。一份关于网站宕机的实时通知或一项 48 小时内有效的政策变更，不只是额外的背景信息——在其有效窗口打开期间，它是知识库中最重要的文档。窗口关闭一小时后，它就成了错误信息。

### 3. 版本迭代（Versioning）：一个已被替代的事实

这是我遇到的最大问题。当我更新一份文档时，两个版本都留在了向量存储中。旧版本因为拥有更多匹配词汇而不断胜出。这里的解决方案既不是删除也不是提升，而是让时间衰减来处理。当新鲜度成为排名信号的一部分时，较新的文档自然会超过较旧的。

| 问题 | 性质 | 错误的修复方式 | 正确的修复方式 |
|------|------|--------------|--------------|
| 过期 | 事实现在为假 | 降低权重 | 排名前强制移除 |
| 时效性 | 事实当前有效且紧迫 | 视为普通内容 | 窗口打开期间提升 |
| 版本迭代 | 事实已被取代 | 强制移除 | 时间衰减让较新的排更高 |

**我反复看到同样的模式：旧文档、已过期文档和临时通知都被当作同一个问题处理。** 实践中，它更像是一套规则集合，而非真正的时序检索模型。

---

### 与现有研究的关联

我研究了现有方案——基于图的检索、带时间戳的向量嵌入、将时效性信号直接嵌入检索器本身。时间感知语言模型将时序信号直接烘焙到模型权重中 [5]，而互联网增强方法则在查询时实时抓取最新文档 [3]。RealTime QA [4] 将这个问题框架化为答案时效性问题而非检索排名问题。所有这些方案都需要重建我没有的基础设施。我需要的是能直接插入我已经在运行的系统的东西。

于是我改为构建一个后检索层——一个应用于密集段落检索下游的重排序步骤 [6]。无需改变检索器，无需新的向量嵌入模型，无需新的基础设施。所需的只是每份文档上的一个时间戳，以及查询时的一个重排序步骤。

我需要的是几天内就能在线上平台运行的东西，而不是全面重建。这就是那个方案。

---

## 我构建的内容：一个时序层

我最终构建的时序层位于检索器和 LLM 之间。检索器保持不变，仍然根据余弦相似度拉取排名前 20 的候选文档。时序层接收这些候选文档，对它们重新分类，并在任何文档到达模型之前对其进行重排序。

![时序层流水线架构图，展示了从用户查询到向量检索器、经过 8 步时序层处理（使用衰减和新鲜度评分）、最终输出重排后的前 3 个来源进入 LLM Context Window 的完整流程](https://contributor.insightmediagroup.io/wp-content/uploads/2026/05/The-Temporal-Layer-Pipeline-638x1024.png)

检索器和 LLM 之间的那个间隙，才是所有真正工作发生的地方。

---

## 核心设计：两个正交轴

**关键设计决策是两个独立的分类轴，而非一个。**

**轴 1：有效性状态（3 种状态）**

```
EXPIRED  -> 曾经为真，现在不再为真。排名前强制移除。
VALID    -> 无当前时间约束的真实内容。正常评分。
TEMPORAL -> 在当前有效时间窗口内为真。提升权重。
```

大多数系统只运行两种状态：有效和已过期。我缺失的是一个独立的 TEMPORAL 状态，用于处理当前有效的时效性信号。维护通知与永久规则不同，它是紧迫的，需要优先展示。一旦维护结束，通知就转入 EXPIRED 状态并被移除。

完整代码可在我的项目文件夹中找到。以下是主逻辑的简化版本：

**TEMPORAL 状态受文档类型限制。**

```python
# TEMPORAL state is gated on document kind.
# Only EVENT documents reach TEMPORAL — not VERSIONED, not STATIC.
if self.kind == DocumentKind.EVENT:
    return ValidityState.TEMPORAL

return ValidityState.VALID  # VERSIONED docs with valid_from are still just VALID
```

带有所有边界情况的完整实现已链接在"自行运行"章节中。

**轴 2：文档类型（3 种类型）**

```
STATIC    -> 永恒的事实（定义、数学知识、参考资料）
VERSIONED -> 已被更新信息替代（政策、教程、规范）
EVENT     -> 仅在时间窗口内为真（公告、故障通知）
```

这个区分非常重要。没有它，我的第一个版本会将新公司政策归类为临时事件并将其提升到所有搜索结果的顶部。政策更新与实时故障通知的行为不同，即使两者都是最新的。它应该正常排名，并随时间缓慢失分。

**修复方式：** 我规定只有"事件"（如新闻或告警）可以获得"紧急"提升。普通文档永远不会被如此对待。

```
policy_v2:          kind=VERSIONED  state=valid    window=supersedes policy_v1
announcement_today: kind=EVENT      state=temporal  window=42h remaining
```

即使时间戳相同，这两份文档的行为也会有所不同，因为它们代表了不同类型的信息。

![网格图，展示了文档有效性状态（已过期、有效、时效性）与文档类型（静态、版本化、事件）之间的交叉关系，以确定时序 RAG 系统中的检索处理方式。只有时效性 × 事件这个单元格才会获得提升，所有已过期的单元格都被强制移除，静态和版本化文档无法达到时效性状态。](https://contributor.insightmediagroup.io/wp-content/uploads/2026/05/Two-Axes-Grid-1024x666.png)

---

## 评分公式

每份文档的最终得分将向量相似度与时序信号结合起来：

```python
final_score = semantic_penalty
            × [(1 − w) × vector_score
               + w × (decay_score × recency_score
                      × validity_multiplier × event_relevance_multiplier)]
```

其中：

**`vector_score`：** 余弦相似度，归一化为相对于候选池的 0 到 1 之间的值。

**`decay_score`：** 基于文档年龄的指数衰减，这是一种应用于信息检索中文档新鲜度排名的技术 [10]。

```
decay = 0.5 ^ (age_in_days / half_life_days)
```

你还可以根据文档类型更改得分下降的速度。例如，**新闻**在仅 **7 天**内就会淡出，但**法律文件**在 **365 天**内仍保持强势。

**`recency_score`：** 当前候选池内的相对比较。最新的文档获得最高分，最旧的获得最低分。这确保系统始终优先选择*当前可用*的最新选项，而不仅仅是绝对意义上的最新选项。

**`validity_multiplier`** — 根据有效性状态应用：

```
EXPIRED  -> 0.0  （安全网；应该已经被过滤掉）
VALID    -> 1.0  （正常）
TEMPORAL -> 1.2  （对当前有效的 EVENT 信号进行提升）
```

**`event_relevance_multiplier`** — 仅应用于 `EVENT` 文档：

```
EVENT + TEMPORAL + raw_cosine >= floor -> 1.0  （完整提升）
EVENT + TEMPORAL + raw_cosine <  floor -> 0.5  （提升减半）
```

**`semantic_penalty`** — 应用于所有文档类型：

```
normalized_score >= min_threshold -> 1.0  （无惩罚）
normalized_score <  min_threshold -> 0.3  （相关性惩罚）
```

**`w`** 是 `temporal_weight`——语义相关性和时序信号之间的权衡。在**我平台的辅导助手**中，我将其设置为 0.40，这意味着 60% 的得分仍然来自语义相关性，40% 来自时间维度。

![流程图，展示时序 RAG 混合评分公式的构成。最终得分分为左边的语义惩罚和右边的时序组件，分别权重为 60% 向量和 40% 时序。时序组件向下连接到四个子组件：衰减得分、新鲜度得分、有效性乘数和事件相关性门控。衰减得分向下链接到所有七种半衰期配置。](https://contributor.insightmediagroup.io/wp-content/uploads/2026/05/Scoring-Formula-1024x700.png)

---

## 暴露事件相关性门控的那次失败

第一个版本运行后，我注意到了一个新问题。一位用户询问"工程团队健康状况"，但排名第一的结果却是一份网站维护通知。

那份通知是最新的，但与问题毫不相关。它之所以胜出，仅仅因为它是系统中最新鲜的东西。**仅仅是"新"还不够，文档还需要是相关的。**

如果没有任何相关性门控，新鲜的告警就开始出现在毫不相干的查询中。

于是我添加了一个强制要求：事件只有在其原始余弦得分达到最低阈值时才能获得提升。如果内容谈论的不是正确的主题，时效性优势就会消失。

```python
def _event_relevance_multiplier(self, doc, state, raw_vector_score) -> float:
    if doc.kind != DocumentKind.EVENT:
        return 1.0
    if state != ValidityState.TEMPORAL:
        return 1.0
    floor = self.config.event_min_raw_vector_score
    return 1.0 if raw_vector_score >= floor else 0.5
```

**为什么使用原始余弦而不是归一化值？** 因为它充当绝对标尺。

归一化得分是相对的。如果你的所有结果都很差，"最不差"的那个可能仍然得到 80%。这是危险的。原始余弦不关心其他文档。如果一个关于"团队健康"的查询与"技术更新"几乎没有共同点，得分无论如何都会接近于零。

```
reason: EVENT signal present but low query relevance
        (raw sim 0.101 < 0.2) — temporal boost halved
```

**阈值校准说明：** 你用作"安全守卫"的阈值数字取决于你使用的 AI 模型类型。

- TF-IDF / 稀疏向量：使用约 0.20 的阈值。词汇匹配得分自然较低。
- 密集模型如 `text-embedding-3-small` 或 `all-MiniLM-L6-v2` [7]：使用 0.35 到 0.50。这些模型默认得分更高，所以阈值需要上移。

---

## 四个场景：前后对比

这些是在相同查询上以两种方式运行 demo.py 的实际输出：朴素 RAG 和时序 RAG。

### 场景 1 — API 速率限制（已过期的答案是危险的）

```
QUERY: What are the API rate limits? Will I get a 429 error?

NAIVE RAG
  1. [policy_v1]          age=540d | EXPIRED | sim=0.447
  2. [announcement_today] age=0d   | valid   | sim=0.329
  3. [tutorial_old]       age=600d | EXPIRED | sim=0.303

TEMPORAL RAG
  [announcement_today]
    age          : 0.3 days  |  kind: EVENT  |  state: temporal (active)
    window       : 42h remaining
    reason       : Active EVENT signal (42h remaining) — overrides static sources
    FINAL SCORE  : 1.079

  [policy_v2]
    age          : 175.0 days  |  kind: VERSIONED  |  state: ✓ valid
    reason       : Latest version — supersedes policy_v1
    FINAL SCORE  : 0.573

  [news_recent]
    age          : 30.0 days  |  kind: STATIC  |  state: ✓ valid
    reason       : Fresh, open-ended fact — high confidence
    FINAL SCORE  : 0.509

  removed  : ['policy_v1', 'tutorial_old']
  surfaced : ['policy_v2', 'news_recent']
```

朴素 RAG 告诉用户每分钟 100 个请求会触发 429 错误。而实际限制是 1,000 个。时序 RAG 以实时维护公告（速率限制当前暂停）为首，其次是当前政策。

### 场景 2：LLM 规模化研究

```
QUERY: Do larger language models keep improving with scale?

NAIVE RAG
  1. [tutorial_old]   age=600d | EXPIRED | sim=0.226
  2. [research_2022]  age=730d | valid   | sim=0.141
  3. [research_2026]  age=120d | valid   | sim=0.136

TEMPORAL RAG
  [research_2026]  STATIC ✓ valid  score=0.662
    reason: Stale — semantically relevant but low freshness weight
  [research_2022]  STATIC ✓ valid  score=0.600
    reason: Stale — semantically relevant but low freshness weight
  [news_old]       STATIC ✓ valid  score=0.476
    reason: Stale — semantically relevant but low freshness weight

  removed : tutorial_old
  surfaced: news_old
```

朴素 RAG 因词汇重叠将一份已失效的文档排第一。时序 RAG 将其移除，并将 2026 年的研究放到顶部——这才是它应在的位置。本场景中的语料库文档反映了规模化研究的真实转变：早期的平台效应发现 [8] 后来被计算最优规模化研究 [9] 所修正。

### 场景 3 — 公司健康状况（单一故事与全貌）

```
QUERY: What is the current state of the engineering team and company health?

NAIVE RAG
  1. [news_old]      age=400d | valid   | sim=0.600
  2. [tutorial_new]  age=85d  | valid   | sim=0.385
  3. [tutorial_old]  age=600d | EXPIRED | sim=0.304

TEMPORAL RAG
  [news_old]     STATIC    ✓ valid  score=0.602
    reason: Stale — semantically relevant but low freshness weight
  [news_recent]  STATIC    ✓ valid  score=0.543
    reason: Fresh, open-ended fact — high confidence
  [tutorial_new] VERSIONED ✓ valid  score=0.519
    reason: Latest version — supersedes tutorial_old

  removed  : tutorial_old
  surfaced : news_recent
```

实时公告没有出现在这里，因为它未能通过相关性门控——其原始余弦值为 0.165，低于 0.20 的阈值。但两篇新闻文章都出现了，这正是正确的结果。LLM 现在可以读取两篇文章，了解事情随时间的变化。朴素 RAG 只呈现了旧故事和两篇不相关的指南。

### 场景 4 — 实时故障（紧急信号被埋没）

```
QUERY: Are there any current API outages or limit suspensions I should know about?

NAIVE RAG
  1. [policy_v1]          age=540d | EXPIRED | sim=0.390
  2. [policy_v2]          age=175d | valid   | sim=0.267
  3. [announcement_today] age=0d   | valid   | sim=0.101

TEMPORAL RAG
  [policy_v2]           VERSIONED ✓ valid     score=0.641
    reason: Latest version — supersedes policy_v1
  [announcement_today]  EVENT     temporal  score=0.465
    reason: EVENT signal present but low query relevance
            (raw sim 0.101 < 0.2) — temporal boost halved
  [news_recent]         STATIC    ✓ valid     score=0.082
    reason: Penalized: normalized vector score 0.000 below relevance threshold

  removed : policy_v1
```

朴素 RAG 将实时更新埋在第三位，放在一个已过期的政策后面。时序 RAG 将其移至第二位。它没有排第一是因为"outages"和"upgrades"之间的词汇重叠较低。如果使用密集向量嵌入而不是 TF-IDF，它会轻松占据首位。

---

## 接下来出了什么问题——以及我如何修复它

一旦核心时序层运行起来，真实查询又带来了更多意外。以下是接下来出现的问题。

**当一份文档太旧而无法单独回答，但又太有用而不能丢弃**

有些文档并没有错，只是足够旧了，以至于我不希望它们单独回答问题。于是我在 SOLO 和 DROP 之间添加了第三种操作：弱文档只有在一个较新的来源与其配对时才会被检索。无效的文档永远不会到达模型。

```
[Invalid] research_old     decay=0.100  → DO NOT RETRIEVE
[Weak]    research_weak    decay=0.351  → PAIR WITH research_fresh (gain=+0.540)
[Good]    research_fresh   decay=0.891  → RETRIEVE
```

**当得分看起来不错但答案不确定时**

高得分不等于高置信度。当两份文档的得分分别为 0.73 和 0.72 但相互矛盾时，系统不应表现得像是确定的。我添加了置信度等级，检查得分差距并标记冲突——分差太小或存在矛盾时，无论原始得分多高，结果都会降为 LOW。

```
policy_v3 — clear winner:         confidence 0.7485  → HIGH
policy_v3 — conflict, narrow margin: confidence 0.4727  → LOW
math_theorem:                     confidence 0.6992  → MEDIUM
```

第二个 policy_v3 行才是关键：得分因冲突提升而升高，置信度却因冲突是警告信号而下降。

**了解某样东西被拒绝的原因**

当系统拒绝一份文档时，我需要准确了解是哪条规则触发了，以及是针对哪个查询触发的。我添加了一个按 query_id 建立索引的失败日志。

```
Failure summary (3 rejections — query_id=d211ffdc)
  EXPIRED_VERSIONED_DOC   × 1   doc=expired_policy
  STALE_STATIC_DOC        × 1   doc=stale_reference
  BELOW_RELEVANCE_GATE    × 1   doc=fresh_irrelevant
```

使用中的代码：`EXPIRED_VERSIONED_DOC`、`STALE_STATIC_DOC`、`HARD_EXPIRED_EVENT`、`BELOW_RELEVANCE_GATE`、`OUT_OF_TIME_RANGE`、`PAIR_PARTNER_NOT_FOUND`。当出现错误文档时，我首先打开这个日志。

**当事实在版本之间发生重大变化时**

将"每分钟 100 个请求"替换为"每分钟 1,000 个请求"不是措辞变化。我添加了冲突严重性检测，它会提升胜出文档的得分，同时降低其置信度——这样正确答案会浮现，但模型会保持谨慎。

```
'100'  → '5000'    severity=0.980   boost=+0.196   conf_pen=-0.098   (50× — severe)
'1000' → '500'     severity=0.500   boost=+0.100   conf_pen=-0.050
'1000' → '1000'    severity=0.000   boost=0         conf_pen=0
```

**当用户指定时间范围时**

一位学员输入了"给我看 2021 到 2023 年的研究"。系统返回了最近的三份文档——没有一份来自那个时间段。时间衰减使情况更糟，将较新的文档排得更高，而用户明确想要旧的文档。

我添加了一个时间范围解析器，当查询发出日期窗口信号时，施加严格过滤，而在没有此类信号时完全退出。我不希望它去猜测。

```
'Show me research from 2021-2023'  → kept: research_2022
'What were the findings in 2019?'  → kept: research_2019
'Latest embeddings research'       → no filter, all docs pass
```

**当查询告诉你新鲜度应该有多重要时**

"当前速率限制是什么？"需要最新鲜的可用答案。"余弦相似度是如何工作的？"不关心它是否是三年前写的。我之前对两者都施加相同的时序权重。权重现在根据查询中的信号词进行调整。

```
'What is the current rate limit?'          → temporal_weight: 0.70
'Has the rate limit changed recently?'     → temporal_weight: 0.55
'How does cosine similarity work?'         → temporal_weight: 0.20 (baseline)
```

**洞察系统内部——并将版本冲突排除在上下文之外**

我不仅想知道每份文档的排名，还想知道该如何处理它。新鲜度报告为每份文档提供基于类型的建议：

```
fresh_event    [EVENT]     grade: A   → Verify before serving, window closes soon
current_policy [VERSIONED] grade: D   → Check for a newer version
math_theorem   [STATIC]    grade: F   → May have been superseded
```

最后一个问题更微妙。即使重排序效果很好，当同一政策的 v1 和 v3 都出现在上下文中时，LLM 也会产生模糊或取平均的答案。它不知道信任哪个版本——它会尝试调和它所看到的一切。解决方案是在文档进入时序层之前，先按版本链进行去重。

```
Input: policy_v1 (v1), policy_v2 (v2), policy_v3 (v3)
  policy_v1 — EXPIRED → removed
  policy_v2 — superseded by v3 → removed
  policy_v3 — kept ✓

Result: ['policy_v3']
```

Policy v3 进入上下文，冲突从未出现。

---

## 并非所有内容都以相同速度衰减

当我将其应用于平台时，有一件事很快变得清晰：单一的半衰期值不适用于所有内容类型。突发更新和数学定义的老化方式截然不同，以同样方式对待它们悄悄地破坏了排名效果。

```
breaking_news:  half_life=1d,     temporal_weight=0.70
news:           half_life=7d,     temporal_weight=0.55
policy:         half_life=90d,    temporal_weight=0.45
research:       half_life=180d,   temporal_weight=0.35
legal:          half_life=365d,   temporal_weight=0.25
reference:      half_life=1825d,  temporal_weight=0.10
mathematics:    half_life=36500d, temporal_weight=0.01
```

![折线图，展示七种内容类型在 365 天内的指数衰减得分。突发新闻在数天内降至接近零。普通新闻在数周内跟随。政策、研究、法律和参考资料的衰减依次减慢。数学在整个一年中几乎保持平稳，反映了 36500 天的半衰期。](https://contributor.insightmediagroup.io/wp-content/uploads/2026/05/Half-life-Decay-Curves-1024x630.png)

对于突发新闻来说，"新"基本上就是全部价值所在。对于数学证明来说，年龄无关紧要——70 年前的定理与上周的定理同样有效。在 EmiTechLogic 上，我将内容分组为几个类别：教程使用"政策"设置（因为较新的通常更好），参考资料使用"参考"设置（因为事实不会过期）。正确做出这个区分，才是让整个方案真正奏效的关键。

在半衰期之上还有一个约束：衰减下限。如果没有下限，一篇 1954 年的数学定理衰减得分会接近于零——不是因为它是错的，而仅仅因为它很旧。时序组件会拖低它的最终得分，即使语义匹配很强。下限可以防止这种情况。在实现中，`DECAY_FLOORS` 将 `(doc_type, kind)` 对映射到最小衰减值——`mathematics/STATIC` 下限为 0.95，`reference/STATIC` 为 0.70，`research/STATIC` 为 0.10。没有下限条目的文档自由衰减；有下限的文档永远不会低于其最小值。一个碰巧很旧的余弦相似度胜者仍然可以在语义层面竞争，而不是因为年龄而自动落败。

实现成本比你预期的要低。时序重排序步骤每次搜索增加大约 15 到 30 毫秒——相比 LLM 推理通常需要的 1 到 4 秒来说可以忽略不计。你不需要更改你的搜索引擎、数据或向量嵌入模型。整个时序层是一个纯 Python 后处理步骤，运行在你已经在使用的任何向量搜索的下游。

唯一真正的前期要求是文档上的元数据。至少，每份文档需要一个 `created_at` 时间戳。`valid_from`、`valid_until` 和 `kind` 能给出最佳结果，但它们是可选的——没有任何元数据的文档会回退到 STATIC/VALID 加标准时间衰减评分，这已经比没有强。在我的平台上，我完全自动化了标记过程。系统现在能在不需要我手动标注任何内容的情况下，区分更新、告警和永久事实。

---

## 这无法解决的问题

在你构建之前，先了解几点诚实的注意事项。

**隐式过期**是我仍然没有完全解决的问题。大多数文档不会宣告自己何时变得过时——一篇关于已弃用接口的教程没有过期日期，所以系统无法知道它正在腐化。我的启发式规则能捕获明显的情况，但边缘情况还是会溜过去，而且我发现它们的方式与发现最初问题的方式相同：一位学员得到了一个悄悄错误的答案。

**来源冲突**完全超出了时序层的处理范围。它会浮现最近且最相关的文档——解决它们之间的分歧是 LLM 的任务，而非检索器的。

**校准**是模型特定的，会以你意想不到的方式影响效果。0.20 的原始余弦阈值是针对 TF-IDF 调整的。像 text-embedding-3-small 这样的密集模型在绝对值上得分更高，所以该阈值需要调整到 0.35–0.50。在信任我列出的任何阈值之前，请先针对你自己的查询进行测试。

**半衰期配置文件**是起点，而非常量。对于法律团队来说，"过时"的含义与新闻网站截然不同。在你所在领域的真实查询上运行系统，并从那里进行调整。

---

## 结论

问题不在于 RAG 系统检索了错误的文档——而在于它们没有"某件事何时为真"的概念，只知道与查询有多相似。

两个轴驱动了整个设计——类型轴是我几乎完全忽略的那个。**有效性状态**——文档是已过期（移除它）、有效（正常评分）还是时效性（在其窗口有效期间提升它）。**文档类型**——它是一个永恒的事实（`STATIC`）、已被替换的内容（`VERSIONED`），还是仅在时间窗口内为真的内容（`EVENT`）。

没有类型轴，一份有生效日期的版本化政策看起来与时效性事件完全一样，并且会被错误标记。系统因一个听起来合理的原因产生了错误结果。这是生产环境中最难发现的 bug 类别，因为看起来一切都没有损坏。

语义阈值关闭了最后的漏洞。当时序得分很高时，新鲜但不相关的文档可能会占据排名首位。为 EVENT 文档设置最小原始余弦阈值，确保新鲜度永远不会完全凌驾于相关性之上。

> **仅靠相似性已经不够了。我需要检索器关心信息是否仍然有效。**

---

## 自行运行

完整实现（`temporal_rag.py`、`demo.py` 和 `advanced.py`）可在以下地址获取：

> **GitHub：[https://github.com/Emmimal/temporal-rag/](https://github.com/Emmimal/temporal-rag/)**

该代码库包含完整的 `validity_state` 实现、所有衰减配置、`SequenceAwareRetriever` 以及新鲜度报告 API。Demo 无需任何 API 密钥即可运行，使用确定性 TF-IDF 向量嵌入器，让你可以在任何机器上重现上面展示的确切输出。

```bash
git clone https://github.com/Emmimal/temporal-rag/
cd temporal-rag
pip install numpy
python demo.py
```

---

## 参考文献

### 基础 RAG

[1] Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W.-T., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *Advances in Neural Information Processing Systems*, *33*, 9459–9474. https://arxiv.org/abs/2005.11401

[2] Gao, Y., Xiong, Y., Gao, X., Jia, K., Pan, J., Bi, Y., Dai, Y., Sun, J., Wang, M., & Wang, H. (2024). Retrieval-augmented generation for large language models: A survey. *arXiv preprint arXiv:2312.10997*. https://doi.org/10.48550/arXiv.2312.10997

### 语言模型中的时序推理

[3] Lazaridou, A., Gribovskaya, E., Stokowiec, W., & Grigorev, N. (2022). Internet-augmented language models through few-shot prompting for open-domain question answering. *arXiv preprint arXiv:2203.05115*. https://doi.org/10.48550/arXiv.2203.05115

[4] Kasai, J., Sakaguchi, K., Takahashi, Y., Le Bras, R., Asai, A., Yu, X., Radev, D., Smith, N. A., Choi, Y., & Inui, K. (2022). RealTime QA: What's the answer right now? *arXiv preprint arXiv:2207.13332*. https://doi.org/10.48550/arXiv.2207.13332

[5] Dhingra, B., Cole, J. R., Eisenschlos, J. M., Gillick, D., Eisenstein, J., & Cohen, W. W. (2022). Time-aware language models as temporal knowledge bases. *Transactions of the Association for Computational Linguistics*, *10*, 257–273. https://doi.org/10.1162/tacl_a_00459

### 密集检索与重排序

[6] Nogueira, R., & Cho, K. (2019). Passage re-ranking with BERT. *arXiv preprint arXiv:1901.04085*. https://doi.org/10.48550/arXiv.1901.04085

[7] Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using siamese BERT-networks. *Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing and the 9th International Joint Conference on Natural Language Processing (EMNLP-IJCNLP)*, 3982–3992. https://doi.org/10.18653/v1/D19-1410

### 规模化定律（场景 2 中引用）

[8] Kaplan, J., McCandlish, S., Henighan, T., Brown, T. B., Chess, B., Child, R., Gray, S., Radford, A., Wu, J., & Amodei, D. (2020). Scaling laws for neural language models. *arXiv preprint arXiv:2001.08361*. https://doi.org/10.48550/arXiv.2001.08361

[9] Hoffmann, J., Borgeaud, S., Mensch, A., Buchatskaya, E., Cai, T., Rutherford, E., de las Casas, D., Hendricks, L. A., Welbl, J., Clark, A., Hennigan, T., Noland, E., Millican, K., van den Driessche, G., Damoc, B., Guy, A., Osindero, S., Simonyan, K., Elsen, E., Rae, J. W., Vinyals, O., & Sifre, L. (2022). Training compute-optimal large language models. *arXiv preprint arXiv:2203.15556*. https://doi.org/10.48550/arXiv.2203.15556

### 信息检索基础

[10] Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to information retrieval*. Cambridge University Press. https://nlp.stanford.edu/IR-book/

---

## 声明

本文所有代码均由作者本人编写，属原创作品，在 Python 3.12.6 上开发和测试。基准数字和检索输出来自作者本地机器（Windows 11，仅 CPU）上的实际 Demo 运行，通过克隆代码库并运行 `demo.py` 和 `advanced.py` 可复现。时序层、评分公式、文档分类系统及所有设计决策均为独立实现，并非源自任何已引用的代码库。Demo 无需任何 API 密钥，使用确定性 TF-IDF 向量嵌入器运行；`numpy` 是复现所有展示输出所需的唯一外部依赖。作者与本文提及的任何工具、库或公司均无财务关联。
