---
title: Sun Finance 利用 AWS 生成式 AI 实现身份证件信息提取与欺诈检测自动化
pubDatetime: 2026-05-03T10:10:00+08:00
description: Sun Finance 与 AWS Generative AI Innovation Center 合作，利用 Amazon Bedrock、Amazon Textract 和 Amazon Rekognition 构建 AI 驱动的身份验证流水线，将提取准确率从 79.7% 提升至 90.8%，每份文件处理成本降低 91%。
slug: sun-finance-id-extraction-fraud-detection-aws-zh
originalTitle: "Sun Finance automates ID extraction and fraud detection with generative AI on AWS"
originalUrl: https://aws.amazon.com/blogs/machine-learning/sun-finance-automates-id-extraction-and-fraud-detection-with-generative-ai-on-aws/
---

原文标题：Sun Finance automates ID extraction and fraud detection with generative AI on AWS<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/sun-finance-automates-id-extraction-and-fraud-detection-with-generative-ai-on-aws/

本文由 Sun Finance Group 的 Krišjānis Kočāns、Kaspars Magaznieks、Sergei Kiriasov 联合撰写。

如果你需要大规模处理身份证件——贷款申请、开户、合规检查——你很可能遇到过同样的瓶颈：传统光学字符识别（OCR）能完成一部分工作，但提取错误仍然会将大量申请推入人工审核队列。再加上欺诈检测，人工工作量会成倍增加。

Sun Finance 是一家 2017 年在拉脱维亚创立的金融科技公司，在九个国家作为技术优先的在线贷款市场运营。该公司每 0.63 秒处理一笔新贷款申请，每月进行超过 400 万次评估。在他们业务量最大的行业之一，每月有 8 万笔小额贷款申请，其中约 60% 需要人工审核。Sun Finance 与 AWS Generative AI Innovation Center 合作重建了处理流水线。在技术交接后的 35 个工作日内，该解决方案便正式投入生产。以下时间线展示了从启动到上线的完整项目历程。

![项目时间线，从启动到上线，涵盖 2025 年 8 月至 2026 年 1 月的关键里程碑](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/16/image-203161.png)

Sun Finance 项目时间线，从启动到上线

该项目历时 107 个工作日，经过四个里程碑。AWS Generative AI Innovation Center 的参与持续了 32 天，从启动（2025 年 8 月 26 日）到最终演示（2025 年 10 月 9 日），随后是 26 天的技术交接（2025 年 11 月 14 日）。Sun Finance 随后用 35 个工作日将解决方案推向生产，其中包括节假日期间（12 月 18 日至 1 月 7 日）14 天的生产冻结期，并于 2026 年 1 月 22 日正式上线。

在本文中，我们将介绍 Sun Finance 如何使用 Amazon Bedrock、Amazon Textract 和 Amazon Rekognition 构建 AI 驱动的身份验证（IDV）流水线。该解决方案将提取准确率从 79.7% 提升至 90.8%，每份文件处理成本降低 91%，处理时间从最长 20 小时缩短至 5 秒以内。你将了解到，将专用 OCR 与大型语言模型（LLM）结构化能力结合使用，如何超越单独使用任一工具的效果。你还将了解如何利用向量相似性搜索构建一个无服务器欺诈检测系统。

## 身份验证挑战

Sun Finance 早在 2019 年就使用 Amazon Rekognition 和 Amazon Textract 构建了第一个身份验证自动化系统。随着公司向发展中地区扩张，该系统的局限性变得难以忽视。

该地区在语言和文件复杂性方面带来了独特挑战。同时处理英语和当地语言文本对传统 OCR 系统来说颇为困难。当地语言文本在传统 OCR 训练数据集中代表性不足，导致提取错误频发。Sun Finance 还需要处理 7 种不同类型的身份证件，每种都有不同的版式和格式。

人工工作量主要由 OCR 错误驱动。在 60% 需要人工审核的申请中，约 80% 的案例源于提取信息与客户填写数据之间的不匹配。关键的是，60% 的不匹配是 OCR 错误，而非客户失误。其余 20% 的人工干预与欺诈检测标记有关。

