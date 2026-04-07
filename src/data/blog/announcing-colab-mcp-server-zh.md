---
title: "发布 Colab MCP Server：将任意 AI Agent 连接到 Google Colab"
pubDatetime: 2026-03-22T20:00:00+08:00
description: "Google Developers Blog《Announcing the Colab MCP Server: Connect Any AI Agent to Google Colab》中文翻译（含原文引用）。"
slug: announcing-colab-mcp-server-zh
originalTitle: "Announcing the Colab MCP Server: Connect Any AI Agent to Google Colab"
originalUrl: https://developers.googleblog.com/announcing-the-colab-mcp-server-connect-any-ai-agent-to-google-colab/
---

原文标题：Announcing the Colab MCP Server: Connect Any AI Agent to Google Colab<br>
原文链接：https://developers.googleblog.com/announcing-the-colab-mcp-server-connect-any-ai-agent-to-google-colab/

# 发布 Colab MCP Server：将任意 AI Agent 连接到 Google Colab

![](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_Generated_Image_ie7raiie7ra.2e16d0ba.fill-800x400.jpg)

*作者：Jeffrey Mew，产品经理*

当开发者在本地使用 Gemini CLI、Claude Code 或自定义 Agent 等 AI Agent 进行原型开发时，计算资源限制往往会制约其能力。搭建项目脚手架或安装依赖的过程也会带来延迟。此外，让自主 Agent 直接在个人硬件上执行代码还存在安全隐患。

解决方案是利用一个拥有充足计算资源的安全云沙箱。通过将任意 MCP 兼容的 Agent 与 Google Colab 集成，可以弥合本地开发工作流与云基础设施之间的差距。

今天，我们发布了开源的 [Colab MCP（Model Context Protocol）Server](https://github.com/googlecolab/colab-mcp)，让任意 AI Agent 都能直接访问 Google Colab。

这不仅仅是界面修改或 notebook 共享机制的改进，而是提供了对 Colab 原生开发能力的编程访问。Colab 由此转变为一个可被 MCP 兼容 Agent 自动化操作的工作空间。

## Colab Notebook 作为工具

该系统不仅仅是在后台进程中执行代码，而是赋予 Agent 对 Colab notebook 界面的原生控制能力。这使得整个 notebook 开发工作流的全面自动化成为可能。当你指示 Agent「对这个数据集进行数据分析」时，Agent 现在可以以编程方式：

- **添加和组织 cell：** 生成新的 `.ipynb` 文件，并插入记录方法论的 markdown cell
- **编写和执行代码：** 编写包含 pandas 和 matplotlib 等库的 Python cell，然后立即运行
- **移动和整理内容：** 重新组织 cell，为最终报告建立连贯、可读的叙事结构
- **管理依赖：** 部署基础镜像中缺少的必要库（`!pip install ...`）

这将 Colab 转变为一个高速原型开发环境。开发者不再只是在终端输出中获得静态代码片段，而是得到完全可复现、可执行的产物——它们托管在云端，实时构建。开发者随时可以进入 notebook 检查当前状态或接管手动控制。

## 如何安装和开始使用

配置完成后即可立即开始分配任务。在本地环境中配置 Colab MCP server 需要进行 Agent 配置。

**系统前置要求：**

Colab MCP server 需要系统上安装以下软件包：
- Python
- git
- uv

### 安装 git

大多数 Mac 和 Linux 系统默认已安装。使用以下命令验证：

```
git version
```

如果系统未安装 git，请按照 [安装说明](https://github.com/git-guides/install-git) 操作。

### 安装 Python

Python 通常已预装。使用以下命令验证：

```
python --version
```

如果未安装，请参阅 [Python 入门指南](https://www.python.org/about/gettingstarted/)。

### 安装 uv

运行 Colab MCP tool server 需要 Python 包管理器 uv：

```
pip install uv
```

### MCP JSON 配置

```json
{
  "mcpServers": {
    "colab-proxy-mcp": {
      "command": "uvx",
      "args": ["git+https://github.com/googlecolab/colab-mcp"],
      "timeout": 30000
    }
  }
}
```

## 实际效果

设置完成后，MCP server 即可无缝集成。在浏览器中打开任意 Google Colab notebook，然后向本地 Agent 发出指令。示例指令：

> 「加载销售数据集，帮我预测并可视化下个月的销售额。」

Agent 随后会自动生成 cell、编写可执行的 Python 代码、生成可视化图表，并实时在你的 Colab notebook 中组织分析内容。

## 我们期待你的反馈！

开发团队创建这个工具的契机是观察到开发者手动将代码从终端复制到 Colab cell 中进行调试和数据可视化。这种工作流中断会影响生产力。通过将 Colab 定位为一项服务，本地开发环境与云计算资源之间的摩擦得以减少。

鉴于这是一种全新的 Colab 交互方式，社区反馈将决定未来的开发方向。请使用你偏好的 Agent 安装 Colab MCP Server，测试功能边界，并通过 [GitHub 仓库](https://github.com/googlecolab/colab-mcp/issues) 提交反馈。

该项目的开源特性欢迎社区参与和代码贡献。开发者的反馈将最终决定即将推出的功能。

## 引用

- 原文：[Announcing the Colab MCP Server: Connect Any AI Agent to Google Colab](https://developers.googleblog.com/announcing-the-colab-mcp-server-connect-any-ai-agent-to-google-colab/) — Google Developers Blog，2026 年 3 月 17 日
- GitHub 仓库：[googlecolab/colab-mcp](https://github.com/googlecolab/colab-mcp)
