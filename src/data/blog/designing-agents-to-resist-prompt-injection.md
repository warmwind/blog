---
title: Designing AI agents to resist prompt injection（中文翻译）
pubDatetime: 2026-03-14T15:00:00+08:00
description: OpenAI 文章《Designing AI agents to resist prompt injection》的中文翻译（含原文引用）。
slug: designing-agents-to-resist-prompt-injection
---

> 原文标题：Designing AI agents to resist prompt injection  
> 原文链接：https://openai.com/index/designing-agents-to-resist-prompt-injection

![](https://images.ctfassets.net/kftzwdyauwt9/7vwwEVWeYVswN8KAIIRiAZ/3b21f7147ba40289879f844649d6897e/OAI_Designing_AI_agentsto_resist_prompt_injection_SEO_16x9.png?w=1600&h=900&fit=fill)

AI agent 正越来越能够浏览网页、检索信息，并代表用户执行操作。这些能力很有用，但也带来了攻击者操纵系统的新方式。

这些攻击通常被称为 [prompt injection](https://openai.com/index/prompt-injections/)：把指令放入外部内容中，试图让模型去做用户并未要求的事。根据我们的经验，这类攻击在现实世界中最有效的形式，越来越像社会工程，而不只是简单的提示覆盖。

这种变化很重要。如果问题不只是识别恶意字符串，而是要在上下文中抵御误导性或操纵性内容，那么防御就不能只依赖输入过滤。还需要把系统设计成：即使部分攻击成功，操纵造成的影响仍然被约束。

## Prompt injection 正在演化

早期“prompt injection”类攻击可以很简单，比如在维基百科条目中加入给 AI agent 的直接指令；在训练阶段缺少这种对抗环境经验时，AI 模型通常会不加质疑地执行这些指令<sup>[1](#citation-bottom-1)</sup>。随着模型更智能，它们对这类建议也更不脆弱；我们观察到，prompt injection 风格攻击开始加入社会工程元素。

在更广泛的 AI 安全生态里，常见建议包括“AI firewalling”之类技术：在 AI agent 与外部世界之间放置中间层，把输入分类为恶意 prompt injection 或正常输入。但这种已充分发展的攻击通常不会被这类系统捕获。对这些系统来说，检测恶意输入变成了与“识别谎言或错误信息”同样困难的问题，而且往往还缺乏必要上下文。

## 社会工程与 AI agent

随着现实世界 prompt injection 攻击复杂度提升，我们发现最有效的进攻技术利用了社会工程策略。我们不再把“带社会工程要素的 prompt injection”视作独立或全新的问题类别，而是用管理其他领域“针对人类社会工程风险”的同一视角来处理。在这些系统里，目标不只是完美识别恶意输入，还要把 agent 和系统设计成：即使操纵成功，影响也受到约束。这样的系统同时能有效缓解 prompt injection 与社会工程。

从这个角度看，可以把 AI agent 视为与客服代理类似的三方系统：agent 试图代表其雇主行动，但会持续暴露在可能误导它的外部输入中。无论是人类客服还是 AI 客服，都需要对其能力施加限制，以降低处在恶意环境中的下行风险。

设想一个场景：一个人类客服在系统中可以发放礼品卡和退款，以处理配送慢、故障损害等客户不便。这是一个多方问题：企业要信任代理基于正当理由退款，同时代理又要与可能误导它、甚至胁迫它的第三方互动。

在现实世界中，代理会被赋予一套规则去遵循；但也预期到在其所处的对抗环境中会被误导。比如客户发送消息称退款未到账，或以伤害相威胁要求退款。代理所交互的确定性系统会限制给某个客户可发放的退款额度、标记潜在钓鱼邮件，并提供其他缓解机制，以降低单个代理被攻破带来的影响。

这种思路指导了我们已部署的一套稳健对策，用以满足用户的安全预期。

## 这如何指导我们在 ChatGPT 中的防御

在 ChatGPT 中，我们将这种社会工程模型与更传统的安全工程方法（如 source-sink analysis）结合。

在这个框架下，攻击者既需要 source（影响系统的途径），也需要 sink（在错误上下文中会变得危险的能力）。对 agentic 系统来说，这通常意味着把“不受信任的外部内容”与某个动作结合起来，例如向第三方传输信息、跟随链接或与工具交互。

我们的目标是保留用户的一项核心安全预期：潜在危险动作，或潜在敏感信息的传输，不应在无提示或无适当防护的情况下静默发生。

我们看到针对 ChatGPT 的攻击中，最常见的是试图说服助手把会话中的秘密信息传给恶意第三方。在我们已知的大多数案例中，这些攻击会失败，因为我们的安全训练会让 agent 拒绝。对于少数 agent 被说服的情况，我们开发了名为 Safe Url 的缓解策略，用于检测“助手在会话中学到的信息”是否会被传给第三方。在这些少见场景里，我们会向用户展示将被传输的信息并请求确认；或直接阻止该传输，并告知 agent 尝试其他方式继续推进用户请求。

同样机制也适用于 [Atlas](https://openai.com/index/hardening-atlas-against-prompt-injection/) 中的导航与书签，以及 [Deep Research](https://openai.com/index/introducing-deep-research/) 中的搜索与导航。[ChatGPT Canvas](https://openai.com/index/introducing-canvas/) 与 [ChatGPT Apps](https://openai.com/index/introducing-apps-in-chatgpt/) 采用了类似方法，允许 agent 创建并使用功能性应用——这些应用运行在可检测异常通信并 [请求用户同意](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it#h_cd52fdbc16) 的沙箱中。

## 展望

要实现完全自主的 agent，与对抗性的外部世界进行安全交互是必要条件。将 AI 模型集成到应用系统时，我们建议先问：在类似场景下，人类代理应具备哪些控制措施；然后把这些措施落地实现。我们预计，在最大智能水平下，AI 模型会比人类代理更能抵御社会工程；但这并非在所有应用中都可行或具成本效益。

我们会继续研究“针对 AI 模型的社会工程”及其防御，把研究结论持续纳入应用安全架构和模型训练。

## 引用

- 原文：Designing AI agents to resist prompt injection  
  https://openai.com/index/designing-agents-to-resist-prompt-injection
- Prompt injections：  
  https://openai.com/index/prompt-injections/
