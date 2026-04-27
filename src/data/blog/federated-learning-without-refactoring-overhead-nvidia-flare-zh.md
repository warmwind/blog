---
title: 使用 NVIDIA FLARE 实现无重构开销的联邦学习
pubDatetime: 2026-04-27T10:00:00+08:00
description: NVIDIA FLARE 通过客户端 API 和任务配方，将本地训练脚本转化为联邦学习任务仅需约 5-6 行代码，大幅降低联邦学习的重构开销。
slug: federated-learning-without-refactoring-overhead-nvidia-flare-zh
originalTitle: Federated Learning Without the Refactoring Overhead Using NVIDIA FLARE
originalUrl: https://developer.nvidia.com/blog/federated-learning-without-the-refactoring-overhead-using-nvidia-flare/
---

原文标题：Federated Learning Without the Refactoring Overhead Using NVIDIA FLARE<br>
原文链接：https://developer.nvidia.com/blog/federated-learning-without-the-refactoring-overhead-using-nvidia-flare/

联邦学习（FL）已不再是一个研究性概念——它是对一个严峻约束的实际回应：最有价值的数据往往是最难移动的。监管边界、数据主权规则和组织风险容忍度常常阻止集中聚合。与此同时，纯粹的数据重力使得即便是被允许的传输，在规模化时也会变得缓慢、昂贵且脆弱。

