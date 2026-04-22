---
title: 基于 ICL 的表格基础模型的 Context Payload 优化
pubDatetime: 2026-04-22T11:00:00+08:00
description: 探讨基于上下文学习（ICL）的表格基础模型在推理时如何通过优化 context payload 来平衡预测质量、延迟与成本，并以 KNN 预过滤为例提供端到端 Python 实现。
slug: icl-tabular-foundation-models-context-payload-optimization-zh
originalTitle: Context Payload Optimization for ICL-Based Tabular Foundation Models
originalUrl: https://towardsdatascience.com/context-payload-optimization-for-icl-based-tabular-foundation-models/
---

原文标题：Context Payload Optimization for ICL-Based Tabular Foundation Models<br>
原文链接：https://towardsdatascience.com/context-payload-optimization-for-icl-based-tabular-foundation-models/

过去几年，围绕*上下文学习*（ICL）构建的开源和商业表格基础模型投资浪潮持续涌现。例如，2025 年软件巨头 SAP 发布了 SAP-RPT-1 系列模型，专门针对 ERP 领域的任务，涵盖财务规划、销售与采购订单处理以及供应链管理等方向。与传统监督式机器学习——即针对特定任务训练和微调模型——不同，ICL 允许一个经过通用预训练的单一模型借助 *context payload* 中提供的少量任务相关数据即时适配，这些数据充当一种临时训练集的角色。

虽然转向 ICL 消除了为特定任务对表格模型进行（重新）训练的高昂成本，但它在推理时引入了重要的精度与延迟权衡，对于 SAP-RPT-1 等集中托管模型而言尤为突出。一方面，将 context payload 发送至模型服务器所需的时间，以及模型解析和学习该 payload 所需的时间，直接影响整体响应延迟。较小的 payload 可以降低延迟。另一方面，模型可能需要从包含异常值、缺失值和长尾模式的异构上下文数据中推断复杂的模式和数据分布。准确的预测通常依赖于大规模、精心策划的 context payload。在实践中，这意味着需要找到压缩 context payload 的方法，在不降低模型预测性能的前提下缩短响应时间。次要权衡还涉及模型服务吞吐量、响应稳定性以及模型使用的货币成本等因素。所有这些挑战使得 *context payload 优化*成为基于 ICL 工作流中的核心架构关切。

在以下各节中，我们将更详细地审视基于 ICL 的表格基础模型所带来的推理时权衡，概述优化 context payload 的实用策略，并通过一个端到端的 Python 示例，演示如何将基于 KNN 的 context 预过滤作为一种 payload 优化技术加以应用。


## 推理时权衡