欺诈检测增加了另一层复杂性。每日约有 10% 的请求是真实的欺诈申请。欺诈者使用带有特定模式的相似图片来绕过基本控制，同时提交多份贷款申请。识别这些模式需要在大量图像中进行耗时的人工审查。

成本和速度约束阻碍了扩张。仅在该地区用于人工核验的每份文件成本以及约 3 名全职员工（FTE），使得单位经济学阻碍了向低价值小额贷款行业的扩张。处理时间从自动化案例的不到 10 分钟到非工作时间人工审核的 20 小时不等。

## 解决方案概述

AWS Generative AI Innovation Center 开展了为期 6 周的概念验证（2025 年 9 月至 10 月），聚焦于一个高业务量行业。团队构建了两个 AI 驱动的解决方案：一个 ID 提取系统和一个欺诈检测系统。两者均作为完全无服务器架构部署在 AWS 上。该解决方案使用以下关键服务：

- **Amazon Bedrock** – 使用 Anthropic 的 Claude Sonnet 4 进行 AI 结构化和视觉分析，使用 Amazon Titan 多模态嵌入进行向量生成。
- **Amazon Textract** – 用于从身份证件进行主要 OCR 文本提取。
- **Amazon Rekognition** – 用于备用 OCR、人脸检测和人脸遮蔽。
- **Amazon S3 Vectors** – 用于针对已知欺诈模式进行无服务器向量相似性搜索。
- **AWS Step Functions** – 用于编排并行欺诈检测工作流。
- **AWS Lambda** – 用于两个流水线的无服务器计算。

下图展示了解决方案架构。

![AWS 架构图，展示使用 AWS Step Functions、Lambda 函数、Amazon Rekognition、Amazon Textract 和 Amazon Bedrock 的欺诈检测与文件处理流水线](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/16/image-203162.png)

Sun Finance API 架构，展示 ID 提取和欺诈检测路由

该架构通过 Amazon API Gateway 暴露两个 API 路由，贷款申请数据存储在 Amazon Simple Storage Service（Amazon S3）中：

- **`/extract-id` 路由（ID 提取）**：AWS Lambda 函数接收 ID 图片并发送至 Amazon Textract 进行主要 OCR。如果 Amazon Textract 返回低置信度结果，系统回退到 Amazon Rekognition 进行 OCR。提取的文本随后传递给 Amazon Bedrock（Claude Sonnet 4），将其结构化为标准化的 JSON 字段。
- **`/detect-fraud` 路由（欺诈检测）**：AWS Lambda 函数触发 AWS Step Functions 工作流，并行运行两项检查：
  - **背景相似性** — Amazon Rekognition 遮蔽自拍图片中的人脸，然后 Amazon Bedrock Titan 多模态嵌入生成背景的向量表示。该向量在 Amazon S3 Vectors 中查询，以查找与已知欺诈模式的匹配项。
  - **视觉模式检测** — Amazon Bedrock（Claude Sonnet 4）分析图像中的屏幕拍照痕迹和数字篡改迹象。

两个结果汇入基于 Lambda 的风险评估函数，生成 JSON 格式的综合欺诈评分。

- **欺诈入库流水线（右侧）**：确认的欺诈图片通过 Lambda 函数从 Amazon S3 入库。图片由 Amazon Rekognition 进行人脸遮蔽处理，由 Amazon Bedrock Titan 嵌入进行向量化，并存储在 Amazon S3 Vectors 中。这使参考数据库随时间不断增长。

## 前提条件

要实现类似解决方案，你需要具备以下条件：

- 具有创建和管理 AWS Lambda、AWS Step Functions、Amazon Bedrock、Amazon Textract、Amazon Rekognition 和 Amazon S3 Vectors 资源权限的 AWS 账户。
- 在你的 AWS 区域中启用了 Anthropic Claude Sonnet 4 和 Amazon Titan 多模态嵌入的 Amazon Bedrock 模型访问权限。
- 安装了用于基础设施部署的 Terraform。
- 熟悉 Python 和无服务器架构。
- 用于测试和验证的身份证件图片数据集。

