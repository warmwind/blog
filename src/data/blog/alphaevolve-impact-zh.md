---
title: AlphaEvolve：Gemini 驱动的编程 Agent 如何跨领域扩大影响力
pubDatetime: 2026-05-10T11:00:00+08:00
description: Google DeepMind 分享了 AlphaEvolve 在基因组学、量子物理、电力网格优化、AI 基础设施及商业应用等领域取得的一系列突破性进展。
slug: alphaevolve-impact-zh
originalTitle: "AlphaEvolve: Gemini-powered coding agent scaling impact across fields"
originalUrl: https://deepmind.google/blog/alphaevolve-impact/
tags:
  - AI
  - AlphaEvolve
  - Google DeepMind
  - Science
---

原文标题：AlphaEvolve: Gemini-powered coding agent scaling impact across fields<br>
原文链接：https://deepmind.google/blog/alphaevolve-impact/

一年前，我们发布了 AlphaEvolve——一个由 Gemini 驱动的、用于设计先进算法的编程 agent。我们展示了 AlphaEvolve 如何在数学和计算机科学的开放性问题上做出新发现，并优化了已部署于 Google 关键基础设施的算法。

如今，由于算法渗透了生活的方方面面，AlphaEvolve 所能实现的潜力比以往更为广阔。从帮助解释自然世界的物理规律，到驱动电网和计算基础设施，AlphaEvolve 有无数种方式可以帮助科学家和各领域企业加速进展。

我们很高兴分享 AlphaEvolve 迄今为止最具代表性的一批影响。

## 推动社会影响与可持续发展

AlphaEvolve 帮助揭示了健康和可持续性研究中的关键联系。