分析基于 ICL 的表格基础模型推理时权衡的有效方法，是应用[这篇前作](https://towardsdatascience.com/iron-triangles-powerful-tools-for-analyzing-trade-offs-in-ai-product-development/)中讨论的所谓"铁三角"框架。在那篇文章中，我们展示了 AI 系统的客户和用户如何在响应质量、推理成本与延迟这三者固有张力之间寻求平衡——这是项目管理中经典设计时"三重约束"的推理时类比。关键在于，改善其中任何一个维度通常会给其他维度带来压力：更高质量的响应往往计算量更大，从而同时增加延迟和成本；降低延迟通常需要牺牲质量或为更快的硬件付出更多代价；而降低成本通常意味着接受更慢或更低质量的 AI 响应。

我们在基于 ICL 的表格基础模型语境中同样遭遇这种三角张力。主要权衡是需要在响应质量（以精确率、召回率等指标衡量）与延迟之间取得平衡。考虑一个部署在 ATM 机上的实时欺诈检测系统：精确率和速度都至关重要，但在构建 context payload 时，它们将系统拉向不同方向。更大、更丰富的 payload 为 AI 模型提供更多示例，使其能够推断底层模式、识别罕见和长尾模式，从而提供更高质量的预测。与此同时，每增加一行或一个特征都会增加必须发送到模型服务器并在推理期间解析的数据量，这可能对端到端响应时间产生可测量的开销。在实时应用中，即使 payload 大小有微小增加，也可能明显降低系统响应能力，并最终损害用户体验。

此外，在实践中还会出现若干相关的次要权衡。更大的 context payload 不仅会减慢推理速度，还会消耗更多 token。在基于 token 计费的模式下，这为客户带来了响应延迟与模型使用货币成本之间的张力，对于 SAP-RPT-1 等集中托管模型而言尤为突出。更大的 payload 会增加每次请求的计算时间，造成延迟与吞吐量之间的权衡，可能迫使 AI 系统开发团队做出艰难的扩展决策。还存在一个潜在的质量与稳定性权衡：增加 context 数据的量和多样性可以提高预测精度，但也可能因引入噪声而降低确定性，使输出对数据中的微小变化更加敏感。最后，更复杂的 payload 选择方法（如基于 KNN 的检索）可以提高预测质量，但也会增加 payload 构建时间，进而增加整体延迟。


## Context Payload 优化策略


总体而言，优化 context payload 的策略跨越两个正交维度：优化的*方法*和优化的*时机*。优化方法决定了 payload 如何被精确策划，即用于压缩原始 context 中行数据的具体过滤、聚类或嵌入技术。优化时机关注的是优化在何时、何处执行，例如是离线预计算还是在推理时动态生成，以及是由客户端还是模型服务执行。为构建优化后的 payload 选择特定时机可能对推理延迟和可维护性产生重要影响。payload 优化的方法与时机应与给定 AI 用例的范围、预算、延迟阈值和质量要求相匹配。


### 优化方法


我们可以大致区分*任务无关*和*任务感知*两类 payload 优化方法。任务无关方法依赖随机采样和基于时近性的采样等技术，不需要了解特定预测任务或数据的语义结构。随机采样易于实现、速度快且无偏，是一种有用的基线或兜底策略。然而，它可能无意间丢弃那些捕获了对模型性能至关重要的罕见但重要模式的行。基于时近性的采样假设数据中记录了时间戳，并检索最近的行，这对于具有时间边界（如季节性）或容易发生时间漂移的数据分布很有价值。然而，基于时近性的采样忽略了数据集的整体结构，可能过度加权短期噪声。总体而言，任务无关方法提供了简单性和速度，但对最终 payload 的代表性和相关性的控制有限。

相比之下，任务感知方法可以结合关于预测任务、查询行和底层数据分布的信息，为 context payload 选择最相关的行。一种常见方法是 K 近邻（KNN）采样，它识别历史数据中与查询行相似的行。这可以产生高度相关的上下文数据和强劲的实证表现，但需要距离度量（如余弦相似度）和辅助模型对数据进行向量化或嵌入，因此在大规模场景下可能计算代价较高。另一类技术使用聚类算法（如 K-means、层次聚类、DBSCAN）从与查询行相关的簇中提取代表性样本。这可以确保对数据中多样化模式的充分覆盖，同时避免冗余，但通常需要离线计算聚类并定期重新计算以确保聚类保持最新。

更复杂的任务感知方法也是可行的。例如，可以将原始 context 和查询行嵌入低维向量空间——编码在基础模型 API 的请求中，并在响应中解码；这相当于一种有损压缩，以牺牲部分精度换取更小 payload 带来的延迟和成本收益。检索增强生成（RAG）技术可以进一步用领域特定的基础知识丰富 payload，以提升响应的相关性。

总而言之，任务感知方法通常能产生更高质量的 context payload，但伴随着更大的工程和计算开销。


### 优化时机


一个关键的时机相关决策是关于某些 payload 优化步骤是否可以离线预计算（即"何时"）。例如，可以从历史数据中预计算出一个精心策划的"黄金"数据集，针对信息密度进行优化，并用元数据（如簇 ID、标签等）加以丰富。在推理时，可以从这个更精简的黄金数据集中选择相关行，快速构建并发送 context payload。黄金数据集非常适合稳定的模式和重复性任务（如 ERP 领域中常见销售订单的自动补全），但其策划和维护可能为开发团队带来额外开销。相比之下，即时优化在推理时基于当前查询行和可用历史数据动态生成 payload。这种方法更具适应性，但可能增加每次推理调用的计算成本和延迟。即时优化也不一定能减少开发团队的开销——不维护黄金数据集节省的成本，可能被动态优化 context payload 所需的提示工程工作所抵消。

另一个时机相关的决策是优化发生在客户端还是服务端（即"何处"）。客户端优化使消费方应用拥有完全控制权，允许定制化预处理、本地缓存和更便捷的调试。但这也使每个客户端都需要负责实现和维护自己的优化逻辑——这项工作可能在不同应用和团队之间重复。客户端处理还需要足够的计算资源，而这对于运行在资源受限的物联网或边缘设备上的应用来说可能难以实现。相比之下，服务端优化受益于规模经济：随着来自多个客户端的使用量增加，AI 服务提供商可以有理由采用比任何单个客户端自行部署更复杂的算法和更高端的硬件。提供商还可以利用深厚的、特定于模型的专业知识，以及跨多个客户端环境中模型表现的可见性——随时间积累——形成更精细和统一的策略。服务端处理还简化了治理，因为软件更新、隐私控制、审计日志和合规检查可以统一执行。缺点包括对客户端的透明度降低、提供商基础设施承受更大负载，以及 AI 服务提供商持续开发和维护优化逻辑的成本。

当然，基于 ICL 的表格 AI 工作流也可以采用结合不同选项优势的混合策略。一种有用的模式是：粗粒度的客户端过滤将 payload 缩减到可管理的规模（例如，选择前 K 个最近邻或应用其他简单启发式方法），结合细粒度的服务端剪枝，使用模型感知信号在推理前精炼最终 context。混合方法可以在透明度、灵活性、治理和性能之间取得良好平衡。


## 动手实践：基于 KNN 的 Context 预过滤


在以下示例 Python 代码中，我们将使用 [Solar Flare](https://archive.ics.uci.edu/dataset/89/solar+flare) 数据集和 SAP-RPT-1 模型的[演练场版本](https://rpt.cloud.sap/docs)。有关模型 API 的介绍，请参阅[这篇文章](https://towardsdatascience.com/one-model-to-rule-them-all-sap-rpt-1-and-the-future-of-tabular-foundation-models/)。


### 环境配置


首先，使用 `requirements.txt` 文件安装必要的第三方包：


```
pandas
numpy
requests
scikit-learn
ucimlrepo
```


接下来，创建一个名为 `demo.py` 的文件，并添加以下导入语句：


```
import pandas as pd
import numpy as np
import time
import json
import requests
import sys
import os
from datetime import datetime
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import pairwise_distances
from ucimlrepo import fetch_ucirepo
```


添加以下配置参数：


```
EXPERIMENT_ORDER = ["without_prefiltering", "with_prefiltering"]

API_URL = "https://rpt.cloud.sap/api/predict"
ACCESS_TOKEN_PATH = "access_token.json" # File containing your API token

with open(ACCESS_TOKEN_PATH, "r") as f:
 token = json.load(f)["access_token"]

n_test_rows = 20 # Number of query rows to use
mask_proportion = 0.3 # Proportion of column values to mask (simulating a prediction scenario)
max_masked_columns = 4 # Playground model limitation
random_seed = 3 # Ensure reproducibility
rng = np.random.default_rng(random_seed) # Create a random number generator

ctx_max_rows = 600 # Max rows allowed in context window
```


添加以下代码以启用输出日志记录：


```
class Tee(object):
 """A simple stdout tee: Prints to console and writes to a log file."""
 def __init__(self, logfile_path):
 self.terminal = sys.stdout
 self.log = open(logfile_path, "a", encoding="utf-8")

 def write(self, message):
 self.terminal.write(message)
 self.log.write(message)

 def flush(self):
 self.terminal.flush()
 self.log.flush()

script_dir = os.path.dirname(os.path.abspath(__file__))

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

log_filename = f"log_knn_seed{random_seed}_{"".join([x[0] for x in EXPERIMENT_ORDER])}_{timestamp}.log"

log_path = os.path.join(script_dir, log_filename)

sys.stdout = Tee(log_path)

print(f"Logging enabled. Output is being written to: {log_path}\n")
```


接下来，我们将添加用于诊断、构建 SAP-RPT-1 模型 payload、调用模型以及将预测结果导出为 CSV 文件的辅助函数。

用于计算数据集特征统计信息的示例函数：


```
def compute_feature_stats(df, random_seed):
 """
 Computes cardinality and HHI concentration metric for each feature.
 Saves results to: feature_stats_knn_seed_.csv
 """
 stats = []

 for col in df.columns:
 if col == "id":
 continue

 cardinality = df[col].nunique()

 # Normalized value counts
 vc = df[col].value_counts(normalize=True)

 # Herfindahl-Hirschman Index
 # HHI = 1.0 implies perfectly concentrated (only one value appears)
 # HHI = 0.01 implies very uniform distribution
 # Higher HHI implies higher feature concentration
 hhi = float((vc ** 2).sum())

 # Dominant category proportion (share of most common feature value)
 max_prop = float(vc.max())

 stats.append({
 "feature": col,
 "cardinality": cardinality,
 "hhi": hhi,
 "max_proportion": max_prop
 })

 stats_df = pd.DataFrame(stats)

 timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
 filename = f"feature_stats_knn_seed{random_seed}_{timestamp}.csv"

 stats_df.to_csv(filename, index=False)
 print(f"Saved feature stats to {filename}\n")
```


用于通过模拟预测场景构建 SAP-RPT-1 模型 payload，以及安全调用模型 API 的函数：


```
def mask_row_values(row, allowed_mask_columns, p, rng):
 row = row.copy()
 mask_candidates = [c for c in allowed_mask_columns if rng.random() 0:
 row[key] = value[0].get("prediction")
 else:
 row[key] = None
 flat[row["id"]] = row
 return pd.DataFrame(flat.values()).set_index("id")


def evaluate_accuracy(pred_df, true_df, masked_df):
 correct = 0
 total = 0
 for idx in masked_df.index:
 for col in masked_df.columns:
 # Does not count predictions for unmasked columns
 if masked_df.loc[idx, col] == "[PREDICT]":
 total += 1
 if pred_df.loc[idx, col] == true_df.loc[idx, col]:
 correct += 1
 return correct, total, correct / total if total > 0 else np.nan


def export_predictions_dynamic(true_rows, masked_rows, pred_df, filename):
 """
 Export a NaN-free CSV where:
 - masked columns get model predictions
 - unmasked columns keep their true values
 - pred_df is aligned to true_rows by id
 """

 # Ensure pred_df is indexed by id
 pred_df = pred_df.copy()
 pred_df.index = pred_df.index.astype(int)

 # Reindex pred_df to match true_rows
 pred_df = pred_df.reindex(true_rows.index)

 # Start with true rows
 merged = true_rows.reset_index().copy()

 # Align mask by id
 masked_by_id = masked_rows.copy()

 # Add prediction columns dynamically
 for col in pred_df.columns:
 pred_col = f"pred_{col}"

 # Start with true values
 merged[pred_col] = merged[col]

 # Overwrite only where masked
 mask = masked_by_id[col] == "[PREDICT]"
 merged.loc[mask.values, pred_col] = pred_df.loc[mask.values, col]

 # Save CSV
 merged.to_csv(
 filename,
 index=False,
 encoding="utf-8",
 quoting=1
 )

 print(f"Saved results to {filename}\n")
```


接下来，加载并准备 Solar Flare 数据集：


```
solar_flare_data = fetch_ucirepo(id=89)

df = pd.concat([solar_flare_data.data.features, solar_flare_data.data.targets], axis=1)

df.columns = [
 "zurich_class",
 "spot_size",
 "spot_dist",
 "activity",
 "evolution",
 "prev24_fac",
 "hist_complex",
 "region_complex",
 "area",
 "area_largest_spot",
 "c_class",
 "m_class",
 "x_class",
]

if "id" not in df.columns:
 df["id"] = df.index.astype(str)

# Convert numeric codes to words to force categorical behavior
replacement_map = {"0": "zero", "1": "one", "2": "two", "3": "three"}
for col in df.columns:
 if col != "id":
 df[col] = df[col].astype(str)
 df[col] = df[col].replace(replacement_map)
```


保存特征统计信息：


```
compute_feature_stats(df, random_seed)
```


现在添加代码以模拟预测场景。首先，将 Solar Flare 数据集拆分为 context 行和查询/测试行：


```
df_test_rows = df.sample(n=n_test_rows, random_state=random_seed).reset_index(drop=True)

df_context_full = df.drop(df_test_rows.index).reset_index(drop=True)
```


然后随机遮蔽查询/测试行中的某些列：


```
all_columns = [c for c in df.columns if c != "id"]

allowed_mask_columns = rng.choice(all_columns, size=max_masked_columns, replace=False)

df_test_rows_masked = df_test_rows.apply(
 lambda row: mask_row_values(row, allowed_mask_columns, mask_proportion, rng),
 axis=1
)

df_test_rows_masked["id"] = df_test_rows["id"]
```


### 预过滤逻辑


添加以下代码，使用基于 KNN 的预过滤即时推导出一组优化后的 context 行（`df_context_prefiltered`）：


```
start_prefilter = time.time()

n_test = df_test_rows.shape[0]
budget_per_row = max(1, (ctx_max_rows - n_test) // n_test)

print(f"Context max rows: {ctx_max_rows}")
print(f"Number of test rows: {n_test}")
print(f"KNN budget per test row: {budget_per_row}\n")

# Encode using LabelEncoder (can use more sophisticated vectorizers and embedding models in practice)
encoders = {}
df_context_enc = df_context_full.copy()
df_test_enc = df_test_rows.copy()

for col in df_context_full.columns:
 if col == "id":
 continue
 le = LabelEncoder()
 df_context_enc[col] = le.fit_transform(df_context_full[col].astype(str))
 df_test_enc[col] = le.transform(df_test_rows[col].astype(str))
 encoders[col] = le

X_context = df_context_enc.drop(columns=["id"]).to_numpy()
X_test = df_test_enc.drop(columns=["id"]).to_numpy()

selected_indices = []
for x_test in X_test:
 dists = pairwise_distances([x_test], X_context)[0]
 nearest = np.argsort(dists)[:budget_per_row]
 selected_indices.extend(nearest)

df_context_prefiltered = (
 df_context_full.iloc[selected_indices]
 .drop_duplicates()
 .reset_index(drop=True)
)

end_prefilter = time.time()
prefilter_time = end_prefilter - start_prefilter

print(f"Prefiltering time: {prefilter_time:.3f} seconds")
print(
 f"Prefiltered rows: {len(df_context_prefiltered)} "
 f"({100 * len(df_context_prefiltered) / len(df_context_full):.2f}% of full context)\n"
)
```


### 运行实验


添加以下函数，分别在有和没有 context 优化（即基于 KNN 的预过滤）的情况下调用模型。


```
def run_without_prefiltering():
 print("=== CASE 1: NO PREFILTERING ===")
 
 start = time.time()

 df_context_without_prefiltering = pd.concat(
 [df_context_full, df_test_rows_masked], ignore_index=True
 )

 payload = build_payload(df_context_without_prefiltering)

 success, response = safe_call_rpt1(payload, token)

 end = time.time()

 inference_time = end - start
 print(f"Case 1 inference time: {inference_time:.3f} seconds")

 acc = np.nan
 if success:
 pred_df = flatten_predictions(response["aiApiResponsePayload"]["predictions"])
 pred_df = pred_df.astype(str)

 true_rows = df_test_rows.set_index("id")
 masked_rows = df_test_rows_masked.set_index("id")

 correct, total, acc = evaluate_accuracy(pred_df, true_rows, masked_rows)
 print(f"Case 1 accuracy: {correct}/{total} = {acc:.3f}\n")

 # Use helper for NaN-free export
 timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
 filename = f"results_knn_seed{random_seed}_c_{timestamp}.csv"
 export_predictions_dynamic(true_rows, masked_rows, pred_df, filename)

 else:
 print("Skipping accuracy evaluation.\n")

 return inference_time, acc


def run_with_prefiltering():
 print("=== CASE 2: KNN-BASED PREFILTERING ===")
 
 start = time.time()
 
 df_context_with_prefiltering = pd.concat(
 [df_context_prefiltered, df_test_rows_masked], ignore_index=True
 )

 payload = build_payload(df_context_with_prefiltering)

 success, response = safe_call_rpt1(payload, token)

 end = time.time()

 inference_time = end - start
 print(f"Case 2 inference time (RPT-1 call): {inference_time:.3f} seconds")

 acc = np.nan
 if success:
 pred_df = flatten_predictions(response["aiApiResponsePayload"]["predictions"])
 pred_df = pred_df.astype(str)

 true_rows = df_test_rows.set_index("id")
 masked_rows = df_test_rows_masked.set_index("id")

 correct, total, acc = evaluate_accuracy(pred_df, true_rows, masked_rows)
 print(f"Case 2 accuracy: {correct}/{total} = {acc:.3f}\n")

 # Use helper for NaN-free export
 timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
 filename = f"results_knn_seed{random_seed}_t_{timestamp}.csv"
 export_predictions_dynamic(true_rows, masked_rows, pred_df, filename)

 else:
 print("Skipping accuracy evaluation.\n")

 return inference_time, acc
```


最后，运行实验并打印/记录结果：


```
def run_experiments(order):
 results = {}
 for exp in order:
 if exp == "without_prefiltering":
 results["without_prefiltering"] = run_without_prefiltering()
 elif exp == "with_prefiltering":
 results["with_prefiltering"] = run_with_prefiltering()
 else:
 print(f"Unknown experiment type: {exp}")
 return results

print("=== RUNNING EXPERIMENTS ===\n")
results = run_experiments(EXPERIMENT_ORDER)

print("\n=== FINAL RESULTS ===")
print(results)
```


请注意，第一次调用模型 API 可能需要明显更长的时间，因为服务需要预热。这可能涉及将模型加载到内存中、初始化运行时内核以及建立网络连接。后续调用将重用已初始化的状态，因此往往运行得更快。更改实验的顺序将决定哪个实验承担初始预热成本。要实际观察这一效果，可以尝试更改 `EXPERIMENT_ORDER` 配置参数中的实验顺序（例如，在不使用预过滤的实验之前先运行使用预过滤的实验）。


## 总结


随着基于 ICL 的表格基础模型被越来越广泛地采用，优化的重心将从传统的监督模型训练转向 context payload 的构建。基于 ICL 的系统的质量、成本和延迟特性，与基础模型的训练方式关系不大，而与推理时 context payload 的有效利用方式关系更大。这一转变可能促使各组织走向可重复、可复用的 context payload 管理模式。正如业界最终围绕特征存储、数据管道和提示工程约定形成了标准化实践，我们可以预期 context payload 设计的最佳实践也会出现类似的整合。随着时间的推移，这些模式可能成为与基于 ICL 的表格基础模型合作的开发团队共同词汇的一部分，将 context 优化提升为首要的架构关切。


## 引用

- Diedrich, A. (2025). *Context Payload Optimization for ICL-Based Tabular Foundation Models*. Towards Data Science. https://towardsdatascience.com/context-payload-optimization-for-icl-based-tabular-foundation-models/
- Diedrich, A. (2025). *Iron Triangles: Powerful Tools for Analyzing Trade-Offs in AI Product Development*. Towards Data Science. https://towardsdatascience.com/iron-triangles-powerful-tools-for-analyzing-trade-offs-in-ai-product-development/
- Diedrich, A. (2025). *One Model to Rule Them All: SAP-RPT-1 and the Future of Tabular Foundation Models*. Towards Data Science. https://towardsdatascience.com/one-model-to-rule-them-all-sap-rpt-1-and-the-future-of-tabular-foundation-models/
- UCI Machine Learning Repository. (1989). *Solar Flare Dataset*. https://archive.ics.uci.edu/dataset/89/solar+flare
- SAP. (2025). *SAP-RPT-1 Playground*. https://rpt.cloud.sap/docs