## 解决方案详解

本节将详细介绍两个核心流水线：ID 提取和欺诈检测。

### ID 提取流水线

ID 提取系统并非一开始就达到最终设计。团队在四周内迭代了三种截然不同的方案，每次失败都指向下一步的改进方向。下图展示了流水线如何从单一 Claude Sonnet 4（通过 Amazon Bedrock）的 61.8% 准确率演进到最终多层设计的 90.8%。

![三种 ID 提取方案的对比可视化，展示从 61.8% 效率（仅 Claude Vision）到 85.0% 效率（配合 Amazon Textract）再到 90.8% 效率（配合验证和 Amazon Rekognition 备用）的进展](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/16/image-203163.png)

ID 提取：三次迭代方案的演进，准确率从 61.8% 提升至 90.8%

**方案一：单独使用 Claude Sonnet 4（准确率 61.8%）**。团队的首次尝试是将 ID 图片直接发送给 Anthropic 的 Claude Sonnet 4（通过 Amazon Bedrock），要求其将字段提取为 JSON。结果令人失望：整体准确率 61.8%，ID 号码提取准确率仅为 43%。核心问题在于模型处理个人身份信息（PII）的内置安全协议。Claude 经过训练，对驾驶证、护照和国家身份证等身份证件上的敏感 PII 处理有所限制。当呈现真实 ID 图片时，模型触发了这些隐私保护机制，拒绝从某些文件中提取信息，直接影响了性能。此外，即使提取成功，某些字段（如 ID 号码）的准确率也较低，因为模型在敏感文件上将安全性置于精确字符识别之上。

结论：虽然 Claude 在通用文件分析和 OCR 任务上表现出色，但其内置的隐私保护机制使其不适合直接从包含 PII 的身份证件中提取信息。

**方案二：Amazon Textract + Claude 结构化（准确率 85%）**。突破出现在团队将 OCR 与结构化分离之后。Amazon Textract 负责从 ID 图片中进行原始文本提取。Claude Sonnet 4 随后将输出结构化为 7 个标准化字段：证件类型、出生日期、名字、姓氏、中间名、ID 号码和有效期。这一改变带来了 11.6% 的准确率提升。

这种方案之所以有效，是因为 Amazon Textract 作为专用 OCR 服务，不具备 Claude 那样的 PII 拒绝机制，因此能够可靠地从每张 ID 图片中提取文本，而不会触发安全协议。文本提取完成后，Claude 可以专注于其擅长的工作：智能结构化。Claude 在处理带有变音符号的当地语言文本、从上下文推断缺失信息以及应用特定文件类型的提取规则方面表现出色。这些都是传统 OCR 单独无法完成的任务。通过处理已提取的文本而非原始 ID 图片，Claude 避免了其安全限制。

结论：分离关注点使每个工具都能在其设计参数内运作：Amazon Textract 负责可靠的 OCR，Claude 负责智能结构化。

**方案三：多层 OCR + 验证（准确率 90.8%）**。最终迭代新增了 Amazon Rekognition 作为 Amazon Textract 处理困难图像时的备用选项（通常是低质量扫描件、不寻常的文件角度或损坏的 ID），以及用于 ID 号码格式化、日期标准化和证件类型规范化的验证规则。

多层架构的工作原理如下：Amazon Textract 处理主要 OCR；当 Amazon Textract 置信度较低时，Amazon Rekognition 提供备用提取；Claude 对合并后的输出进行结构化；验证规则捕获漏网的格式错误。ID 号码根据证件类型补充到正确长度，日期标准化为 YYYY-MM-DD 格式。这些验证规则被证明至关重要——它们捕获了 OCR 提取了正确字符但格式不一致的边缘情况。

下图展示了在 585 张测试图片上的每周准确率进展。团队直到第 4 周加入 Amazon Textract 后才超过基准线。每次迭代都揭示了新的失败模式，为下一次架构改进提供了参考。