![DNA 双螺旋结构三维渲染图](https://lh3.googleusercontent.com/AQO4-KC1y4l_eOV0jS66QbkoodWyfeeje-4HnoAnFFRgAuBz40WpwS2fbv6cPSnHrudBVPLHVboq4f6u_ZPejTGWJ_9vW1tmrpCSYHyjgLFiryaZtg=w1440-h810-n-nu)

在基因组学领域，AlphaEvolve 被用于改进 DeepConsensus——Google Research 开发的一款用于纠正 DNA 测序错误的模型——将变异检测错误减少了 30%。这些改进正在帮助 PacBio 的科学家更准确、更低成本地分析基因数据。

*"Google 团队利用 AlphaEvolve 发现的解决方案，为我们的测序仪解锁了显著更高的准确率。对于研究人员来说，这种更高质量的数据可能有助于发现此前隐藏的致病突变。"*——Aaron Wenger，PacBio 高级总监

在电网优化领域，AlphaEvolve 被应用于交流最优潮流（AC Optimal Power Flow）问题。它帮助将我们训练的图神经网络（GNN）模型找到可行解的能力从 14% 提升至 88% 以上，显著减少了电力网格其他高成本后处理步骤的需求。

![高压输电线和铁塔延伸在绿色田野上的风景照](https://lh3.googleusercontent.com/xT26k7Gu_Lt0iDD2j_ZOQx2VmaZGH2U4j9vGCzo7cmla2UBefMcw-sQ6-12Dvb1SxDUG1Az4epE1bJg71z5KiYMxkMWdCL5eH9Rg6JiFIloZeWRBev8=w1440-h810-n-nu)

在地球科学领域，AlphaEvolve 将复杂的地理空间数据转化为更可靠、更具可操作性的洞察。通过帮助自动化 Earth AI 模型的优化，在 20 个类别（包括野火、洪水和龙卷风）中，预测自然灾害风险的综合准确率提升了 5%。

## 推进研究前沿

AlphaEvolve 正在成为一个强大的研究伙伴，加速跨科学领域的发现。

在量子物理领域，AlphaEvolve 的优化使在 Google 的 Willow 量子处理器上运行复杂分子模拟成为可能——通过提出误差比此前常规优化基线低 10 倍的量子电路。这使得量子计算实验性演示得以做出即时而有影响力的贡献，并指向了一个 AlphaEvolve 有助于发现超越经典计算机能力的算法的未来。

与 Terence Tao 等世界著名数学家合作，该系统帮助解决了 Erdős 问题。

*"像 AlphaEvolve 这样的工具正在给数学家带来非常有用的新能力。特别是在优化问题上，我们现在可以快速测试潜在不等式是否存在反例，或确认我们对极值元的信念，这极大地提升了我们对这些问题的直觉，使我们能够更容易地找到严格的证明。"*——Terence Tao，加州大学洛杉矶分校数学教授

AlphaEvolve 还打破了经典数学挑战的记录，包括改进了旅行商问题（Traveling Salesman Problem）和拉姆齐数（Ramsey Numbers）的下界。

此外，这种自主发现的能力正在推动其他多个多元领域的并行创新——从发现可解释的神经科学模型和证明微观经济学中的新市场限制，到快速推进神经网络构建模块、用于用户隐私的密码学、合成数据生成，以及用于前沿 AI 模型的关键安全缓解措施。

## 改进 AI 基础设施

AlphaEvolve 已从试点测试阶段毕业，成为我们基础设施的核心组件。

![手戴手套在洁净室环境中持有方形芯片处理器](https://lh3.googleusercontent.com/bhd0zRY8D-OCMR2gmX8bWQWa2auM6YuqTs1ij_UQKGFBwnqm8V6kkRj99dLZ8iVZjusyM8SS-FnlLRBP_W24nqvOM8aIeEabb6Y-St4I_DeQMtm9eQ=w1440-h810-n-nu)

AlphaEvolve 已被用作优化下一代 [TPU](https://cloud.google.com/tpu?e=48754805) 设计的常规工具。它还帮助发现了更高效的缓存替换策略，在两天内实现了此前需要数月密集人力才能完成的工作成果。

*"AlphaEvolve 开始优化驱动我们 AI 技术栈的最底层硬件。它提出了一种反直觉却高效的电路设计，并直接集成到了我们下一代 TPU 的硅片中。这是 TPU 大脑帮助设计下一代 TPU 躯体的最新案例。"*——Jeff Dean，Google DeepMind 及 Google Research 首席科学家

AlphaEvolve 通过改进 Google Spanner 的日志结构合并树（Log-Structured Merge-tree）压缩启发式算法，提升了 Google Spanner 的效率。这一优化将"写放大"——写入存储的数据量与原始请求的比率——降低了 20%。它还为新的编译器优化策略提供了洞见，将软件的存储占用减少了近 9%。

![展示随时间变化的性能分数折线图的软件界面，叠加显示包含条形图和 Python 优化代码片段的"Selected Program"窗口](https://lh3.googleusercontent.com/0PyMvA2pLEg69CeZUEWPy4U9D_VU9urOibCixZhsim2RoeC0cbmOMjEjCat0zRj0iN4eS0RSTWJRMjJi70qIxidYDeqjtiKpNWIW2ZUpKgJiM5i1FM=w1440-h810-n-nu)

## 扩大商业应用规模

[与 Google Cloud 合作](https://cloud.google.com/blog/products/ai-machine-learning/alphaevolve-on-google-cloud?e=48754805)，我们现在正将 AlphaEvolve 的能力带给各行各业的众多商业企业。

- 在金融服务领域，Klarna 使用该系统优化了其最大的 transformer 模型之一——在提升模型质量的同时，训练速度翻倍。
- 在半导体制造领域，Substrate 将 AlphaEvolve 应用于其计算光刻框架，实现了运行速度的数倍提升，使他们能够运行规模显著更大的先进半导体模拟。
- 在物流领域，[FM Logistic](https://cloud.google.com/blog/products/ai-machine-learning/how-fm-logistic-tackled-the-traveling-salesman-problem-at-warehouse-scale-with-alphaevolve?e=48754805) 使用该技术优化了旅行商问题等复杂路线规划挑战，在此前经过大量优化的解决方案基础上，路线效率提升了 10.4%——每年节省超过 15,000 公里的行驶距离。
- 在广告和营销领域，WPP 使用 AlphaEvolve 改进了 AI 模型组件，在复杂的高维活动数据中寻找方向，比其竞争性人工模型优化取得了 10% 的准确率提升。
- 在计算材料与生命科学领域，[Schrödinger](https://www.schrodinger.com/company/about/) 应用 AlphaEvolve 在机器学习力场（MLFF）训练和推理方面均实现了约 4 倍的加速。

*"AlphaEvolve 让我们能够以前所未有的速度和效率探索更大的化学空间。更快的 MLFF 推理具有真实的商业影响，缩短了药物发现、催化剂设计和材料开发中的研发周期，使企业能够在数天而非数月内筛选分子候选物。"*——Gabriel Marques，Schrödinger 机器学习技术负责人

## AlphaEvolve 的未来

过去一年展示了 AlphaEvolve 如何迅速成为一个多功能的通用系统。它正在证明，下一批突破将由那些能够自我学习、进化和优化的算法驱动。展望未来，我们期待扩展这些能力，并将这项技术的力量带给更广泛的外部挑战。

## 致谢

AlphaEvolve 由 Matej Balog、Alexander Novikov、Ngân Vũ、Marvin Eisenberger、Emilien Dupont、Po-Sen Huang、Adam Zsolt Wagner、Sergey Shirobokov、Borislav Kozlovskii、Francisco J. R. Ruiz、Abbas Mehrabian、M. Pawan Kumar、Abigail See、Swarat Chaudhuri、George Holland、Alex Davies、Sebastian Nowozin 和 Pushmeet Kohli 开发。这项研究是专注于利用 AI 进行算法发现的更广泛倡议的一部分。在初始开发之后，Aja Huang、Anton Kovsharov、Alexey Cherepanov、Anindya Basu、Becky Evangelakos、Jamie Smith 和 Mario Pinto 加入团队，为扩大 AlphaEvolve 的影响力做出了贡献。

Adam Connors、Alex Bäuerle、Anna Trostanetski、Fernanda Viegas、Gabi Cardoso、Jonathan Caton、Lucas Dixon、Mariana Felix、Martin Wattenberg、Matin Akhlaghinia、Richard Green、Yosuke Ushigome 和 Yunhan Xu 与我们团队合作开发了 AlphaEvolve 用户界面，并得到了许多其他人的支持。

Anant Nawalgaria、Diego Ballesteros、Gemma Jennings、Jakob Oesinghaus、Kartik Sanu、Laurynas Tamulevičius、Nicolas Stroppa、Nishta Dhawan、Oliver Hilsenbeck、Puneet Jagralapudi、Reah Miyara、Skander Hannachi、Tom Beyer 和 Vishal Agarwal 与我们团队合作开发了 AlphaEvolve API 并与 Google Cloud 客户进行了接触，并得到了许多其他人的支持。

我们衷心感谢在关键问题上应用 AlphaEvolve 并为本报告作出贡献的合作者们：Aaron Wenger、Abhradeep Guha Thakurta、Akanksha Jain、Alex Vitvitskyi、Amir Yazdan Bakhsh、Andrew Carroll、Aranyak Mehta、Arthur Conmy、Ansh Nagda、Davide Paglieri、Eric Perim Martins、Gabriella Marfani、Hassler Thurston、Hongzheng Chen、Jack Mason、János Kramár、Jasper Xian、Jeremy Ratcliff、Jessica Sapick、Johannes Bausch、Jonathan Katz、Kevin Miller、Kim Stachenfeld、Mark Kurzeja、Mircea Trofin、Myriam Khan、Nero Geng、Pablo Samuel Castro、Petar Veličković、Pi-Chuan Chang、Prabhakar Raghavan、Raghav Gupta、Rohin Shah、Sasha Vezhnevets、Sébastien Lahaie、Sergio Guadarrama、Shravya Shetty、Shruthi Gorantala、Terence Tao、Todd Lipcon、Tom O'Brien、Vinod Nair、Ziyue Wang、Zun Li，以及众多其他 AlphaEvolve 用户。

最后，我们感谢领导层的指导与支持：Amin Vahdat、Ankur Jain、Demis Hassabis、Jeff Dean、Parthasarathy Ranganathan、Pushmeet Kohli、Saurabh Tiwary 和 Sundar Pichai。我们也向 Google DeepMind、Google Cloud、Google Labs、Google Research 及其他产品领域的合作团队表示诚挚感谢，是他们让 AlphaEvolve 驱动的应用和产品成为可能。

## 引用

- 原文：[AlphaEvolve: Gemini-powered coding agent scaling impact across fields](https://deepmind.google/blog/alphaevolve-impact/)
- AlphaEvolve 官方介绍：[AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms](https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)
- Google Cloud 商业应用：[https://cloud.google.com/blog/products/ai-machine-learning/alphaevolve-on-google-cloud](https://cloud.google.com/blog/products/ai-machine-learning/alphaevolve-on-google-cloud?e=48754805)