最新版本的 [NVIDIA FLARE](https://developer.nvidia.com/flare) 通过联邦计算运行时来应对这一现实——将训练逻辑移至数据所在之处，同时原始数据保持不动。在高风险环境中，集中聚合数据通常是不可行或不切实际的，因此现代联邦平台必须将数据隔离、合规性和隐私增强技术作为一等公民需求。

历史上减缓采用率的并非联邦学习的概念本身，而是开发者体验。如果从"我的本地脚本能训练"到"我的任务能在联邦节点上运行"需要深度重构、新的类层次结构或脆弱的配置，许多项目就会在试点阶段停滞。

FLARE API 的演进正是针对这一点：通过将工作分成两个具体步骤来消除重构开销，这两个步骤与团队实际构建和交付机器学习系统的方式完全吻合：

- **步骤 1（客户端 API）**：仅用约 5-6 行代码将现有本地训练脚本转化为联邦客户端，无需更改训练循环结构。
- **步骤 2（任务配方）**：选择 FL 工作流并将其绑定到客户端训练脚本，然后通过仅交换执行环境，在模拟、PoC 和生产环境中运行相同的任务。

## "无数据复制"作为系统需求

在受监管或高敏感性设置中，"直接集中数据集"越来越行不通。一个实用的联邦计算平台需要支持：

- **无数据复制**：数据保留在本地，只有模型更新（或等效信号）会流动。
- **合规姿态**：支持数据主权和审计要求的部署和治理控制。
- **隐私增强技术**：多层防御（例如同态加密、差分隐私和机密计算）。

![图 1：联邦计算将数据保留在原位，通过模型更新实现协作，同时支持合规性和隐私增强保护](https://developer-blogs.nvidia.com/wp-content/uploads/2026/04/image8.webp)

**图 1.** 联邦计算将数据保留在原位，通过模型更新实现协作，同时支持合规和隐私增强保护。

## 重构悬崖：FL 项目为何停滞

团队通常在试点之后遇到以下两种困境之一：

- **代码悬崖**：将能运行的 PyTorch/TensorFlow/Lightning 训练代码转化为 FL，可能需要侵入性重构——新的抽象、消息胶水代码和框架特定的脚手架。
- **生命周期悬崖**：即使模拟运行成功，迁移到 PoC 和生产环境也会触发重写：任务重新定义、重新配置和环境特定的分支。

FLARE 通过将工作流标准化为两个步骤来消除这两个悬崖：

1. 使你的脚本支持联邦（客户端 API）
2. 将其作为可移植任务执行（任务配方）

预期的体验明确是将二者组合起来，使你能够快速从零走向一个可运行的联邦任务。

## 步骤 1：将本地训练脚本转化为联邦客户端（客户端 API）

**适用人群**：拥有现有训练代码、希望代码改动最小的从业者和机器学习工程师。

心智模型刻意保持简单：

1. 初始化客户端运行时
2. 在任务运行期间循环
3. 接收当前全局模型
4. 本地训练（你的代码）
5. 将更新后的权重和指标发送回去

FLARE 的客户端 API 设计为最小化代码改动，避免强迫你进入繁重的"Executor/Learner"继承体系——使用 FLModel 结构或简单的数据交换与运行时通信。

### 示例 1a：将 PyTorch 转化为 FLARE

下面是一个可应用于许多脚本的具体模式。关键接触点是：`flare.init()`、`flare.receive()`、加载模型权重和携带更新权重与指标的 `flare.send()`。

我们在左侧展示本地训练代码，右侧展示联邦版本，突出显示：import、`flare.init()`、`receive()`、`send()`。

**train.py**

```python
# train.py

import torch
import torchvision
import torchvision.transforms as transforms

from model import Net

batch_size = 4
epochs = 1
lr = 0.01
model = Net()
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
loss = torch.nn.CrossEntropyLoss()
optimizer = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9)
transform = transforms.Compose(
   [
       transforms.ToTensor(),
       transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),
   ]
)

train_dataset = torchvision.datasets.CIFAR10(
   root="/tmp/data/cifar10", transform=transform, download=True, train=True
)

trainloader = torch.utils.data.DataLoader(
   train_dataset, batch_size=batch_size, shuffle=True
)

model.to(device)

for epoch in range(epochs):
   running_loss = 0.0

   for i, batch in enumerate(trainloader):
       images, labels = batch[0].to(device), batch[1].to(device)

       optimizer.zero_grad()

       predictions = model(images)
       cost = loss(predictions, labels)
       cost.backward()
       optimizer.step()

       running_loss += cost.cpu().detach().numpy() / batch_size

       if i % 3000 == 2999:
           print(
               f"Epoch: {epoch + 1}/{epochs}, batch: {i + 1}, Loss: {running_loss / 3000}"
           )
           running_loss = 0.0

   print(
       f"Epoch: {epoch + 1}/{epochs}, batch: {i + 1}, Loss: {running_loss / (i + 1)}"
   )

print("Finished Training")

torch.save(model.state_dict(), "./cifar_net.pth")
```

**client.py**

```python
# client.py
# 1. 导入客户端 API
import nvflare.client as flare
import torch
import torchvision
import torchvision.transforms as transforms

from model import Net

batch_size = 4
epochs = 1
lr = 0.01
model = Net()
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
loss = torch.nn.CrossEntropyLoss()
optimizer = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9)
transform = transforms.Compose(
   [
       transforms.ToTensor(),
       transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),
   ]
)

train_dataset = torchvision.datasets.CIFAR10(
   root="/tmp/data/cifar10", transform=transform, download=True, train=True
)

trainloader = torch.utils.data.DataLoader(
   train_dataset, batch_size=batch_size, shuffle=True
)
# 2. 初始化 FLARE
flare.init()
# 在 FLARE 运行期间的每一轮
while flare.is_running():
    # 3. 接收全局模型
    input_model = flare.receive()
    # 4. 加载全局模型
    model.load_state_dict(input_model.params)
    model.to(device)

    for epoch in range(epochs):
        running_loss = 0.0

        for i, batch in enumerate(trainloader):
            images, labels = batch[0].to(device), batch[1].to(device)

            optimizer.zero_grad()

            predictions = model(images)
            cost = loss(predictions, labels)
            cost.backward()
            optimizer.step()

            running_loss += cost.cpu().detach().numpy() / batch_size

            if i % 3000 == 2999:
                print(
                    f"Epoch: {epoch + 1}/{epochs}, batch: {i + 1}, Loss: {running_loss / 3000}"
                )
                running_loss = 0.0

        print(
            f"Epoch: {epoch + 1}/{epochs}, batch: {i + 1}, Loss: {running_loss / (i + 1)}"
        )

    print("Finished Training")

    torch.save(model.state_dict(), "./cifar_net.pth")
    # 5. 发回更新后的模型
    output_model = flare.FLModel(
        params=model.cpu().state_dict(),
        meta={"NUM_STEPS_CURRENT_ROUND": len(trainloader) * epochs},
    )
    flare.send(output_model)
```

### 示例 1b：PyTorch Lightning 客户端

Lightning 集成保持相同的*意图*——接收全局模型、训练、发送更新——但以 Lightning 友好的方式呈现：导入 Lightning 客户端适配器并对 Trainer 进行补丁。

典型流程是：import、patch、（可选）validate、正常 train。

```python
# lightning_client.py
import pytorch_lightning as pl
from pytorch_lightning import Trainer

import nvflare.client.lightning as flare  # Lightning 客户端 API

from model import LitNet
from data import CIFAR10DataModule

def main():
   model = LitNet()
   dm = CIFAR10DataModule()

   trainer = Trainer(max_epochs=1, accelerator="gpu", devices=1)

   # 对 trainer 进行补丁以参与 FL
   flare.patch(trainer)

   while flare.is_running():
       # 可选：验证当前全局模型（对服务器端选择流程有用）
       trainer.validate(model, datamodule=dm)

       # 从接收到的全局模型开始训练（补丁后内部处理）
       trainer.fit(model, datamodule=dm)


if __name__ == "__main__":
   main()
```

要点：Lightning 用户不必放弃自定义联邦消息——他们保留 Trainer 抽象，同时仍正确参与 FL 轮次。

## 步骤 2：在任意环境中打包并执行联邦任务（任务配方）

**适用人群**：希望代码优先定义任务、在整个生命周期中保持稳定的数据科学家和应用团队。

完成步骤 1 后，你已有了一个联邦客户端脚本。步骤 2 将其变成一个可重复运行且能在整个生命周期中顺畅迁移的联邦任务。

任务配方旨在将基于 JSON 的任务配置替换为基于 Python 的任务定义：

- **代码优先**：用 Python 而非复杂配置文件定义完整的 FL 任务
- **一次编写，到处运行**：相同的配方在模拟器、PoC 或生产环境中运行
- **快速部署**：从实验到部署无需更改代码结构

### 示例 2a：在模拟环境中执行 FedAvg 配方

关键关联是你的配方引用你在步骤 1 中创建的客户端训练脚本（例如 `train_script="client.py"`），然后在一个环境中执行它。

```python
# job.py
from nvflare.app_common.workflows.job import FedAvgRecipe
from nvflare.job_config import SimEnv  # 确切的导入路径可能因 NVFlare 版本而异

from model import SimpleNetwork

def main():
   n_clients = 3
   num_rounds = 5
   batch_size = 32

   recipe = FedAvgRecipe(
       name="hello-pt",
       min_clients=n_clients,
       num_rounds=num_rounds,
       model=SimpleNetwork(),
       train_script="client.py",  # <-- 步骤 A 的脚本
       train_args=f"--batch_size {batch_size} --epochs 1",
   )

   env = SimEnv(num_clients=n_clients, num_threads=n_clients)
   recipe.execute(env=env)

if __name__ == "__main__":
   main()
```

这是"一次编写"理念的实际体现：一旦配方正确引用你的客户端脚本，其余的都变成了执行层面的问题。

### 示例 2b：通过交换环境从模拟迁移到真实世界

任务配方通过交换执行环境形式化了一个渐进式工作流：

- **SimEnv（模拟）**：便于开发，快速调试
- **PocEnv（概念验证）**：本地运行时，多进程，真实测试
- **ProdEnv（生产）**：在安全、可扩展基础设施上的分布式部署

![图 2：一个 JobRecipe，多种执行环境——在 SimEnv 中调试，在 PocEnv 中验证，在 ProdEnv 中部署，无需重写任务定义](https://developer-blogs.nvidia.com/wp-content/uploads/2026/04/image3-4.webp)

**图 2.** 一个 JobRecipe，多种执行环境：在 SimEnv 中调试，在 PocEnv 中验证，在 ProdEnv 中部署，无需重写任务定义。

## 入门

从一个你已经信任的脚本开始。

- **步骤 1**：添加客户端 API 握手（或对你的 Lightning Trainer 进行补丁）。
- **步骤 2**：将其封装在任务配方中，先在模拟环境执行，然后是 PoC，再通过交换环境进入生产。

## FLARE 新闻动态

FLARE 正出现在真实部署中——从 [Eli Lilly TuneLab 的联邦学习平台](https://www.rhino.health/)（由 Rhino Federated Computing 使用 NVFlare 构建）到[台湾卫生福利部国家医疗联邦学习计划](https://www.mohw.gov.tw/)，以及跨敏感数据集的 [Tri-labs（Sandia/LANL/LLNL）联邦 AI 试点](https://www.sandia.gov/)。

## 进一步探索

从一个你已经信任的脚本开始。添加最小化的 FLARE 客户端握手（接收 → 训练 → 发送）。准备好后再从单节点模拟扩展到多站点部署。

从这里开始：

- Hello World 示例（最快路径完成你的第一次联邦运行）——[NVFlare Hello World](https://github.com/NVIDIA/NVFlare/tree/main/examples/hello-world)
- 观看演练视频：了解简化 API 栈的实际操作——[网络研讨会录像](https://www.nvidia.com/en-us/on-demand/)
- [客户端 API 文档](https://nvflare.readthedocs.io/en/main/programming_guide/fed_client.html)
- [JobRecipe 文档](https://nvflare.readthedocs.io/en/main/programming_guide/job.html)
- [NVFlare on GitHub](https://github.com/NVIDIA/NVFlare)

## 引用

- 原文：[Federated Learning Without the Refactoring Overhead Using NVIDIA FLARE](https://developer.nvidia.com/blog/federated-learning-without-the-refactoring-overhead-using-nvidia-flare/)
- [NVIDIA FLARE 官方文档](https://nvflare.readthedocs.io/)
- [NVFlare GitHub 仓库](https://github.com/NVIDIA/NVFlare)