![折线图，展示 ID 提取准确率在 4 周内从 69.8% 基准（仅 Claude Vision）提升至 90.8% 最终准确率](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/16/image-203164.png)

ID 提取：达到 90.8% 准确率的历程，展示每周进展

结论：将专用 OCR 工具（Amazon Textract + Amazon Rekognition）与 LLM 结构化（Claude）和验证规则结合使用，胜过单独使用任何一种工具进行文件提取。

### 欺诈检测流水线

欺诈检测系统使用 AWS Step Functions 并行运行两种检测方法，然后将其评分合并为最终风险评估。

**视觉模式检测**。Amazon Bedrock 上的 Claude Sonnet 4 分析提交的自拍图片中的欺诈迹象：屏幕拍照（可见边框、扫描线、摩尔纹）、屏幕眩光和反光，以及数字篡改痕迹。置信度达到 85% 或以上的图片会被标记。系统忽略模糊、压缩伪影和标准裁剪等正常特征，以减少误报。屏幕拍照检测效果良好，对已知模式的置信度超过 95%。

**背景相似性分析**。该组件捕获欺诈团伙——即从同一地点提交自拍的欺诈者群体。流水线分三步工作：首先，Amazon Rekognition 遮蔽人脸以聚焦背景；然后，Amazon Titan 多模态嵌入生成背景的 1024 维向量；最后，Amazon S3 Vectors 在已知欺诈模式中搜索匹配项。

团队测试了基于文本和视觉的嵌入方式用于相似性搜索。文本嵌入（让 Claude 描述背景，然后比较描述）实现了 91% 的准确率，但仅有 27.8% 的精确率和 21.7% 的召回率。视觉嵌入表现好得多：96% 的准确率、80% 的精确率和 52% 的召回率。

![文本嵌入与视觉嵌入在基于 FAISS 的相似性搜索中的技术对比，展示视觉嵌入实现 96.0% 准确率、80.0% 精确率、52.2% 召回率和 63.2% F1 分数](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/16/image-203165.png)

背景相似性：视觉特征方案，展示流水线及文本与视觉嵌入的对比

**风险评估**。评分算法对视觉模式检测（50%）和背景相似性（50%）进行同等加权。分数 75 以上表示高置信度欺诈，38–74 表示中等置信度，低于 38 则被归类为合法。并行执行架构将每张图片的处理时间降至 3–5 秒，而顺序执行需要 6–8 秒。

### 无服务器架构

整个解决方案运行在 AWS Lambda、AWS Step Functions 和 Amazon API Gateway 上。这种设计使团队可以修改单个 Lambda 函数，立即测试更改，并在不停机的情况下部署更新。在为期 6 周、方法每周都在变化的参与过程中，这一点至关重要。

身份验证使用 Amazon Cognito 结合 AWS SigV4 请求签名。AWS WAF 防御常见的网络安全问题。数据在静止时使用 AWS Key Management Service（AWS KMS）加密，传输中使用 TLS 1.2+ 加密。基础设施使用 Terraform 定义，并通过了包含 25 项发现的安全审计：14 项假阳性、9 项合理例外和 2 项推迟至生产阶段处理。

## 结果

概念验证在准确率、速度、欺诈检测和成本方面均取得了可量化的改进。

### ID 提取性能

系统在 585 张 ID 图片上进行了评估：

| 指标 | 基准 | 新方案 | 提升 |
|------|------|--------|------|
| 姓名 | 84.93% | 87.72% | +2.79% |
| 出生日期 | 81.25% | 90.80% | +9.55% |
| 证件类型 | 78.43% | 96.40% | +17.97% |
| ID 号码 | 74.32% | 89.40% | +15.08% |
| 整体准确率 | 79.73% | 90.80% | +11.07% |

此前最弱的字段 ID 号码提取（74.32%）提高了超过 15 个百分点。证件类型分类达到 96.4%。每份文件的平均处理时间：4.42 秒。

### 欺诈检测性能

端到端欺诈检测流水线（视觉模式检测加背景相似性）综合实现了 81% 的准确率、59% 的召回率和 83% 的特异性。

