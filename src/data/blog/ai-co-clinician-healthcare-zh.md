---
title: 用 AI 联合临床医师开创医疗新模式
pubDatetime: 2026-05-02T10:00:00+08:00
description: Google DeepMind 正在探索 AI 联合临床医师（AI co-clinician）的研究方向，旨在让 AI 在医生的临床权威下协助诊疗，开创 AI 增强医疗服务的新模式。
slug: ai-co-clinician-healthcare-zh
originalTitle: Enabling a New Model for Healthcare with AI Co-Clinician
originalUrl: https://deepmind.google/blog/ai-co-clinician/
---

原文标题：Enabling a New Model for Healthcare with AI Co-Clinician<br>
原文链接：https://deepmind.google/blog/ai-co-clinician/

![AI 联合临床医师：探索 AI 增强医疗服务之路](https://lh3.googleusercontent.com/z2sN_eil5tgap-Ji1W_4l1xnbfLRghzxdXzyCMdnKFVW1xTfgm0o8bpg9pNwE4RcHTR2QGEGhGx7LFn7Q6bg-LEPBW20d4Djo3Erii8PBYYrWz36=w1200-h630-n-nu-rw)

全球医疗卫生系统都在努力实现更好的医疗结局、更低的成本，以及为患者和临床医生提供更好的体验。然而，进展受制于全球临床专家的严重短缺——世界卫生组织预测，到 2030 年，全球医疗卫生工作者将出现超过 1000 万人的[缺口](https://www.who.int/health-topics/health-workforce#tab=tab_1)。

尽管 AI 常被视为弥合这一差距的关键，但它迄今尚未能完全满足临床医生和患者的需求。正因如此，我们今天宣布启动 AI 联合临床医师（AI co-clinician）研究计划，探索 AI 如何更好地放大医生的专业能力，并为患者提供更高质量的医疗服务。

在 Google DeepMind，我们在医疗 AI 领域的探索历程，从通过 [MedPaLM](https://www.nature.com/articles/s41586-023-06291-2) 掌握医学知识考试式测试，到通过 [AMIE](https://www.nature.com/articles/s41586-025-08866-7) 在基于文本的模拟医学问诊中匹敌医生表现，乃至在[真实世界可行性](https://arxiv.org/abs/2603.08448)试验环境中的尝试，一路演进。我们也长期研究临床医生与 AI 系统如何能够[协同](https://www.nature.com/articles/s41591-023-02437-x)[工作](https://www.nature.com/articles/s41586-025-08869-4)。

我们假设，医疗服务交付的下一次演变将体现为"三方协同诊疗"（triadic care），即 AI agent 在医生的临床权威下协助患者完成其就诊历程。医学从来都是一项团队运动，AI agent 可以为团队带来更多成员：在确保医生始终保有判断权与控制权的前提下，拓展临床医生的服务覆盖范围。

这正是我们 AI 联合临床医师研究计划的基础：AI 被设计为在专业临床督导下与患者互动、作为诊疗团队协作成员发挥功能。我们在面向临床医生和面向患者这两种场景下均对 AI 联合临床医师进行了设计与评估。兼顾两个视角，是 AI 提升医疗质量、降低成本、改善可及性和服务体验的关键所在。

![医疗 AI 研究进展——致力于让 AI 更值得信赖、更有助于临床医生协助患者。](https://lh3.googleusercontent.com/vLxAt9kpWmN9_JK-NtqdapCtx4oLQxABsU8azN1YPzBYczAq0by_CC8Wxo_-Q4uAIDGaIYlOE7b-2Ccn7eWpUnT4klHP-k9f5VwayPOL7VE8bwO1=w1440)

## 以 AI 联合临床医师增强医生能力

对医生而言，一个工具只有在可信赖、有事实依据的前提下才具备实用价值。因此，我们研究了 AI 联合临床医师如何通过提供高质量循证信息来支持临床医生。

与学术医师合作，我们改编了"[NOHARM](https://arxiv.org/abs/2512.01241)"框架，用于测试 AI 的"遗漏错误"（未能呈现关键信息）与"委托错误"（输出错误信息）。

在头对头盲测评估中，医生一致更倾向于 AI 联合临床医师的回答，而非领先的循证合成工具。在针对 98 个真实初级医疗问题的客观分析中，我们的系统在 97 个案例中零严重错误，优于两个目前被医生广泛使用的 AI 系统。

![该研究采用对 98 个真实初级医疗问题的盲对照评估。这些问题来源多样，经由一批主治医师逐一打磨完善。此多步骤迭代流程涵盖系统性背景调研，以及针对每个问题制定具体评价指标，以支持对临床准确性和最佳实践规范的严格专业评估。](https://lh3.googleusercontent.com/9LvJBboLhrYPfvFvBNsFFKjHrLstUwPZnijw5DTKxeq4V7ywOuphVgQ-SsUnVrkYZUd2lfilYmq3ar0j5kRwK5RnHdM4WW3hQM2QPNS9xeXAHH04EA=w1440)

除了可靠的临床循证综合能力，AI 系统还应以医生要求的精准度回答关于药物和治疗干预的查询。这对 AI 而言是一项难题，但目前仍未受到足够关注。为弥补这一空白，我们在 [OpenFDA RxQA](https://arxiv.org/abs/2503.06074) 题库上评估了 AI 联合临床医师——这是一个旨在评估复杂用药知识与推理能力的高难度基准。我们在这项测试中取得了显著进步，尤其是在以真实临床中开放式提问方式呈现问题时，超越了其他前沿 AI 系统。这些发现凸显了先进 AI 在临床医生应对日趋数据密集的诊疗规划与管理工作时提供有效辅助的潜力。

![RxQA 最初以多项选择题形式出现，即便是初级医疗医生的得分也较为有限。尽管我们的结果显示 AI 系统在 OpenFDA RxQA 多选题上有了显著进步，但临床医生在真实世界中的需求呈现为开放式问题，而非从既定选项中选出正确答案。在这一更贴近真实临床场景的开放式用药问答任务中，AI 联合临床医师超越了现有前沿模型。综合来看，这些结果表明 AI 在部分临床推理方面已能匹敌人类医生，并仍有进一步提升空间。](https://lh3.googleusercontent.com/jSXmRbnKcAyrA6-8PkN4Mc7M0MRGIoy7f26f5Xh6VW1lIBcxDfJfGborwpp3J6K3wa_TOvdrd-_MxzX0GwxfdBQ_fgDj4s5l2Yby8CnBYnA61zN9-Gw=w1440)

## 研究 AI 联合临床医师在远程医疗场景中的实时多模态能力

除了面向临床医生的辅助场景，我们还在研究 AI 联合临床医师在面向患者的研究情境中的表现。专业临床评估传统上需要捕捉细微的视觉与听觉线索，例如观察患者步态、呼吸模式的细节，或皮肤变化的外观。尽管此前的研究（包括我们与 Beth Israel Deaconess 医学中心的合作）证明了 AI 文字聊天在就诊前预问诊中的价值，但将互动局限于文字会从根本上制约 AI 的临床价值。医学不只是文字，它需要眼睛、耳朵和声音。

这正是我们探索实时多模态 AI 作为诊疗团队辅助组件之潜力的原因。基于 Gemini 和 Project Astra 的能力，我们测试了 AI 联合临床医师使用实时音频和视频与患者互动的能力，模拟远程医疗通话——在这种通话中，未来有能力的 AI 有朝一日可能在专家监督下支持更好的诊断与管理。我们的方法论和结果详见技术报告："Towards Conversational Medical AI with Eyes, Ears and a Voice"。

与哈佛大学和斯坦福大学的学术医师合作，我们设计了一项随机模拟研究，涵盖 20 个合成临床场景和 10 名担任"病人演员"的医生。该 agent 展示了超越纯文字系统的新能力，例如能够实时引导患者完成复杂体格检查。举例来说，它成功纠正了患者的吸入器使用技术，并引导患者完成肩部动作以识别旋转肌袖损伤。

尽管关于 AI 是否能够达到甚至超越人类临床医生水平的讨论屡见不鲜，但这些高保真模拟研究对这一命题进行了更为严格的评估。我们评估了超过 140 项问诊技能，发现专业医生的整体表现优于 AI 系统，尤其是在识别"红旗症状"和引导关键体格检查方面。这一发现表明，这些系统目前最适合作为从业者的辅助工具，而非替代临床判断。与此同时，我们的工作也凸显了 AI 能力的重大进步：AI 联合临床医师在 140 项评估领域中的 68 项达到了与初级医疗医生（PCPs）相当或更优的水平。这些结果既彰显了广阔的前景，也指出了未来研究中可最有效推动医疗 AI 进步的具体方向。

![随机、界面盲法、交叉模拟研究结果，涉及 120 次假设性远程医疗就诊，由真实初级医疗医生、AI 联合临床医师或 GPT-realtime 分别完成。评估过程中，一批内科住院医师担任病人演员，参演 20 个标准化门诊场景。这些场景覆盖多种临床情况，专门设计为需要主动视觉和听觉推理。针对各场景的评价标准评估了七个问诊质量维度，每项使用锚定 0–2 评分以区分遗漏、部分完成和完全适当表现。误差棒对应 95% 置信区间。](https://lh3.googleusercontent.com/16STUlrYSIGJX5sseNvEJeGSoIhkZflOFInB930bunecCACV3Kedta4Y8dsZxI73oDT5DM1wTRyDF8R_s__6e5GGPn4T9wpXuV2vW7DKeNJWGZeU=w1440)

以下是研究团队在该远程医疗场景中扮演假设患者与 AI 联合临床医师互动的演示，展现了该系统的潜在能力与局限性。

![AI 联合临床医师远程医疗演示 1](https://lh3.googleusercontent.com/SEW3vIThALZb_WupI7O5Z7ULu1f5EadPoJd31VNYk29wtqWcOnUltIah_1G-0rmmCeCWMEnzaRumHp5k-k3N4FXNK_INsAIJZ1GNdCnqmaRK4v0DaA=w1440-h810-n-nu)

![AI 联合临床医师远程医疗演示 2](https://lh3.googleusercontent.com/kY9cF88fsAhEQ8GFr0b-alW9T34EFTMYns1mAPyAhUMDQqpR4Wz5mtwukcrpw-_Fe6virZx5uY_5r089ZICcV5PL4KMn-F8v1iX9FLbncG8WW7IE=w1440-h810-n-nu)

![AI 联合临床医师远程医疗演示 3](https://lh3.googleusercontent.com/Hh0h8YQG74o9YxtJQjyv3A9SDrFl4qyPu2zT6KBR9WyRU52RXedKRBkyBTIaDKwVIPyqVrUajOJ2PldYe_E0ZISJnmGp_XDnCIG_yDoug-4f3PNbXnA=w1440-h810-n-nu)

## 为临床级 AI 构建信任工程与安全防护

将 AI 引入并部署于临床环境，需要不妥协的架构与运营安全防护。在我们对面向患者的远程医疗对话模拟研究中，AI 联合临床医师采用了双 agent 架构："规划器"（Planner）模块持续监控对话，核实"对话器"（Talker）agent 是否保持在安全的临床边界之内。

同样，为满足医生需求，AI 联合临床医师优先使用临床级循证资料，对检索内容进行验证和引用核查。我们上述评估均由医生设计，以反映其真实的循证信息需求——从假设情景中提炼问题，严格评估 AI 能力。

## 与研究机构开展合作，对 AI 联合临床医师进行严格的真实世界评估

为进一步开发和评估 AI 联合临床医师，我们目前正与全球多样化医疗环境中的学术和研究合作机构开展分阶段合作，覆盖美国、印度、澳大利亚、新西兰、新加坡和阿联酋。

随着这些评估阶段的推进，我们将在更多地区深化研究，包括使命驱动的医疗机构和学术医学中心。我们的目标是确保医疗 AI 的开发与部署符合适用标准、负责任地推进，支持全球更好的健康水平。

**注：我们的研究合作在现阶段并非旨在用于疾病的诊断、治愈、缓解、治疗或预防，也不提供医疗建议。**

## 致谢

我们衷心感谢哈佛医学院和斯坦福医学院的研究合作伙伴，以及众多与我们团队参与可信测试评估的医疗机构和护理机构。本项目涉及 Google DeepMind、Google Research、Google Cloud 和 Google for Health 众多团队的协作，感谢团队成员在讨论与贡献方面给予的洞察与支持。

尤其感谢以下核心研究与工程人员，没有他们，AI 联合临床医师不可能成为现实：Aniruddh Raghu、Arthur Chen、Charlie Taylor、CJ Park、David Stutz、Devora Berlowitz、Doug Fritz、Dylan Slack、Eliseo Papa、Jack Chen、JD Velasquez、Jing Rong Lim、Katya Tregubova、Kelvin Guu、Meet Shah、Richard Green、Ryutaro Tanno、Sukhdeep Singh、Victoria Johnston、Adam Rodman。

感谢众多合作者的宝贵贡献，包括：Ali Eslami、Aliya Rysbeck、Andy Song、Anil Palepu、Anna Cupani、Bakul Patel、Bibo Xu、Brett Hatfield、David Wu、Ed Chi、Emma Cooney、Erica Oppenheimer、Erwan Rolland、Euan A. Ashley、Francesca Pietra、Rebeca Santamaria-Fernadez、Gordon Turner、Gregory Wayne、Hannah Gladman、Irene Teinemaa、Jack O'Sullivan、Jacob Koshy、Jan Freyberg、Jason Gusdorf、Joelle Wilson、Katherine Tong、Juraj Gottweis、Michael Howell、Mili Sanwalka、Pavel Dubov、Pete Clardy、Peter Brodeur、Rachelle Sico、SiWai Man、Sumanth Dahathri、Taylan Cemgil、Tim Strother、Uchechi Okereke、Valentin Lievin、Vishnu Ravi、Yana Lunts、Yun Liu、Simon Staffell、Rachel Teo、Adriana Fernandez Lara、Armin Senoner、Danielle Breen、Paula Tesch、Leen Verburgh、Dimple Vijaykumar、Juanita Bawagan、Muinat Abdul、Mariana Montes 和 Rob Ashley。特效视频由 Christopher Godfree、Matt Mager、Emma Moxhay 和 Simon Waldron 制作。

感谢 James Manyika 和 Demis Hassabis 在整个研究过程中给予的深刻指导与支持。

## 引用

- 原文：[Enabling a New Model for Healthcare with AI Co-Clinician](https://deepmind.google/blog/ai-co-clinician/)
- [MedPaLM](https://www.nature.com/articles/s41586-023-06291-2)
- [AMIE](https://www.nature.com/articles/s41586-025-08866-7)
- [NOHARM 框架](https://arxiv.org/abs/2512.01241)
- [OpenFDA RxQA](https://arxiv.org/abs/2503.06074)
