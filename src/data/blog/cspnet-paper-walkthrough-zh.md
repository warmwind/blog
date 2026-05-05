---
title: CSPNet 论文解读：更轻量，精度不妥协
pubDatetime: 2026-05-05T08:30:00+08:00
description: 深入解析 CSPNet（跨阶段局部网络）的架构设计与实现细节，揭示其如何在降低计算复杂度的同时保持甚至提升模型精度。
slug: cspnet-paper-walkthrough-zh
originalTitle: "CSPNet Paper Walkthrough: Just Better, No Tradeoffs"
originalUrl: https://towardsdatascience.com/cspnet-paper-walkthrough-just-better-no-tradeoff/
---

原文标题：CSPNet Paper Walkthrough: Just Better, No Tradeoffs<br>
原文链接：https://towardsdatascience.com/cspnet-paper-walkthrough-just-better-no-tradeoff/

如何让基于 CNN 的模型更轻量？直接使用该模型的更小版本，对吧？以 ResNet 为例，如果 ResNet-152 太重，为什么不直接用 ResNet-101？或者对于 DenseNet，为什么不用 DenseNet-121 而不是 DenseNet-169？——没错，这种做法是可行的，但你需要为此牺牲一定的精度。基本上，如果你想要更轻量的模型，就必须预期精度会有所下降。

那么，如果我告诉你有一种模型比其基础版本更轻量，却仍能在精度上与之媲美，你会怎么想？这就是 **CSPNet**（跨阶段局部网络，Cross Stage Partial Network）。令人惊喜的是，它能有效降低计算复杂度，同时保持高精度——完全没有权衡取舍！在本文中，我们将讨论 CSPNet 的架构，包括其工作原理以及如何从头实现它。

## CSPNet 简史

CSPNet 最初由 Wang *等人*于 2019 年 11 月发表的论文《*CSPNet: A New Backbone That Can Enhance Learning Capability of CNN*》中提出 [1]。CSPNet 最初被设计用来解决 DenseNet 的局限性。尽管 DenseNet 在计算上已经比 ResNet 更经济，但作者认为 DenseNet 的计算成本仍然偏高。请看下面图 1 中 DenseNet 的主要构建块，理解其原因。

