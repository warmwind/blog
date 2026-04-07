---
title: "为什么 Codex Security 不提供 SAST 报告"
pubDatetime: 2026-03-19T22:05:00+08:00
description: "OpenAI 文章《Why Codex Security Doesn’t Include a SAST Report》中文翻译（含原文引用）。"
slug: why-codex-security-doesnt-include-sast-zh
originalTitle: "Why Codex Security Doesn’t Include a SAST Report"
originalUrl: https://openai.com/index/why-codex-security-doesnt-include-sast
---

原文标题：Why Codex Security Doesn’t Include a SAST Report  <br>
原文链接：https://openai.com/index/why-codex-security-doesnt-include-sast

# 为什么 Codex Security 不提供 SAST 报告

![](https://images.ctfassets.net/kftzwdyauwt9/7nFhulmdaa2ZpVlVwTmVQ/4772873488ecde6cb6d5525df99fb702/OAI_Why_Codex_Security_Doesn%C3%A2__t_Include_a_SAST_Report_SEO_16x9.png?w=1600&h=900&fit=fill)

数十年来，静态应用安全测试（SAST）一直是安全团队扩展代码审查能力的最有效方式之一。

但在构建 Codex Security 时，我们做了一个刻意的设计选择：我们并不是先导入一份静态分析报告，再让 agent 去分诊它。我们把系统设计为直接从代码仓库本身出发——从它的架构、信任边界以及预期行为出发——并在要求人类投入时间之前，先验证它发现的问题。

原因很简单：最棘手的漏洞通常并不是 dataflow 问题。它们发生在这样的情况下：代码看起来执行了某项安全检查，但这个检查实际上并不能保证系统所依赖的安全属性。换句话说，挑战不只是跟踪数据如何在程序中流动——而是判断代码中的防御措施是否真的有效。

人们往往把 SAST 描述成一条清晰的流水线：识别不受信任输入的 source，追踪数据在程序中的流动，并在数据未经净化就到达敏感 sink 时发出告警。这是一个优雅的模型，也确实覆盖了很多真实 bug。

但在实践中，SAST 为了在大规模代码库上保持可行，必须做出近似——尤其是在面对间接调用、动态分发、回调、反射以及大量依赖框架控制流的真实代码库时。这并不是对 SAST 的否定；这是在不执行代码的前提下推理程序时必须面对的现实。

但这本身还不是 Codex Security 不以 SAST 报告作为起点的原因。

更深层的问题在于：即便你已经成功把一个 source 追踪到了一个 sink，接下来会发生什么。

即便静态分析能够正确地跨越多个函数和层级追踪输入，它仍然必须回答那个真正决定漏洞是否存在的问题：

以一个常见模式为例：代码在渲染不受信任内容之前，会调用类似 `sanitize_html()` 这样的函数。静态分析器可以看到净化函数被调用了。但它通常无法判断：对于这里涉及的具体渲染上下文、模板引擎、编码行为以及后续转换，这个净化步骤是否真的足够。

难点就在这里。问题不只是数据是否到达了一个 sink，而是代码中的检查是否真的以系统所假设的方式约束了这个值。

换一种说法，“代码调用了一个 sanitizer”和“系统是安全的”之间，有着很大的差别。

下面这种模式在真实系统中非常常见。

一个 Web 应用接收一个 JSON payload，提取其中的 `redirect_url`，用 allowlist regex 对它做校验，然后执行 URL decode，最后把结果传给 redirect handler。

经典的 source-to-sink 报告可以描述这个流：

`untrusted input → regex check → URL decode → redirect`

但真正的问题并不是这个检查是否存在，而是：在后续转换之后，这个检查是否仍然以 redirect handler 所理解的方式约束了这个值。

如果 regex 是在 decode 之前执行的，那么它是否真的能像 redirect handler 解释 URL 那样去约束 decode 之后的 URL？

要回答这个问题，就必须推理整条 transformation chain：regex 允许什么、decode 和 normalization 的行为是什么、URL parsing 如何处理边缘情况，以及 redirect 逻辑如何解析 scheme 和 authority。

现实中很多重要漏洞都是这种形态：操作顺序错误、部分 normalization、解析歧义，以及 validation 与 interpretation 之间的不匹配。dataflow 是可见的，真正的薄弱点在于：约束如何沿着 transformation chain 传播——或者未能传播。

这并不是纯理论上的模式。在 [CVE-2024-29041](https://nvd.nist.gov/vuln/detail/CVE-2024-29041) 中，Express 就受到一个 open redirect 问题影响：由于 redirect target 的编码与后续解释方式之间存在差异，畸形 URL 可以绕过常见的 allowlist 实现。dataflow 本身很直接。更难的问题——也是决定 bug 是否存在的问题——在于这些校验在 transformation chain 之后是否依然成立。

Codex Security 围绕一个简单目标构建：用更强的证据暴露问题，从而减少分诊负担。在产品层面，这意味着使用 repo-specific context（包括 threat model），并在隔离环境中验证高信号问题，然后再把它们呈现给人类。

当 Codex Security 遇到看起来像“validation”或“sanitization”的边界时，它并不会把它视作一个勾选框。它会尝试理解这段代码想要保证什么——然后尝试证伪这个保证。

在实践中，这通常表现为以下几种方式的组合：

- 结合完整仓库上下文读取相关代码路径，像安全研究员那样寻找设计意图与实现之间的不匹配。这也包括注释，但模型不一定会相信注释；如果代码里确实有 bug，单独写上 `//Halvar says: this is not a bug` 并不会让它被误导。
- 把问题缩减到最小可测试切片（例如，围绕单个输入的 transformation pipeline），从而可以在不被系统其他部分干扰的情况下推理它。从这个意义上说，Codex Security 会抽出很小的代码片段，并为其编写 micro-fuzzer。
- 跨越多个 transformation 去推理约束，而不是把每个检查彼此孤立地看待。在合适情况下，这甚至可以被形式化为一个 satisfiability 问题。换句话说，我们为模型提供了一个包含 `z3-solver` 的 Python 环境，而在确有需要时，它很擅长像人类一样使用它来回答复杂输入约束问题。这对分析整数溢出或非标准架构上的类似 bug 尤其有用。
- 在可能时，把假设放进沙箱验证环境中执行，以区分“这可能是个问题”和“这就是个问题”。没有什么证据能比在 debug mode 编译后的代码上跑出完整端到端 PoC 更有说服力。

这就是关键转变：系统不再停留在“存在一个检查”这个层面，而是推动到“这个 invariant 成立（或者不成立），而这里是证据”。而模型会为此选择最合适的工具。

一个合理的反应是：为什么不能两者都做？先从一份 SAST 报告开始，再让 agent 继续深入推理。

在某些场景中，预先计算好的 findings 确实有帮助——尤其是针对狭窄、已知的 bug 类别。但对于一个旨在结合上下文去发现并验证漏洞的 agent 而言，从 SAST 报告出发会带来三种可预期的失败模式。

第一，它会鼓励过早收窄范围。findings 列表本质上是一张工具已经看过哪里的地图。如果你把它当作起点，就会让系统把过多精力投入到同样的区域、沿用同样的抽象方式，从而漏掉那些不符合该工具 worldview 的问题类型。

第二，它会引入难以逆转的隐含判断。很多 SAST findings 都编码了对 sanitization、validation 或 trust boundary 的假设。如果这些假设是错的，或者只是并不完整，那么把它们喂进推理循环，就会把 agent 从“调查”推向“确认或驳回”，而这并不是我们希望 agent 扮演的角色。

第三，它会让推理系统更难评估。如果整个流水线以 SAST 输出为起点，那么就很难区分：哪些问题是 agent 通过自身分析发现的，哪些是它从其他工具那里继承来的。如果你想准确衡量系统能力，这种区分非常重要，因为系统后续改进需要依赖这样的评估。

因此，我们把 Codex Security 设计为从安全研究开始的地方出发：从代码和系统意图出发，并在打断人类之前，先用验证来提高置信度门槛。

SAST 工具在它们擅长的事情上可以非常出色：强制执行安全编码规范、捕捉直接的 source-to-sink 问题，以及以可预测的权衡在大规模范围内检测已知模式。它们可以成为 defense-in-depth 的强有力组成部分。

这篇文章的范围更窄：它讨论的是，为什么一个被设计来推理系统行为并验证 findings 的 agent，不应让自己的工作起点锚定在一份静态 findings 列表上。

还值得强调一个与此相关的限制：并不是所有漏洞都是 dataflow 问题。很多真实失败是 state 与 invariant 问题——工作流绕过、授权缺口，以及“系统处于错误状态”的 bug。对于这些类型的 bug，不存在一个被污染的值到达某个单一“危险 sink”的过程。风险存在于程序默认某些条件永远为真。

我们预期安全工具生态会继续进步：静态分析、fuzzing、运行时防护以及 agentic workflows 都会扮演各自角色。

我们希望 Codex Security 真正擅长的是安全团队成本最高的那一部分：把“这看起来可疑”转化成“这是真的，这里是它如何失败的，以及一个符合系统意图的修复方案”。

如果你想进一步了解 Codex Security 如何扫描代码仓库、验证 findings 并提出修复方案，可以查看[我们的文档](https://developers.openai.com/codex/security/)。

## 引用

- [Why Codex Security Doesn’t Include a SAST Report](https://openai.com/index/why-codex-security-doesnt-include-sast)
- [Codex Security documentation](https://developers.openai.com/codex/security/)
- [CVE-2024-29041](https://nvd.nist.gov/vuln/detail/CVE-2024-29041)