![性能指标仪表盘，展示欺诈检测系统 81% 准确率、59% 召回率和 83% 特异性](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/16/image-203166.png)

欺诈检测结果：81% 准确率、59% 召回率、83% 特异性

59% 的召回率意味着系统能捕获约十分之六的欺诈案例。保守的阈值反映了业务现实：误报会造成客户摩擦，而漏检的欺诈可以通过其他控制手段捕获。随着已确认案例不断充实欺诈模式数据库，召回率将持续提升。

### 成本与速度

新解决方案降低了两个流水线的成本和处理时间。

| 组件 | 成本降低 |
|------|---------|
| ID 提取（Amazon Textract + Amazon Rekognition + Claude） | 相比之前方案降低 91% |
| 欺诈检测（Claude Sonnet 4 + Amazon Titan 嵌入 + Amazon S3 Vectors） | 每张图片 3–5 秒 |

ID 提取成本比之前的方案降低了 91%。这使向低价值小额贷款行业提供服务在经济上变得可行。欺诈检测流水线每张图片处理时间为 3–5 秒。

### 运营影响

除了准确率和成本之外，该解决方案还改变了 Sun Finance 的日常运营方式：

- 人工干预预计从 60% 的申请降至 30%，将审核工作量减少一半。
- 该行业的员工人数预计从约 3 名全职员工降至约 1 名。
- 低价值贷款经济体的地区扩张现在具备经济可行性。
- 适应性——新增一种证件类型或语言仅需提示词工程和验证规则调整，而不需要重新训练专用模型。

## 可扩展性与扩张

该解决方案的架构为快速扩张而设计。Sun Finance 在九个国家运营，无服务器设计可在不重复基础设施的情况下实现特定行业部署。新增一个经济体只需更新配置并重新部署。团队通过 Amazon Bedrock 更新 Claude Sonnet 4 提示词，定义特定文件类型的验证规则，然后针对验证数据集进行测试。这些配置更改需要通过 Terraform 的 CI/CD 流水线重新部署 Lambda 函数。欺诈检测系统使用两种互补方法。通过 Claude Sonnet 4 的视觉模式检测识别屏幕拍照和数字篡改。这些技术在各行业基本通用。使用 Amazon S3 Vectors 的背景相似性分析通过比对已知模式检测欺诈团伙，随着已确认欺诈案例的不断加入，检测效果持续改善。

模块化架构支持持续增强。AWS Step Functions 编排允许将新的欺诈检测方法作为并行 Lambda 函数添加，而不会影响现有检查。这可能包括 EXIF 元数据分析、设备指纹识别和地理位置验证等功能。每项功能都可作为额外的并行检查集成，无需进行架构更改。

## 经验教训

本次参与的五项实践经验：

**OCR + LLM 优于单独 LLM**。Amazon Bedrock 上的 Claude Sonnet 4 单独用于 ID 提取时仅实现了 61.8% 的准确率，低于现有基准。加入 Amazon Textract 进行原始文本提取，仅使用 Claude 进行结构化，准确率跃升至 85%。LLM 擅长理解上下文和规范化杂乱数据，但对从图像进行精确逐字符识别的可靠性较低。

**多层 OCR 提供弹性**。级联方法以 Amazon Textract 为主、Amazon Rekognition 为备用。没有单一的 OCR 服务能处理所有边缘情况，但这种组合以极低的额外成本避免了在困难图像上的完全失败。

**欺诈检测需要多种方法**。视觉模式检测以超过 95% 的置信度捕获屏幕拍照。背景相似性通过位置模式捕获欺诈团伙。但背景相似性对已见模式的召回率仅有 55%，对新型模式则降至 16.7%。单独使用任何一种方法都不够，随着更多已确认欺诈案例被加入数据库，系统将持续改善。

**从简单开始，仅在指标需要时增加复杂性**。团队通过使用 Amazon Textract 作为主要 OCR（而非将所有事情都交给 Claude）实现了 91% 的成本降低。他们仅在特定字段缺失时才调用 `AnalyzeID`，并缓存欺诈检测的嵌入结果。昂贵的模型应保留给真正需要它们的任务。