![](https://cdn-images-1.medium.com/max/800/1*r3K1uSN4xpLydqdb_D6UAw.png)

*图 1. DenseNet 模型的主要构建块 [2]。*

在 DenseNet 的构建块（称为*密集块*）中，每个卷积层都从所有前序层获取信息，导致存在大量冗余梯度信息，使训练效率低下。我们可以把它想象成一个由 5 位老师教授同一教材的学生。这实际上是好事，因为学生可以从多个角度了解该特定主题。然而，在某种程度上这会变得冗余，进而低效。对于 DenseNet，我们可以将更深的层视为学生，将所有来自浅层的张量视为老师。在上面的例子中，如果我们将 *H₄* 视为学生，那么 *x₀*、*x₁*、*x₂* 和 *x₃* 张量就充当老师。你可以想象这个学生会被所有这些信息所淹没！

在深入了解 CSPNet 之前，我实际上有一篇专门讨论 DenseNet 的独立文章（参考文献 [3]），如果你想全面了解这种架构的工作原理，强烈建议阅读。

### 目标

CSPNet 的目标是使网络具有更低的计算复杂度和更好的梯度组合。后者的原因是 DenseNet 中大多数梯度信息由彼此的副本组成。需要注意的是，CSPNet 并非独立网络，而是我们应用于 DenseNet 的一种新范式。

现在让我们看一下图 2，了解 CSPNet 如何实现其目标。你可以看到左侧的插图，随着网络深度增加，特征图的数量逐渐增多。如果你读过我之前关于 DenseNet 的文章，这本质上是我们可以通过*增长率*参数控制的，即密集块中每个卷积层产生的特征图数量。事实上，特征图数量的增加正是作者视为计算瓶颈的问题所在。

![](https://cdn-images-1.medium.com/max/2560/1*6CqTSMukla_HQmdqTCCHaQ.png)

*图 2. 左：原始 DenseNet 构建块（与图 1 相同）。右：DenseNet 构建块的 CSPNet 版本（称为 CSPDenseNet）[1]。*

通过应用跨阶段局部机制，我们基本上可以使 DenseNet 的计算更加经济。从右侧的插图可以看到，从 *x₀* 延伸出一条额外的分支，直接通向所谓的*局部过渡层*。这种机制至少带来两个优势，与我之前提到的目标相符。首先，由于密集块处理的特征图数量只有原来的一半，我们可以节省大量计算。其次，梯度信息变得更加多样，因为我们有了一条包含未处理特征图的额外路径，避免了冗余梯度信息。简而言之，CSPNet 的想法是消除 DenseNet 的计算冗余（通过跳跃路径），同时仍然保留其特征复用属性（通过密集块）。

## CSPNet 架构详解

从细节来说，原始特征图首先按通道方向分为两部分，每部分将在不同路径中处理。假设我们有 64 个输入通道，前 32 个特征图（*第 1 部分*）将跳过所有计算，而其余 32 个（*第 2 部分*）将由密集块处理。虽然分割步骤非常简单，但合并步骤实际上并不那么简单。在下面图 3 中，你可以看到有几种不同的合并机制。

![](https://cdn-images-1.medium.com/max/800/1*na__RIorqsVORTSPwIU9Lg.png)

*图 3. CSPNet 中执行特征组合的几种不同方式 [1]。*

在被称为*先融合*（fusion first）（c）的结构中，我们在将*第 1 部分*张量与已被密集块处理的*第 2 部分*张量连接后，再将它们传过过渡层。因此，方案 (c) 实际上很直接，因为两个张量的空间维度完全相同，使我们可以轻松地将它们连接起来。

在我之前的文章 [3] 中，我提到 DenseNet 的过渡层用于同时降低空间维度和通道数。事实上，这一属性要求我们重新思考如何实现*后融合*（fusion last）（d）结构。这本质上是因为过渡层会导致*第 2 部分*张量的空间维度小于*第 1 部分*张量。因此，从技术上讲，我们需要在*第 1 部分*分支应用步幅为 2 的池化，或者简单地在过渡层中省略下采样操作。通过这样做，两个张量的空间维度将相同，从而可以进行连接。

除了只使用放置在特征组合之前或之后的单一过渡层，作者还提出了另一种方法，称为 *CSPDenseNet*（b）。我们可以把它理解为 (c) 和 (d) 的组合，其中我们在张量连接过程前后各放置了两个过渡层。在这种特定情况下，第一个过渡层（放置在*第 2 部分*分支中）通过*跨通道池化*（即在通道维度上操作的池化层）执行通道缩减。同时，第二个过渡层将同时执行空间下采样和通道数量缩减。基本上，在这种方法中，我们两次减少通道数——至少这是我从论文中对这两个过渡层的理解，因为这些层内的详细过程并未明确讨论。

### 实验结果

在这些特征组合机制的实验结果方面，论文中解释说*后融合*（d）优于*先融合*（c），前者能显著降低计算复杂度，而精度只有极轻微的下降。方案 (c) 实际上也降低了计算复杂度，但精度的下降也很显著。作者发现方案 (b) 比这两种方案获得了更好的结果。图 4 显示了几个实验结果，展示了三种特征组合机制与基础模型的性能对比。但奇怪的是，他们选择使用 PeleeNet 而不是 DenseNet 来比较这些结构。

![](https://cdn-images-1.medium.com/max/800/1*L4zpUsYGFdX2FxCvlK00LA.png)

*图 4. 基础 PeleeNet（对应图 3 中的 (a)）、CSPPeleeNet（b）、带先融合方法的 PeleeNet（c）以及带后融合方法的 PeleeNet（d）的性能对比 [1]。*

从上图可以看出，*CSP 后融合*（绿色）确实比 *CSP 先融合*（红色）表现更好。这是基于这样的事实：其精度仅比基础模型下降了 0.1%，同时计算复杂度降低了 21%。与此同时，虽然 *CSP 先融合*成功将计算复杂度降低了 26%，但精度下降相当显著，比基础 PeleeNet 差 1.5%。最令人印象深刻的结构是 *CSPPeleeNet* 变体（蓝色），即使用两个过渡层的那种。从这里我们可以清楚地看到，虽然计算复杂度降低了 13%，但模型的精度实际上提高了 0.2%——再次，没有权衡取舍！

不仅如此，作者还尝试在其他骨干模型上实现 CSPNet。图 5 的结果显示，CSPNet 结构成功将 DenseNet-201-Elastic 和 ResNeXt-50 的计算复杂度分别降低了 19% 和 22%。有趣的是，尽管模型复杂度降低，ResNeXt 模型的精度却有所提升，这与图 4 中 CSPPeleeNet 获得的结果一致。

![](https://cdn-images-1.medium.com/max/800/1*GbC5tOTX9HTdsRiwTAzvog.png)

*图 5. 实现 CSPNet 机制后 DenseNet-201-Elastic 和 ResNeXt-50 的性能提升 [1]。*

### CSPDenseNet 的数学表达

对于喜欢数学的读者，这里有一些你可能会觉得有趣的符号。图 6 和图 7 展示了前向传播阶段 DenseNet 和 CSPDenseNet 块的数学表达式。

在 DenseNet 块中，*x₁* 对应由第一个卷积层 *w₁* 基于输入张量 *x₀* 产生的张量。接下来，我们将原始张量 *x₀* 与 *x₁* 连接，并将它们用作 *w₂* 层的输入（更准确地说，*w* 实际上是卷积层的权重，而不是卷积层本身）。我们随着网络加深不断产生更多特征图并连接现有的特征图。通过这种方式，我们基本上可以说所有前序层的输出都成为当前层的输入。

![](https://cdn-images-1.medium.com/max/800/1*MWyqiAvgRayU8tOok3aScg.png)

*图 6. DenseNet 块中前向传播的数学表示 [1]。*

CSPDenseNet 的情况有所不同。在下面的符号中可以看到，我们有 *x₀'* 和 *x₀''*，即之前称为*第 1 部分*和*第 2 部分*的内容。*x₀''* 张量像 DenseNet 块一样经过处理直到得到 *xₖ*。接下来，该密集块的输出被转发到第一个过渡层，表示为 *wᴛ*。结果张量 *xᴛ* 随后与*第 1 部分*张量 *x₀'* 连接，最终通过第二个过渡层 *wᴜ* 以获得最终输出张量 *xᴜ*。

![](https://cdn-images-1.medium.com/max/800/1*Yh9M2MluucSRM_G-Gi96ow.png)

*图 7. CSPDenseNet 块中前向传播的数学表达式 [1]。*

## CSPDenseNet 实现

现在让我们通过从头实现来深入了解 CSPNet 架构。虽然我们基本上可以将 CSPNet 结构应用于任何骨干网络，但这里我将在 DenseNet 模型上进行，以与之前展示的插图和方程式保持一致。图 8 展示了完整 DenseNet 架构的样貌。请记住，该架构中的每个密集块最初都遵循图 3a 中的 *DenseNet* 结构，我们的目标是将所有这些密集块替换为图 3b 中所示的 *CSPDenseNet* 块。

![](https://cdn-images-1.medium.com/max/1200/1*IjJnHGQpVZUAorEupAjjbg.png)

*图 8. 完整的 DenseNet 架构 [2]。*

我们首先导入所需模块并初始化可配置参数，如代码块 1 所示。`GROWTH` 变量是*增长率*参数，表示密集块中每个瓶颈产生的特征图数量。接下来，`CHANNEL_POOLING` 是我们用来调整第一个过渡层中通道池化机制行为的参数。这里我将此参数设置为 0.8，意味着我们将把通道数缩减到原始通道数的 80%。`COMPRESSION` 参数与 `CHANNEL_POOLING` 变量类似，但操作在第二个过渡层上。最后，我们定义 `REPEATS` 列表，用于设置我们将在每个阶段密集块内初始化的*瓶颈*块数量。

```python
# Codeblock 1
import torch
import torch.nn as nn

GROWTH          = 12
CHANNEL_POOLING = 0.8
COMPRESSION     = 0.5
REPEATS         = [6, 12, 24, 16]
```

### 瓶颈块实现

下面是放置在密集块内的瓶颈块实现。这个 `Bottleneck` 类与我在 DenseNet 文章 [3] 中使用的完全相同。我直接从那里复制粘贴了代码，因为我们完全不需要修改这部分。请记住，瓶颈块由一个 1×1 卷积后跟一个 3×3 卷积组成。

```python
# Codeblock 2
class Bottleneck(nn.Module):
    def __init__(self, in_channels):
        super().__init__()
        
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(p=0.2)
        
        self.bn0   = nn.BatchNorm2d(num_features=in_channels)
        self.conv0 = nn.Conv2d(in_channels=in_channels, 
                               out_channels=GROWTH*4,          
                               kernel_size=1, 
                               padding=0, 
                               bias=False)
        
        self.bn1   = nn.BatchNorm2d(num_features=GROWTH*4)
        self.conv1 = nn.Conv2d(in_channels=GROWTH*4, 
                               out_channels=GROWTH,            
                               kernel_size=3, 
                               padding=1, 
                               bias=False)
    
    def forward(self, x):
        print(f'original\t: {x.size()}')
        
        out = self.dropout(self.conv0(self.relu(self.bn0(x))))
        print(f'after conv0\t: {out.size()}')
        
        out = self.dropout(self.conv1(self.relu(self.bn1(out))))
        print(f'after conv1\t: {out.size()}')
        
        concatenated = torch.cat((out, x), dim=1)              
        print(f'after concat\t: {concatenated.size()}')
        
        return concatenated
```

以下测试代码模拟密集块内的第一个瓶颈块。请记住，架构中最前面的卷积层（具有 7×7 核的那个）产生 64 个特征图，但由于在 CSPNet 的情况下我们只想处理其中一半（*第 2 部分*张量），因此这里我们将使用具有 32 个特征图的张量进行测试。

```python
# Codeblock 3
bottleneck = Bottleneck(in_channels=32)

x = torch.randn(1, 32, 56, 56)
x = bottleneck(x)
```

```
# Codeblock 3 Output
original     : torch.Size([1, 32, 56, 56])
after conv0  : torch.Size([1, 48, 56, 56])
after conv1  : torch.Size([1, 12, 56, 56])
after concat : torch.Size([1, 44, 56, 56])
```

从上面的结果输出中可以看到，在处理结束时特征图数量变为 44，这个数字是通过将输入通道数和增长率相加得到的，即 32 + 12 = 44。同样，如果你想更好地理解这个计算，可以查看我的 DenseNet 文章 [3]。

### 密集块实现

现在为了方便地创建一系列瓶颈块，我们可以将其包装在代码块 4 的 `DenseBlock` 类中。之后，我们可以通过 `repeats` 参数指定要堆叠的瓶颈块数量。同样，这个类也是从我的 DenseNet 文章中复制的，所以我不再进一步解释它。

```python
# Codeblock 4
class DenseBlock(nn.Module):
    def __init__(self, in_channels, repeats):
        super().__init__()
        self.bottlenecks = nn.ModuleList()
        
        for i in range(repeats):
            current_in_channels = in_channels + i * GROWTH
            self.bottlenecks.append(Bottleneck(in_channels=current_in_channels))
        
    def forward(self, x):
        print(f'original\t\t\t: {x.size()}')
        
        for i, bottleneck in enumerate(self.bottlenecks):
            x = bottleneck(x)
            print(f'after bottleneck #{i}\t\t: {x.size()}')
            
        return x
```

为了检查我们的 `DenseBlock` 类是否正常工作，我们将使用下面的代码块 5 进行测试。这里我尝试模拟第一个密集块处理的*第 2 部分*张量，该密集块包含 6 个瓶颈块的序列。

```python
# Codeblock 5
dense_block = DenseBlock(in_channels=32, repeats=6)
x = torch.randn(1, 32, 56, 56)

x = dense_block(x)
```

下面是输出的样子。从这里我们可以清楚地看到，每个瓶颈块成功地将特征图增加了 12。

```
# Codeblock 5 Output
original             : torch.Size([1, 32, 56, 56])
after bottleneck #0  : torch.Size([1, 44, 56, 56])
after bottleneck #1  : torch.Size([1, 56, 56, 56])
after bottleneck #2  : torch.Size([1, 68, 56, 56])
after bottleneck #3  : torch.Size([1, 80, 56, 56])
after bottleneck #4  : torch.Size([1, 92, 56, 56])
after bottleneck #5  : torch.Size([1, 104, 56, 56])
```

### 第一过渡层

请记住，图 3b 中的 *CSPDenseNet* 变体使用了两个过渡层。在本节中，我们将讨论第一个过渡层，即用于处理*第 2 部分*分支中张量的那个。在这里，我们不会执行空间下采样，这就是为什么你在下面代码块 6 的 `__init__()` 方法中看不到任何池化层的原因。相反，这里我们只执行跨通道池化，可以将其理解为一种标准池化操作，但是跨通道维度进行。要实现它，我们可以简单地使用 1×1 卷积（`#(2)`）并指定我们想要的输出通道数（`#(1)`）。可以这样理解：在空间下采样过程中，我们可以使用池化或步幅卷积层来实现，后者将从局部邻域中汇聚具有特定权重的像素值。在跨通道池化的情况下，由于 PyTorch 没有特定的层可用，我们可以简单地用逐点卷积层替代，这样我们基本上可以在通道维度上汇聚像素值。

```python
# Codeblock 6
class FirstTransition(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        
        self.bn   = nn.BatchNorm2d(num_features=in_channels)
        self.relu = nn.ReLU()
        self.conv = nn.Conv2d(in_channels=in_channels, 
                              out_channels=out_channels,   #(1)
                              kernel_size=1,               #(2)
                              padding=0,
                              bias=False)
        self.dropout = nn.Dropout(p=0.2)
     
    def forward(self, x):
        print(f'original\t\t: {x.size()}')
        
        out = self.dropout(self.conv(self.relu(self.bn(x))))
        print(f'after first_transition\t: {out.size()}')
        
        return out
```

代码块 5 的输出结果显示，经过密集块处理后，*第 2 部分*张量的形状为 104×56×56。因此，在下面的测试代码中，我将使用这个张量形状来模拟该阶段的第一过渡层。要调整输出通道数，我们可以简单地将输入通道数与我们之前初始化的 `CHANNEL_POOLING` 变量相乘，如代码块 7 中的 `#(1)` 行所示。

```python
# Codeblock 7
first_transition = FirstTransition(in_channels=104, 
                                   out_channels=int(104*CHANNEL_POOLING)) #(1)

x = torch.randn(1, 104, 56, 56)
x = first_transition(x)
```

现在当上面的代码运行时，我们可以看到特征图数量从 104 缩减到 83（原始的 80%）。

```
# Codeblock 7 Output
original		        : torch.Size([1, 104, 56, 56])
after first_transition  : torch.Size([1, 83, 56, 56])
```

### 第二过渡层

第二过渡层的结构与第一个大致相同，只是这里还有一个步幅为 2 的平均池化层，将空间维度减半（`#(1)`）。

```python
# Codeblock 8
class SecondTransition(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        
        self.bn   = nn.BatchNorm2d(num_features=in_channels)
        self.relu = nn.ReLU()
        self.conv = nn.Conv2d(in_channels=in_channels, 
                              out_channels=out_channels, 
                              kernel_size=1, 
                              padding=0,
                              bias=False)
        self.dropout = nn.Dropout(p=0.2)
        self.pool = nn.AvgPool2d(kernel_size=2, stride=2)    #(1)
     
    def forward(self, x):
        print(f'original\t\t: {x.size()}')

        out = self.pool(self.dropout(self.conv(self.relu(self.bn(x)))))
        print(f'after second_transition\t: {out.size()}')
        
        return out
```

请记住，进入第二过渡层的张量是*第 1 部分*和*第 2 部分*张量的连接结果。这本质上是为什么在下面的测试代码中，我将此层设置为接受 32 + 83 = 115 个特征图的原因。与第一过渡层类似，这里我们将特征图数量乘以 `COMPRESSION` 变量（`#(1)`）以进一步减少通道数。

```python
# Codeblock 9
second_transition = SecondTransition(in_channels=115, 
                                     out_channels=int(115*COMPRESSION))  #(1)

x = torch.randn(1, 115, 56, 56)
x = second_transition(x)
```

在下面的结果输出中，我们可以看到由于平均池化层，空间维度减半。同时，由于我们将 `COMPRESSION` 参数设置为 0.5，特征图数量也从 115 减少到 57。

```
# Codeblock 9 Output
original                : torch.Size([1, 115, 56, 56])
after second_transition : torch.Size([1, 57, 28, 28])
```

### CSPDenseNet 模型

有了所有组件，我们现在可以构建完整的 CSPDenseNet 架构，我在下面的代码块 10a、10b 和 10c 中分解了它。现在先关注代码块 10a，其中我根据图 8 给出的结构初始化所有层。你可以看到在 `#(1)` 行，我们初始化了一个 7×7 卷积层，作为网络的输入层。该层随后跟着一个最大池化层（`#(2)`）。这两层都使用步幅为 2，意味着输入张量的空间维度将减小到原始大小的四分之一。

```python
# Codeblock 10a
class CSPDenseNet(nn.Module):
    def __init__(self):
        super().__init__()
        
        self.first_conv = nn.Conv2d(in_channels=3,         #(1)
                                    out_channels=64, 
                                    kernel_size=7,    
                                    stride=2,         
                                    padding=3,        
                                    bias=False)
        self.first_pool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)  #(2)
        channel_count = 64
        
        
        
        ##### Stage 0
        self.dense_block_0 = DenseBlock(in_channels=channel_count//2, 
                                        repeats=REPEATS[0])
        
        self.first_transition_0 = FirstTransition(in_channels=(channel_count//2)+(REPEATS[0]*GROWTH), 
                                                  out_channels=int(((channel_count//2)+(REPEATS[0]*GROWTH))*CHANNEL_POOLING))
        
        channel_count = (channel_count - (channel_count//2)) + int(((channel_count//2)+(REPEATS[0]*GROWTH))*CHANNEL_POOLING)
        
        self.second_transition_0 = SecondTransition(in_channels=channel_count, 
                                                  out_channels=int(channel_count*COMPRESSION))
        
        channel_count = int(channel_count*COMPRESSION)
        #####
        
        
        ##### Stage 1
        self.dense_block_1 = DenseBlock(in_channels=channel_count//2, 
                                        repeats=REPEATS[1])
        
        self.first_transition_1 = FirstTransition(in_channels=(channel_count//2)+(REPEATS[1]*GROWTH), 
                                                  out_channels=int(((channel_count//2)+(REPEATS[1]*GROWTH))*CHANNEL_POOLING))
        
        channel_count = (channel_count - (channel_count//2)) + int(((channel_count//2)+(REPEATS[1]*GROWTH))*CHANNEL_POOLING)
        
        self.second_transition_1 = SecondTransition(in_channels=channel_count, 
                                                  out_channels=int(channel_count*COMPRESSION))
        
        channel_count = int(channel_count*COMPRESSION)
        #####
        
        
        ##### Stage 2
        self.dense_block_2 = DenseBlock(in_channels=channel_count//2, 
                                        repeats=REPEATS[2])
        
        self.first_transition_2 = FirstTransition(in_channels=(channel_count//2)+(REPEATS[2]*GROWTH), 
                                                  out_channels=int(((channel_count//2)+(REPEATS[2]*GROWTH))*CHANNEL_POOLING))
        
        channel_count = (channel_count - (channel_count//2)) + int(((channel_count//2)+(REPEATS[2]*GROWTH))*CHANNEL_POOLING)
        
        self.second_transition_2 = SecondTransition(in_channels=channel_count, 
                                                  out_channels=int(channel_count*COMPRESSION))
        
        channel_count = int(channel_count*COMPRESSION)
        #####
        
        
        ##### Stage 3
        self.dense_block_3 = DenseBlock(in_channels=channel_count//2, 
                                        repeats=REPEATS[3])
        
        self.first_transition_3 = FirstTransition(in_channels=(channel_count//2)+(REPEATS[3]*GROWTH), 
                                                  out_channels=int(((channel_count//2)+(REPEATS[3]*GROWTH))*CHANNEL_POOLING))
        
        channel_count = (channel_count - (channel_count//2)) + int(((channel_count//2)+(REPEATS[3]*GROWTH))*CHANNEL_POOLING)
        #####
        
        
        self.avgpool = nn.AdaptiveAvgPool2d(output_size=(1,1))             #(3)
        self.fc = nn.Linear(in_features=channel_count, out_features=1000)  #(4)
```

继续上面的代码块，这里我根据层所属的阶段对初始化的层进行分组。现在来关注我称为 `Stage 0` 的部分。你可以看到，我们有一个密集块（`dense_block_0`）和第一过渡层（`first_transition_0`）。这两个组件负责处理*第 2 部分*张量。接下来，我们初始化第二过渡层（`second_transition_0`），用于处理*第 1 部分*和*第 2 部分*张量的连接结果。由于通道数会根据 `GROWTH`、`CHANNEL_POOLING`、`COMPRESSION` 和 `REPEATS` 变量动态变化，我们需要在每步之后跟踪通道数，以便模型可以根据这些变量自适应地调整自身。对所有其余阶段重复相同操作，只是在 `Stage 3` 中没有初始化第二过渡层，因为此时我们不再进一步减少通道数和空间维度。相反，我们将直接把连接的 `part 1` 和 `part 2` 张量传递给平均池化层（`#(3)`）和分类层（`#(4)`）。以上就是我们对代码块 10a 的讨论。

在进入 `forward()` 方法之前，还有一个函数我们需要创建：`split_channels()`。顾名思义，这个函数（写在下面的代码块 10b 中）用于将张量分割为*第 1 部分*和*第 2 部分*。这里的 if-else 语句用于检查通道数是奇数还是偶数。如果通道数是偶数，直接将它们分成两份（`#(4)`）就很简单了。但如果通道数是奇数，我们需要在最终分割它们之前（`#(3)`）手动确定每部分的大小，如 `#(1)` 和 `#(2)` 行所示。

```python
# Codeblock 10b
    def split_channels(self, x):

        channel_count = x.size(1)

        if channel_count%2 != 0:
            split_size_2 = channel_count // 2            #(1)
            split_size_1 = channel_count - split_size_2  #(2)
            return torch.split(x, [split_size_1, split_size_2], dim=1)  #(3)

        else:
            return torch.split(x, channel_count // 2, dim=1)            #(4)
```

在完成 `__init__()` 和 `split_channel()` 方法的定义后，我们现在可以在下面的代码块 10c 中实现 `forward()` 方法。总体而言，我们在这里做的是简单地顺序前向传播张量。现在来关注我称为 `Stage 0` 的部分。你可以看到，在张量通过 `first_pool` 层（`#(1)`）之后，我们使用我们之前声明的 `split_channels()` 函数将其分割为两部分（`#(2)`）。从那里，我们得到了 `part1` 和 `part2` 张量。我们将 `part1` 张量一直保留到阶段结束。同时，对于 `part2` 张量，我们将用密集块（`#(3)`）和第一过渡层（`#(4)`）处理它。接下来，我们将结果张量与 `part1` 张量连接以创建跳跃连接（`#(5)`）。然后，我们最终将其传过第二过渡层（`#(6)`）。对所有阶段重复相同步骤，直到最终到达输出层进行分类。请记住，`Stage 3` 因为没有第二过渡层而有所不同。

```python
# Codeblock 10c
    def forward(self, x):
        print(f'original\t\t\t: {x.size()}')
        
        x = self.first_conv(x)
        print(f'after first_conv\t\t: {x.size()}')
        
        x = self.first_pool(x)      #(1)
        print(f'after first_pool\t\t: {x.size()}\n')
        
        
        
        ##### Stage 0
        part1, part2 = self.split_channels(x)    #(2)
        print(f'part1\t\t\t\t: {part1.size()}')
        print(f'part2\t\t\t\t: {part2.size()}')
        
        part2 = self.dense_block_0(part2)        #(3)
        print(f'part2 after dense block 0\t: {part2.size()}')
        
        part2 = self.first_transition_0(part2)   #(4)
        print(f'part2 after first trans 0\t: {part2.size()}')
        
        x = torch.cat((part1, part2), dim=1)     #(5)
        print(f'after concatenate\t\t: {x.size()}')
        
        x = self.second_transition_0(x)          #(6)
        print(f'after second transition 0\t: {x.size()}\n')
        
        
        
        ##### Stage 1
        part1, part2 = self.split_channels(x)
        print(f'part1\t\t\t\t: {part1.size()}')
        print(f'part2\t\t\t\t: {part2.size()}')
        
        part2 = self.dense_block_1(part2)
        print(f'part2 after dense block 1\t: {part2.size()}')
        
        part2 = self.first_transition_1(part2)
        print(f'part2 after first trans 1\t: {part2.size()}')
        
        x = torch.cat((part1, part2), dim=1)
        print(f'after concatenate\t\t: {x.size()}')
        
        x = self.second_transition_1(x)
        print(f'after second transition 1\t: {x.size()}\n')
        
        
        
        ##### Stage 2
        part1, part2 = self.split_channels(x)
        print(f'part1\t\t\t\t: {part1.size()}')
        print(f'part2\t\t\t\t: {part2.size()}')
        
        part2 = self.dense_block_2(part2)
        print(f'part2 after dense block 2\t: {part2.size()}')
        
        part2 = self.first_transition_2(part2)
        print(f'part2 after first trans 2\t: {part2.size()}')
        
        x = torch.cat((part1, part2), dim=1)
        print(f'after concatenate\t\t: {x.size()}')
        
        x = self.second_transition_2(x)
        print(f'after second transition 2\t: {x.size()}\n')
        
        
        
        ##### Stage 3
        part1, part2 = self.split_channels(x)
        print(f'part1\t\t\t\t: {part1.size()}')
        print(f'part2\t\t\t\t: {part2.size()}')
        
        part2 = self.dense_block_3(part2)
        print(f'part2 after dense block 2\t: {part2.size()}')
        
        part2 = self.first_transition_3(part2)
        print(f'part2 after first trans 2\t: {part2.size()}')
        
        x = torch.cat((part1, part2), dim=1)
        print(f'after concatenate\t\t: {x.size()}\n')
        
        
        
        x = self.avgpool(x)
        print(f'after avgpool\t\t\t: {x.size()}')
        
        x = torch.flatten(x, start_dim=1)
        print(f'after flatten\t\t\t: {x.size()}')
        
        x = self.fc(x)
        print(f'after fc\t\t\t: {x.size()}')
        
        return x
```

现在让我们通过运行下面的代码块 11 来测试我们刚刚创建的 CSPDenseNet 类。这里我使用一个形状为 3×224×224 的哑张量来模拟通过网络的 224×224 RGB 图像。

```python
# Codeblock 11
cspdensenet = CSPDenseNet()

x = torch.randn(1, 3, 224, 224)
x = cspdensenet(x)
```

下面是输出的样子。你可以看到，每次张量进入网络时，我们的 `split_channels()` 方法都会正确地将张量分成两部分（`#(1-2)`）。然后，每个阶段中密集块内的瓶颈块也正确地将*第 2 部分*张量的通道数增加了 12，随后被传过第一过渡层。第一过渡层本身成功地将通道数减少了 20%，如 `#(3)` 行所示，模拟了跨通道池化机制。之后，结果张量与来自*第 1 部分*的张量连接（`#(4)`）并通过第二过渡层（`#(5)`），进一步减少通道数并将空间维度减半。我们对所有阶段执行相同操作，直到最终得到 1000 类预测。

```
# Codeblock 11 Output
original                  : torch.Size([1, 3, 224, 224])
after first_conv          : torch.Size([1, 64, 112, 112])
after first_pool          : torch.Size([1, 64, 56, 56])

part1                     : torch.Size([1, 32, 56, 56])    #(1)
part2                     : torch.Size([1, 32, 56, 56])    #(2)
after bottleneck #0       : torch.Size([1, 44, 56, 56])
after bottleneck #1       : torch.Size([1, 56, 56, 56])
after bottleneck #2       : torch.Size([1, 68, 56, 56])
after bottleneck #3       : torch.Size([1, 80, 56, 56])
after bottleneck #4       : torch.Size([1, 92, 56, 56])
after bottleneck #5       : torch.Size([1, 104, 56, 56])
part2 after dense block 0 : torch.Size([1, 104, 56, 56])
part2 after first trans 0 : torch.Size([1, 83, 56, 56])    #(3)
after concatenate         : torch.Size([1, 115, 56, 56])   #(4)
after second transition 0 : torch.Size([1, 57, 28, 28])    #(5)

part1                     : torch.Size([1, 29, 28, 28])
part2                     : torch.Size([1, 28, 28, 28])
after bottleneck #0       : torch.Size([1, 40, 28, 28])
after bottleneck #1       : torch.Size([1, 52, 28, 28])
after bottleneck #2       : torch.Size([1, 64, 28, 28])
after bottleneck #3       : torch.Size([1, 76, 28, 28])
after bottleneck #4       : torch.Size([1, 88, 28, 28])
after bottleneck #5       : torch.Size([1, 100, 28, 28])
after bottleneck #6       : torch.Size([1, 112, 28, 28])
after bottleneck #7       : torch.Size([1, 124, 28, 28])
after bottleneck #8       : torch.Size([1, 136, 28, 28])
after bottleneck #9       : torch.Size([1, 148, 28, 28])
after bottleneck #10      : torch.Size([1, 160, 28, 28])
after bottleneck #11      : torch.Size([1, 172, 28, 28])
part2 after dense block 1 : torch.Size([1, 172, 28, 28])
part2 after first trans 1 : torch.Size([1, 137, 28, 28])
after concatenate         : torch.Size([1, 166, 28, 28])
after second transition 1 : torch.Size([1, 83, 14, 14])

part1                     : torch.Size([1, 42, 14, 14])
part2                     : torch.Size([1, 41, 14, 14])
after bottleneck #0       : torch.Size([1, 53, 14, 14])
after bottleneck #1       : torch.Size([1, 65, 14, 14])
after bottleneck #2       : torch.Size([1, 77, 14, 14])
after bottleneck #3       : torch.Size([1, 89, 14, 14])
after bottleneck #4       : torch.Size([1, 101, 14, 14])
after bottleneck #5       : torch.Size([1, 113, 14, 14])
after bottleneck #6       : torch.Size([1, 125, 14, 14])
after bottleneck #7       : torch.Size([1, 137, 14, 14])
after bottleneck #8       : torch.Size([1, 149, 14, 14])
after bottleneck #9       : torch.Size([1, 161, 14, 14])
after bottleneck #10      : torch.Size([1, 173, 14, 14])
after bottleneck #11      : torch.Size([1, 185, 14, 14])
after bottleneck #12      : torch.Size([1, 197, 14, 14])
after bottleneck #13      : torch.Size([1, 209, 14, 14])
after bottleneck #14      : torch.Size([1, 221, 14, 14])
after bottleneck #15      : torch.Size([1, 233, 14, 14])
after bottleneck #16      : torch.Size([1, 245, 14, 14])
after bottleneck #17      : torch.Size([1, 257, 14, 14])
after bottleneck #18      : torch.Size([1, 269, 14, 14])
after bottleneck #19      : torch.Size([1, 281, 14, 14])
after bottleneck #20      : torch.Size([1, 293, 14, 14])
after bottleneck #21      : torch.Size([1, 305, 14, 14])
after bottleneck #22      : torch.Size([1, 317, 14, 14])
after bottleneck #23      : torch.Size([1, 329, 14, 14])
part2 after dense block 2 : torch.Size([1, 329, 14, 14])
part2 after first trans 2 : torch.Size([1, 263, 14, 14])
after concatenate         : torch.Size([1, 305, 14, 14])
after second transition 2 : torch.Size([1, 152, 7, 7])

part1                     : torch.Size([1, 76, 7, 7])
part2                     : torch.Size([1, 76, 7, 7])
after bottleneck #0       : torch.Size([1, 88, 7, 7])
after bottleneck #1       : torch.Size([1, 100, 7, 7])
after bottleneck #2       : torch.Size([1, 112, 7, 7])
after bottleneck #3       : torch.Size([1, 124, 7, 7])
after bottleneck #4       : torch.Size([1, 136, 7, 7])
after bottleneck #5       : torch.Size([1, 148, 7, 7])
after bottleneck #6       : torch.Size([1, 160, 7, 7])
after bottleneck #7       : torch.Size([1, 172, 7, 7])
after bottleneck #8       : torch.Size([1, 184, 7, 7])
after bottleneck #9       : torch.Size([1, 196, 7, 7])
after bottleneck #10      : torch.Size([1, 208, 7, 7])
after bottleneck #11      : torch.Size([1, 220, 7, 7])
after bottleneck #12      : torch.Size([1, 232, 7, 7])
after bottleneck #13      : torch.Size([1, 244, 7, 7])
after bottleneck #14      : torch.Size([1, 256, 7, 7])
after bottleneck #15      : torch.Size([1, 268, 7, 7])
part2 after dense block 2 : torch.Size([1, 268, 7, 7])
part2 after first trans 2 : torch.Size([1, 214, 7, 7])
after concatenate         : torch.Size([1, 290, 7, 7])

after avgpool             : torch.Size([1, 290, 1, 1])
after flatten             : torch.Size([1, 290])
after fc                  : torch.Size([1, 1000])
```

## 结语

就这样！我们成功地学习了 CSPNet 并在 DenseNet 骨干上实现了它。正如我之前提到的，我们实际上可以将 CSPNet 的思想用于改进任何其他骨干模型，如 ResNet 或 ResNeXt。所以这里我挑战你从头开始在这些模型上实现 CSPNet。

老实说，我无法确认我的实现 100% 正确，因为论文的官方 GitHub 仓库 [4] 没有提供 PyTorch 实现——但这至少是我从论文中理解的所有内容。如果你发现代码或我的解释中有任何错误，请告知我。感谢阅读，我们下篇文章再见！

顺便说一句，你也可以在我的 GitHub 仓库 [5] 中找到本文中使用的代码。

## 参考文献

[1] Chien-Yao Wang *等人*. CSPnet: A New Backbone That Can Enhance Learning Capability of CNN. Arxiv. [https://arxiv.org/abs/1911.11929](https://arxiv.org/abs/1911.11929) [2025年10月1日访问].

[2] Gao Huang *等人*. Densely Connected Convolutional Networks. Arxiv. [https://arxiv.org/abs/1608.06993](https://arxiv.org/abs/1608.06993) [2025年9月18日访问].

[3] [Muhammad Ardi](https://medium.com/u/9801a58700ac). DenseNet Paper Walkthrough: All Connected. Towards Data Science. [https://towardsdatascience.com/densenet-paper-walkthrough-all-connected/](https://towardsdatascience.com/densenet-paper-walkthrough-all-connected/) [2026年4月26日访问].

[4] WongKinYiu. CrossStagePartialNetworks. GitHub. [https://github.com/WongKinYiu/CrossStagePartialNetworks](https://github.com/WongKinYiu/CrossStagePartialNetworks) [2025年10月1日访问].

[5] MuhammadArdiPutra. CSPNet. GitHub. [https://github.com/MuhammadArdiPutra/medium_articles/blob/main/Deep%20Learning%20From%20Scratch/CSPNet.ipynb](https://github.com/MuhammadArdiPutra/medium_articles/blob/main/Deep%20Learning%20From%20Scratch/CSPNet.ipynb) [2025年10月1日访问].

## 引用

- 原文：[CSPNet Paper Walkthrough: Just Better, No Tradeoffs](https://towardsdatascience.com/cspnet-paper-walkthrough-just-better-no-tradeoff/)