**无服务器架构支持快速迭代**。AWS Step Functions 中的并行执行以极少的代码更改将欺诈检测延迟降低了 40%。在一个方法每周都在演进的 6 周参与过程中，无需停机即可修改和部署单个 Lambda 函数的能力至关重要。

## 后续步骤

Sun Finance 计划在概念验证的基础上向几个方向发展。

- **扩展视觉检测**。当前系统仅检查屏幕拍照，遗漏了卡通、插图和 AI 生成图像。扩展检测提示词是投入最少、影响最大的改进。
- **更多训练数据**。持续收集已确认欺诈案例和多样化背景模式将直接提高背景相似性的召回率，使其超过目前对已见模式 55% 的水平。
- **额外欺诈信号**。集成 EXIF 元数据分析、设备指纹识别和地理位置验证将增加不依赖视觉分析的检测路径。这对新型欺诈模式尤为有价值。
- **多语言扩张**。向 Sun Finance 在东南亚、非洲、拉丁美洲和欧洲各国的其他经济体扩张，需要针对特定语言的提示词工程和验证规则。Claude 的多语言能力提供了起点，团队正在构建配置框架以实现无代码更改的扩张。

## 清理

如果你实现了类似的概念验证，完成后请删除以下资源以避免持续产生费用：

- 为 ID 提取和欺诈检测流水线创建的 AWS Lambda 函数。
- AWS Step Functions 状态机。
- 用于欺诈模式存储的 Amazon S3 存储桶和 Amazon S3 Vectors 向量索引。
- Amazon API Gateway REST API。
- Amazon Cognito 用户池。
- AWS WAF 网络访问控制列表（ACL）。
- 任何 Amazon Bedrock 预置吞吐量（如已配置）。

你可以通过 AWS 管理控制台或运行 `terraform destroy`（如果你使用 Terraform 部署了基础设施）来删除这些资源。

## 结论

在本文中，我们展示了 Sun Finance 如何将 Amazon Textract、Amazon Rekognition 和 Amazon Bedrock 组合起来，构建 AI 驱动的身份验证流水线。该解决方案将提取准确率从 79.7% 提升至 90.8%，每份文件处理成本降低 91%，处理时间从最长 20 小时缩短至 5 秒以内。使用专用 OCR 进行文本提取、使用 LLM 进行智能结构化的核心架构模式，适用于传统 OCR 力不从心的文件处理工作流。无服务器欺诈检测系统展示了如何将视觉分析与向量相似性搜索结合起来，大规模捕获欺诈模式。

对于申请小额贷款的客户来说，这意味着等待一天和手机上即时获得答复之间的差距。

> "感谢 AWS Generative AI Innovation Center 团队卓越的合作伙伴关系和真正出色的成果。最初感觉雄心勃勃——几乎不切实际——的目标，已经转变为一个安全、可生产就绪的解决方案，在准确率、速度和成本效率方面都取得了可量化的提升。特别是 AI 驱动的欺诈检测能力——结合视觉模式识别和背景相似性分析——代表了在保护我们投资组合的同时维持无缝客户体验方面的重大进步。它对我们运营和风险管理框架的影响是立竿见影且意义重大的，我们深深感谢让这一切成为可能的专业知识、奉献精神和卓越执行力。"
>
> — Agris Vaselāns，Sun Finance 集团首席风险官

要了解生成式 AI 如何改善你的文件处理和欺诈检测工作流，请访问 Amazon Bedrock 产品页面或联系 AWS Generative AI Innovation Center。有关 OCR 和文件处理的更多信息，请参阅 Amazon Textract 开发人员指南。

欢迎在评论区分享你在文件处理和欺诈检测方面的经验。

## 引用

- 原文：[Sun Finance automates ID extraction and fraud detection with generative AI on AWS](https://aws.amazon.com/blogs/machine-learning/sun-finance-automates-id-extraction-and-fraud-detection-with-generative-ai-on-aws/)
