---
title: 在 Amazon SageMaker 上结合 Amazon Athena 与 Amazon Quick 释放 Agentic AI 分析能力
pubDatetime: 2026-05-03T10:20:00+08:00
description: 本文演示如何通过 Amazon SageMaker、Amazon Athena 和 Amazon Quick 构建 Agentic AI 分析架构，使业务用户能够通过自然语言界面查询复杂的湖仓数据，无需 SQL 专业知识。
slug: agentic-ai-analytics-sagemaker-athena-quicksight-zh
originalTitle: "Unleashing Agentic AI Analytics on Amazon SageMaker with Amazon Athena and Amazon Quick"
originalUrl: https://aws.amazon.com/blogs/machine-learning/unleashing-agentic-ai-analytics-on-amazon-sagemaker-with-amazon-athena-and-amazon-quick/
---

原文标题：Unleashing Agentic AI Analytics on Amazon SageMaker with Amazon Athena and Amazon Quick<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/unleashing-agentic-ai-analytics-on-amazon-sagemaker-with-amazon-athena-and-amazon-quick/

现代企业在从跨越数 PB 级别的数据湖和湖仓中提取可操作洞察方面面临越来越大的挑战，这些数据涵盖结构化和非结构化数据。传统分析需要 SQL、数据建模和商业智能工具方面的专业技术知识，这在零售、金融服务、医疗健康、旅游与酒店、制造等众多行业中造成了决策瓶颈。本架构演示了 Amazon Quick 的 Agentic AI 助手如何将数据分析转变为自助服务能力，展示了如何使业务用户通过直观的自然语言界面查询复杂的结构化数据集，并与非结构化数据混合使用，以发现有价值的洞察，从而改善业务成果。

为了演示该功能，我们使用 TPC-H 数据集作为基础构建了一个湖仓。这个集成架构利用 Amazon Simple Storage Service（Amazon S3）作为存储、Amazon SageMaker 和 AWS Glue 用于湖仓、Amazon Athena 用于跨多种存储格式（S3 Table、Iceberg 和 Parquet）进行无服务器 SQL 查询，以及 Amazon Quick 的多项功能来构建仪表盘和对话式 AI agent，为数据洞察提供自然语言访问。通过使用 Amazon Quick Spaces 集成知识库，该解决方案在保持企业级安全性、治理框架以及现代数据驱动决策所需的可扩展性的同时，为业务用户实现了对湖仓数据的民主化访问。

## 解决方案概述

下图展示了我们作为本文一部分实现的整体设计和相应数据流。

![AWS 数据分析架构图，展示数据从 TPC-H 结构化数据通过 Amazon SageMaker、S3、Athena、QuickSight 到终端用户的流向，以及编号 1-9 的工作流步骤](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/Screenshot-2026-04-09-at-1.56.41%20PM.png)

图 1：整体设计图。请参考以下步骤了解详细的端到端数据流和用户交互能力。

1. **数据源摄入**：结构化数据 TPC-H 作为主要数据源，包含以关系数据库格式存储的基准数据集。AWS 将 TPC-H 数据托管在公开可用的 S3 存储桶中（s3://redshift-downloads/TPC-H/2.18/100GB）。
2. **数据加载**：Amazon Athena 执行第一层查询，对 TPC-H 结构化数据运行无服务器 SQL 查询，以提取和准备数据、将数据加载到 S3，并在 Glue 中创建相应的目录。
3. **多格式存储层**：为了展示数据湖和湖仓的多样性，我们将数据保存为三种优化的存储格式：
   - **Amazon S3 - CSV**：使用外部表基于现有 CSV 文件创建 Athena 表。
   - **Amazon S3（Apache Iceberg-parquet）**：支持时间旅行和模式演进的 ACID 兼容表格格式。
   - **Amazon S3 Table**：Amazon S3 Tables 提供首个具有内置 Apache Iceberg 支持的云对象存储，简化了大规模表格数据的存储。
4. **元数据编目**：AWS Glue Catalog 对所有三种存储格式进行索引，创建统一的元数据层，实现跨不同数据格式的无缝查询。
5. **湖仓查询层**：我们使用 Amazon Athena 通过 Glue Catalog 元数据跨存储格式（S3 Table、Iceberg 和 Parquet）执行 SQL 查询，提供统一的查询接口。
6. **商业智能流水线**：结构化 TPC-H 数据流入 Amazon Quick，后者与 Quick Sight 集成以创建：
   - **数据集** – 我们使用 Amazon Quick 的 Amazon Athena 连接提取结构化数据，加载到 Quick SPICE（超快速并行内存计算引擎）数据集。
   - **主题** – 为业务上下文组织的数据域。
   - **使用 Q 构建仪表盘** – 具有自然语言查询能力的交互式可视化，用于构建和发布仪表盘。
7. **AI 知识增强**：与结构化数据流并行，TPC-H 规范的网络爬虫摄入非结构化数据（文档、规范），并将其馈入知识库以提供上下文理解。
8. **对话式 Agentic AI 层**：知识库为 Amazon Quick Spaces（协作环境）提供支持，进而使 Amazon Quick 聊天 agent 具备上下文感知和领域知识，以支持自然语言交互。
9. **终端用户访问**：用户通过两个主要界面与系统交互：
   - **使用 Q 的仪表盘** – 可视化分析和自助服务商业智能。
   - **聊天 Agent** – 用于自然语言数据探索的对话式 AI。

## 前提条件

在开始之前，请确保具备以下前提条件：

- AWS 账户和 Amazon Quick 账户。
- 对 Amazon Simple Storage Service、Amazon SageMaker、AWS Lake Formation 和 Amazon Athena 的基本了解。
- 具有在 S3 中创建数据集、运行 Athena 查询、创建 Glue 目录、Lake Formation 管理员权限以及访问 Quick 功能权限的控制台角色。要确定相关策略，请参考策略文档。

## 为湖仓/数据湖准备数据

在本节中，我们将通过使用外部表来模拟数据湖的许多功能，外部表允许在不将数据加载到托管存储层的情况下查询存储在 Amazon S3 中的数据。我们将使用 Apache Iceberg 探索开放表格格式（OTF）表，以考虑可能支持 ACID 事务的表。Amazon 托管的 S3 Tables 将被用来展示 Amazon 如何在 S3 内直接原生支持 Iceberg 兼容的表格管理，在规模上简化湖仓架构。在这些练习中，我们将使用行业标准的 TPC-H 数据集——一个代表具有订单、客户和行项目的真实业务数据模型的基准工作负载——以确保我们的示例既有意义又可重现。

我们将使用 Amazon Athena 进行数据准备。如果你是第一次使用 Amazon Athena，需要创建一个 Amazon S3 存储桶来存储查询结果。Athena 在运行查询之前需要 S3 作为输出位置。请按照 AWS 官方入门指南完成这一次性设置：Amazon Athena 入门指南。或者，你可以使用托管查询结果功能。

**提示**：选择与数据源在同一 AWS 区域的 S3 存储桶，以避免跨区域数据传输成本和延迟。

配置好 S3 输出位置后，你就可以继续操作了。

### 创建 Glue 数据库

首先使用 Athena 创建一个 Glue 数据库，该数据库将作为所有表的元数据目录。在 Athena 查询编辑器中运行以下 SQL：

```sql
CREATE DATABASE IF NOT EXISTS blog_qs_athena_tpc_h_db_sql COMMENT 'TPC-H database'; 
```

![Amazon Athena 查询编辑器界面，显示创建 TPC-H 数据库的 SQL 查询，执行状态显示完成，队列时间 82ms，运行时间 230ms](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-2.png)

图 2：数据库创建 blog_qs_athena_tpc_h_db_sql

此操作的作用：这将在 AWS Glue 数据目录中注册一个逻辑数据库，Athena 使用它来组织和发现你的表。在后续步骤中创建的表将存储在此数据库下。

### 在 S3 上创建外部表

接下来，创建一个指向存储在公开 S3 存储桶中的 TPC-H "customer" 数据集的外部表（`'s3://redshift-downloads/TPC-H/2.18/100GB/customer/'`）。Athena 中的外部表不会移动或复制数据——它们直接从 S3 查询数据，这使其成为探索原始数据的快速且经济高效的方式。

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS blog_qs_athena_tpc_h_db_sql.customer_csv 
( 
	C_CUSTKEY INT, 
	C_NAME STRING, 
	C_ADDRESS STRING, 
	C_NATIONKEY INT, 
	C_PHONE STRING, 
	C_ACCTBAL DOUBLE, 
	C_MKTSEGMENT STRING, 
	C_COMMENT STRING
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY '|'
STORED AS TEXTFILE
LOCATION 's3://redshift-downloads/TPC-H/2.18/100GB/customer/'
TBLPROPERTIES ('classification' = 'csv'); 
```

通过预览几行来验证表：

```sql
SELECT * FROM blog_qs_athena_tpc_h_db_sql.customer_csv LIMIT 10; 
```

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-3.png)

图 3：验证 blog_qs_athena_tpc_h_db_sql.customer_csv

### 创建 Apache Iceberg 表

接下来，我们将使用 Apache Iceberg 模拟该表。Apache Iceberg 是一种开放表格格式，为数据湖带来了 ACID 事务、时间旅行和分区演进——使其成为生产级工作负载的理想选择。这是一个三步流程。

**步骤一：创建 S3 存储桶** — 在编写 SQL 查询之前，先设置存储层。你可以使用 AWS 管理控制台或 AWS CLI 创建 S3 存储桶。

对于本文，我使用 S3 存储桶：`amzn-s3-demo-bucket`

注意：你的存储桶名称会有所不同，因为 S3 存储桶名称在所有 AWS 账户中必须全局唯一。

**步骤二：为订单创建外部 CSV 表** — 首先，将原始订单数据以其原始格式（在我们的案例中是 CSV）注册为外部表。

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS blog_qs_athena_tpc_h_db_sql.orders_csv 
( 
	O_ORDERKEY BIGINT, 
	O_CUSTKEY BIGINT, 
	O_ORDERSTATUS STRING, 
	O_TOTALPRICE DOUBLE, 
	O_ORDERDATE STRING, 
	O_ORDERPRIORITY STRING, 
	O_CLERK STRING, 
	O_SHIPPRIORITY INT, 
	O_COMMENT STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe'
WITH SERDEPROPERTIES ('field.delim' = '|')
LOCATION 's3://redshift-downloads/TPC-H/2.18/100GB/orders/'
TBLPROPERTIES ('classification' = 'csv');
```

让我们验证数据集：

```sql
SELECT * FROM blog_qs_athena_tpc_h_db_sql.orders_csv LIMIT 10;
```

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-4.png)

图 4：验证 blog_qs_athena_tpc_h_db_sql.orders_csv

**步骤三：使用 CREATE TABLE AS SELECT（CTAS）创建 Iceberg 表** — 使用 CREATE TABLE AS SELECT（CTAS）创建以 Parquet 格式按订单日期分区的自管理 Iceberg 表。我们将加载一个示例日期范围 `O_ORDERDATE BETWEEN '1998-06-01' AND '1998-12-31'`。

```sql
CREATE TABLE blog_qs_athena_tpc_h_db_sql.orders_iceberg
WITH ( 
	table_type = 'ICEBERG', 
	format = 'PARQUET', 
	is_external = false, 
	partitioning = ARRAY['o_orderdate'], 
	location = 's3://amzn-s3-demo-bucket/tpch_iceberg/orders/')
AS
SELECT * FROM blog_qs_athena_tpc_h_db_sql.orders_csv
WHERE O_ORDERDATE BETWEEN '1998-06-01' AND '1998-12-31';
```

验证 Iceberg 表数据：

```sql
SELECT * FROM blog_qs_athena_tpc_h_db_sql.orders_iceberg LIMIT 10; 
```

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-5.png)

图 5：验证 blog_qs_athena_tpc_h_db_sql.orders_iceberg

### 创建 Amazon S3 Table

Amazon S3 Tables 是专门构建的、完全托管的表，内置 Apache Iceberg 支持。它提供高性能查询吞吐量，而无需管理压缩、快照管理和未引用文件删除等维护操作。这是一个三步流程。

**步骤一：创建 S3 Table 存储桶和命名空间** — 在 AWS 控制台中导航至 S3 → Table Buckets，创建存储桶 `blog-qs-athena-tpc-h-db-sql-s3-table-mar-3` 和命名空间。或者，使用 AWS CLI 进行脚本化设置。

注意：如果你已有可用的 S3 table 存储桶和命名空间，可以忽略这些步骤。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-6.png)

图 6：创建 S3 Table 存储桶 blog-qs-athena-tpc-h-db-sql-s3-table-mar-3

现在让我们通过点击 `blog-qs-athena-tpc-h-db-sql-s3-table-mar-3` 创建与上述 S3 table 存储桶关联的命名空间 `blog_qs_athena_tpc_h_namespace`。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-7.png)

图 7：创建 S3 table 命名空间 blog_qs_athena_tpc_h_namespace

**步骤二：为行项目创建外部 CSV 表** — 使用 Athena 将 TPC-H 行项目数据集注册为外部表：

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS blog_qs_athena_tpc_h_db_sql.lineitem_csv 
( 
	L_ORDERKEY BIGINT, 
	L_PARTKEY BIGINT, 
	L_SUPPKEY BIGINT, 
	L_LINENUMBER INT, 
	L_QUANTITY DECIMAL(15,2), 
	L_EXTENDEDPRICE DECIMAL(15,2), 
	L_DISCOUNT DECIMAL(15,2), 
	L_TAX DECIMAL(15,2), 
	L_RETURNFLAG STRING, 
	L_LINESTATUS STRING, 
	L_SHIPDATE STRING, 
	L_COMMITDATE STRING, 
	L_RECEIPTDATE STRING, 
	L_SHIPINSTRUCT STRING, 
	L_SHIPMODE STRING, 
	L_COMMENT STRING
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY '|'
STORED AS TEXTFILE
LOCATION 's3://redshift-downloads/TPC-H/2.18/100GB/lineitem/'
TBLPROPERTIES ('skip.header.line.count' = '0');
```

预览数据：

```sql
SELECT * FROM blog_qs_athena_tpc_h_db_sql.lineitem_csv LIMIT 10;
```

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-8.png)

图 8：验证数据 blog_qs_athena_tpc_h_db_sql.lineitem_csv

**步骤三：使用 CTAS 创建 S3 Tables 表** — 最后，使用 CTAS 在你的新目录中创建以 Parquet 格式存储的 S3 Tables。我们根据 `CAST(L_SHIPDATE AS DATE) BETWEEN DATE('1998-06-01') AND DATE('1998-12-31')` 筛选一个示例日期范围来限制初始数据加载。

注意：请确保使用 s3tablescatalog 运行以下查询，如下图所示。

```sql
CREATE TABLE lineitem_csv_s3_table
WITH ( format = 'PARQUET')
AS
SELECT * FROM AwsDataCatalog.blog_qs_athena_tpc_h_db_sql.lineitem_csv
WHERE CAST(L_SHIPDATE AS DATE) BETWEEN DATE('1998-06-01') AND DATE('1998-12-31');
```

验证结果：

```sql
SELECT * FROM lineitem_csv_s3_table LIMIT 10;
```

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-9.png)

图 9：验证数据 lineitem_csv_s3_table

## 在 Amazon Quick 中准备数据集

你的 Athena 表已注册且可查询。现在是时候将数据引入 Amazon Quick 了——连接它、整理它，并让它说你业务的语言。本节将介绍每个步骤：连接到 Athena 数据源、创建数据集并将其导入 SPICE、连接三个 SPICE 数据集、配置用于自然语言问答的 Quick Topic、使用 Amazon Q 构建和发布仪表盘，以及设置为 Agentic 层提供支持的知识库。

### 数据源创建

在 Amazon Quick 可以查询你的数据湖中的三张表之前，你需要创建一个 Athena 数据源连接。你可以使用同一连接访问全部三张表——CSV 外部表、自管理 Iceberg Parquet 表和 S3 Tables 托管 Iceberg 表——因为所有三张表都已在 AWS Glue 数据目录中编目，并且可通过同一 Athena 工作组访问。

**步骤：**

1. 在 Amazon Quick 中，导航至数据集 → 数据源 → 创建数据源。
2. 选择 Amazon Athena 作为数据源类型。
3. 输入一个描述性名称（例如 `tpch-lakehouse-athena`）。
4. 选择你的团队用于生产查询的 Athena 工作组。使用专用工作组可以执行查询成本控制，并将 Quick 查询流量与其他工作负载分开。
5. 选择验证连接。Quick 将确认它可以访问 Athena 和 Glue 数据目录。
6. 选择创建数据源。

### 数据集创建和 SPICE 摄入

创建好 Athena 数据源后，为每张表创建一个 Quick 数据集。将每个数据集导入 SPICE——Quick 的超快速并行内存计算引擎——无论底层 S3 数据增长到多大，都能在仪表盘和 Agentic 工作流中提供亚秒级查询性能。

#### Lake Formation 权限

在创建数据集之前，请确保已设置适当的数据访问权限：

- **如果未启用 Lake Formation**：权限通过 Quick 服务角色级别的标准基于 IAM 的 S3 访问控制进行管理。请确保 Quick 服务角色（例如 `aws-quicksight-service-role-v0`）对相关 S3 存储桶和 Athena 资源具有读取 IAM 权限。不需要额外的 Lake Formation 配置。
- **如果已启用 Lake Formation**：Lake Formation 充当中央授权层，覆盖标准的基于 IAM 的 S3 权限。直接向 Amazon Quick 作者或 IAM 角色授予权限：
  - 打开 AWS Lake Formation 控制台。
  - 选择权限 → 数据权限 → 授予。
  - 选择 SAML 用户和组。
  - 输入 Quick 用户 ARN。
  - 选择命名数据目录资源。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-10.png)

图 10：Lake Formation 权限

  - 选择所需的数据库、表和列。
  - 至少授予 SELECT 权限；为数据集创建添加 DESCRIBE 权限。
  - 对每个需要访问的用户或角色重复操作。

有关分步说明，请参阅"使用 AWS Lake Formation 和 Amazon QuickSight 安全分析数据"以及"通过具有 AWS Lake Formation 权限的 Amazon QuickSight 访问 Amazon S3 Tables"。

对于 S3 Tables，Quick 服务角色还需要额外的 `glue:GetCatalog` 内联策略才能访问非默认的 s3tablescatalog 目录——请参阅"使用 Amazon QuickSight 可视化 S3 table 数据"以获取确切的策略语句。

#### 数据集 1 — CSV 外部表（customer_csv）

1. 从 Athena 数据源中，选择创建数据集。
2. 选择 Glue 数据库并选择表（例如 `customer_csv`）。
3. 选择编辑/预览数据，打开数据准备体验。
4. 验证列数据类型并根据需要进行更改。注意：如果你使用新的数据准备体验，请点击预览选项卡在继续之前查看数据。
5. 将查询模式设置为 SPICE。
6. 将数据集命名为 `TPC-H Customer (CSV)` 并选择保存并发布。

#### 数据集 2 — 自管理 Iceberg Parquet（orders_iceberg）

1. 从同一 Athena 数据源中，选择创建数据集。
2. 选择 Glue 数据库并选择表（例如 `orders_iceberg`）。
3. 选择编辑/预览数据，打开数据准备体验。
4. 验证列数据类型并根据需要进行更改。注意：如果你使用新的数据准备体验，请点击预览选项卡在继续之前查看数据。
5. 将查询模式设置为 SPICE。
6. 将数据集命名为 `TPC-H Orders (Iceberg)` 并选择保存并发布。

#### 数据集 3 — S3 Tables 托管 Iceberg（lineitem_csv_s3_table）

S3 Tables 存储在非默认的 AWS Glue 目录（`s3tablescatalog`）中，而不是标准的 AWSDataCatalog 中。因此，Quick 可视化表浏览器无法显示 S3 Tables——它们不会出现在"选择你的表"面板中。你必须使用自定义 SQL 来查询 S3 Tables 数据并从中创建 Quick 数据集。

1. 从同一 Athena 数据源中，选择创建数据集。
2. 选择使用自定义 SQL。
3. 选择编辑/预览数据，打开数据准备体验。
4. 使用 `"s3tablescatalog/<table-bucket-name>"."<namespace>"."<table-name>"` 语法输入引用 S3 Tables 目录的 Athena SQL 查询：

```sql
SELECT * FROM "s3tablescatalog/blog-qs-athena-tpc-h-db-sql-s3-table-mar-3"."blog_qs_athena_tpc_h_namespace"."lineitem_csv_s3_table"
```

5. 选择应用。Quick 通过 Athena 执行查询并预览结果集。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-11.png)

图 11：从 Quick 预览 S3 Table 数据

6. 验证列数据类型并根据需要进行更改。
7. 将查询模式设置为 SPICE。
8. 将数据集命名为 `TPC-H Lineitem (S3 Tables)` 并选择保存并发布。

注意：此自定义 SQL 要求专门适用于 S3 Tables，因为它们位于与默认 AWSDataCatalog 分开注册的子 Glue 目录中。标准目录中的 CSV 和 Iceberg 表在表浏览器中可见，不需要自定义 SQL。

## 连接数据集

TPC-H 模式本质上是一个星型模式，Amazon Quick 的可视化数据准备体验支持直接在 UI 中连接数据集。在本解决方案中，我们将在 Athena 中使用自定义 SQL 预连接所有三张表，并将统一结果直接作为单个平面数据集导入 SPICE。这完全消除了 Quick 的辅助表大小限制，并将连接委托给 Athena，Athena 能够处理各种规模的表。

关于跨源 JOIN 限制的说明：如果你的辅助表（`orders_iceberg` + `customer_csv`）合计足够小，可以在 1 GB 以下，你可以在 Quick 的可视化数据准备体验中通过先打开最大的表（将其设为主表），然后将较小的表添加为辅助连接来执行连接。对于 `lineitem` 表占主导地位的大型 TPC-H 规模因子，推荐使用以下 Athena 预连接方法。

**步骤：**

1. 从 Athena 数据源中，选择创建数据集。
2. 选择使用自定义 SQL。
3. 选择编辑/预览数据，打开数据准备体验。
4. 输入以下 Athena SQL 查询，该查询跨默认 Glue 目录（`blog_qs_athena_tpc_h_db_sql`）和 S3 Tables 非默认目录（`s3tablescatalog`）连接所有三张表：

```sql
SELECT 
	c.c_custkey, 
	c.c_name, 
	c.c_mktsegment, 
	c.c_nationkey, 
	o.o_orderkey, 
	o.o_orderdate, 
	o.o_orderstatus, 
	o.o_totalprice, 
	o.o_orderpriority, 
	l.l_linenumber, 
	l.l_partkey, 
	l.l_suppkey, 
	l.l_quantity, 
	l.l_extendedprice, 
	l.l_discount, 
	l.l_shipmode, 
	l.l_returnflag
FROM "s3tablescatalog/blog-qs-athena-tpc-h-db-sql-s3-table-mar-3"."blog_qs_athena_tpc_h_namespace"."lineitem_csv_s3_table" l
INNER JOIN "blog_qs_athena_tpc_h_db_sql"."orders_iceberg" o 
	ON l.l_orderkey = o.o_orderkey
INNER JOIN "blog_qs_athena_tpc_h_db_sql"."customer_csv" c 
	ON o.o_custkey = c.c_custkey; 
```

该查询使用 TPC-H 外键关系连接三张表：

- `lineitem_csv_s3_table.l_orderkey = orders_iceberg.o_orderkey`（行项目 → 订单）
- `orders_iceberg.o_custkey = customer_csv.c_custkey`（订单 → 客户）

**提示**：在 Athena SQL 中对数据库名和表名使用显式双引号——这有助于防止由于标识符名称中的连字符或其他特殊字符（特别是 S3 Tables 目录路径中的字符）导致的解析错误。

5. 选择应用。Quick 通过 Athena 执行查询并预览统一的结果集。
6. 验证列数据类型并根据需要进行更改。隐藏业务用户在仪表盘或问答中不需要看到的内部键列（`c_custkey`、`o_custkey`、`o_orderkey`、`l_orderkey`）。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-12.png)
图 12：从 Quick 预览去规范化数据

7. 将查询模式设置为 SPICE。
8. 将数据集命名为 `TPC-H Unified (Joined)` 并选择保存并发布，等待 SPICE 数据集状态变为"就绪"（预计时间 2-3 分钟）。

连接后的数据集现在是一个单一的去规范化 SPICE 数据集，将客户、订单和行项目数据跨所有三种表格格式（CSV 外部、自管理 Iceberg Parquet 和 S3 Tables 托管 Iceberg）组合在一起，为仪表盘创作和自然语言问答做好准备。

## Quick Topic 配置

Quick Topic 是将列名翻译为业务概念的语义层。当用户询问"上季度按客户细分的总收入是多少？"时，Topic 将 `revenue` 映射到 `l_extendedprice`，"上季度"映射到 `o_orderdate` 上的日期过滤器，`customer segment` 映射到 `c_mktsegment`。没有配置良好的 Topic，自然语言查询返回的结果会是通用的或不正确的。有了它，它们就能在几秒钟内返回精确、有据可查的答案。

**步骤：**

1. 在 Amazon Quick 中，导航至主题 → 创建主题。
2. 输入名称 `TPC-H Analytics` 和纯语言描述："来自 TPC-H 基准数据集的客户、订单和行项目数据，涵盖收入、定价、折扣、订单状态和客户市场细分。"
3. 选择 `TPC-H Unified (Joined)` 数据集作为数据源。
4. Quick 分析数据集并自动生成字段配置（预计完成时间 8-10 分钟）。在数据选项卡上审查每个字段：

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-13.png)
图 13：Quick Topic 增强

5. 为常见业务分组添加命名实体。
6. 添加建议问题以引导初次使用者：
   - "今年按订单状态的总收入是多少？"
   - "上季度哪些客户细分下的订单最多？"
   - "显示上个月总价最高的前 10 笔订单。"

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-14.png)
图 14：Quick Topic 建议问题

## 使用 Amazon Q 构建和发布仪表盘

Amazon Quick 中的 Amazon Q 允许作者使用自然语言构建仪表盘——描述你想要的可视化效果，Q 就会生成它。这将仪表盘开发时间从数天压缩到数分钟，并使重心从图表配置转移到业务故事讲述。

**步骤：**

1. 在 Amazon Quick 中，导航至分析 → 创建分析。
2. 选择 `TPC-H Unified (Joined)` 数据集。
3. 打开 Amazon Q 面板。
4. 使用自然语言提示构建每个可视化并添加到分析：
   - "显示总收入的 KPI 卡片。"
   - "添加一个按订单状态显示扩展收入的条形图。"
   - "创建一个按客户细分显示折扣率与扩展收入的散点图。"
5. 对于每个生成的可视化，审查字段映射并调整标题、轴标签和颜色编码以符合你组织的样式指南。
6. 在 `o_orderdate` 上添加过滤器控件，使仪表盘查看者可以将数据范围限定在他们选择的时间范围内，而无需请求新报告。
7. 点击管理问答，选择单选按钮并选择 `TPC-H Analytics` 主题以启用仪表盘问答。这将自然语言查询栏直接嵌入已发布的仪表盘中，允许查看者在不离开仪表盘的情况下提出后续问题。Quick 自动从仪表盘可视化内容中提取语义信息来支持问答体验。
8. 选择发布，将其命名为 `TPC-H Lakehouse Analytics`。
9. 可选地，Quick 允许共享仪表盘。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-15.png)

图 15：共享仪表盘

## 与 Amazon Quick 的 Agentic AI 集成

你的 SPICE 数据集已加载，Topic 已发布，仪表盘已上线。这些单独都有价值。而统一在 Quick Space 内部，通过自定义聊天 Agent 和索引知识库呈现，它们将成为质的不同：一个能够回答问题、检索上下文并推动行动的 Agentic AI 系统——所有这些都来自单一对话界面。

### 知识库配置

知识库使聊天 Agent 能够访问结构化数据单独无法回答的非结构化上下文——数据字典、模式文档、业务规则和领域参考资料。对于本解决方案，知识库由 TPC-H 非结构化数据构建：官方 TPC-H 规范文档，描述你的组织如何将 TPC-H 字段映射到业务概念。

**步骤：**

1. 在 Amazon Quick 中，导航至集成 → 知识库 → 网络爬虫。
2. 添加 TPC-H 规范（PDF）文档内容 URL：https://www.tpc.org/tpc_documents_current_versions/pdf/tpc-h_v2.17.1.pdf。
3. 将知识库命名为 `TPC-H Reference Knowledge Base`。
4. 选择创建。

Quick 索引文档，使聊天 Agent 在查询时可以搜索它。Agent 检索相关段落——而非整个文档——因此响应保持有根据且简洁。

**最佳实践**：保持每个文档专注于单一主题。一本 5 页的数据字典对 Agent 比一本 200 页的综合规范更有用，因为 Agent 按相关性检索——更小、更专注的文档产生更精确的检索结果。

### Space 创建

Quick Space 是将你的数据资产——主题、知识库、仪表盘和数据集——抽象为单一治理上下文边界的组织层。你在下一步构建的聊天 Agent 不直接查询主题和知识库，而是查询 Space。这种设计为你提供了一个管理 Agent 所知内容、谁可以访问它以及它被允许呈现什么的单一位置。

**步骤：**

1. 在 Amazon Quick 中，导航至 Spaces → 创建 Space。
2. 将 Space 命名为 `TPC-H Lakehouse Analytics Space`。
3. 向 Space 添加资源：

**添加主题：**
- 选择添加知识 → 主题。
- 选择 `TPC-H Analytics`（在 Quick Topic 配置部分中配置的主题）。
- Agent 现在可以通过 Space 查询主题来回答结构化数据问题——收入、订单、客户细分。

**添加知识库：**
- 选择添加知识 → 知识库。
- 选择 `TPC-H Reference Knowledge Base`（在知识库配置部分中配置的知识库）。
- Agent 现在可以从 TPC-H 规范文档中检索非结构化上下文——包括所有 22 个基准查询的业务意图、查询定义和概念数据模型。当用户询问"TPC-H 查询 3 旨在衡量什么？"或"TPC-H 规范对订单优先级有何说明？"时，Agent 从规范中检索相关段落并在响应中引用它。

**添加仪表盘：**
- 选择添加知识 → 仪表盘。
- 选择 `TPC-H Lakehouse Analytics`（在使用 Amazon Q 构建和发布仪表盘部分中配置的仪表盘）。
- Agent 可以引用仪表盘可视化内容，并在回答问题时将用户引导至特定视图。

Space 现在封装了聊天 Agent 所需的一切：通过主题访问结构化数据，通过知识库访问非结构化上下文，以及通过仪表盘访问可视化参考。Agent 查询 Space；Space 执行边界。Quick 对 Space 内底层知识执行相同的安全规则——Space 中的用户只能看到其角色允许的数据，无论他们如何提问。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-16.png)
图 16：Space 中的工件

### 自定义聊天 Agent 创建

聊天 Agent 是你的业务用户与之交互的界面。它不是通用助手——它是一个专门构建的、受治理的 AI 团队成员，其范围限定在 `TPC-H Lakehouse Analytics Space` 内。用户用普通英语提问。Agent 在 Space 上进行推理，检索结构化数据和非结构化上下文的正确组合，并返回有根据、有引用的答案。

**步骤：**

1. 在 Amazon Quick 中，导航至聊天 Agent → 创建聊天 Agent。
2. 用普通语言编写角色说明：

"你是 [你的组织] 的 TPC-H 分析 Agent。你帮助业务分析师和数据工程师使用 TPC-H 湖仓数据集回答关于订单收入、供应商绩效、行项目定价和库存可用性的问题。始终将你的答案建立在 TPC-H 湖仓分析 Space 的数据基础上。当用户提出需要图表或表格的问题时，从 Topic 检索答案并清晰呈现。当用户询问模式定义、查询逻辑或数据字典术语时，从知识库检索答案。不要推测。如果找不到有根据的答案，请如实说明并建议后续问题。"

3. 输入名称：`TPC-H Analytics Agent`。
4. 附加 Space：Quick 可以识别并附加 `TPC-H Lakehouse Analytics Space`。或者，你可以通过以下步骤添加 Space：
   - 在知识源下，选择链接 Space。
   - 选择 `TPC-H Lakehouse Analytics Space`。
   - Agent 现在通过 Space 访问主题、知识库和仪表盘——不需要直接连接数据集。
5. 配置自定义选项：
   - **欢迎消息**：添加用户首次打开聊天 Agent 时出现的自定义问候语（例如，"你好！我是你的 TPC-H 分析 Agent。可以问我关于订单收入、客户细分或行项目定价的问题。"）
   - **建议提示**：添加 3-5 个初始问题，引导用户了解 Agent 能回答什么（例如，"上季度总收入是多少？"、"显示按订单量排名的前几位客户"、"解释运输优先级查询"）
   - 这些自定义选项帮助用户立即了解 Agent 的能力，并降低首次交互的学习曲线。
6. 在发布之前，使用配置页面右侧的内置预览面板预览和测试 Agent。用跨越两个数据源的问题进行测试：
   - "上季度已完成订单的总收入是多少？"——从 Topic 和仪表盘（结构化数据）检索。
   - "l_shipmode 字段代表什么？"——从知识库（TPC-H 规范）检索。
   - "显示按订单量排名前 5 的客户细分。"——从 Topic 检索并返回排名结果。
   - "运输优先级查询回答了什么业务问题？"——从知识库中 TPC-H 规范第 2.4.3 节检索。
7. 选择启动聊天 Agent 以保存并发布更改。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/09/ML-20574-image-17.png)
图 17：与 Agent 交互

### 用户体验

业务分析师打开 TPC-H 分析 Agent 并输入：

"上个月哪个客户细分的收入最高？TPC-H 模式中的'市场细分'是什么意思？"

Agent 的处理过程：

1. 通过 Space 查询 `TPC-H Analytics` 主题，获取上个月按 `c_mktsegment` 筛选的收入——从 SPICE 返回排名结果。
2. 同时从知识库中的 TPC-H 数据字典检索 `c_mktsegment` 的定义。
3. 返回单一、统一的答案：带有 SPICE 数据集引用的排名收入结果，后跟带有规范文档引用的模式定义。

无需 SQL。无需仪表盘导航。无需向数据团队提交工单。答案在一个响应中到达，基于两个来源，每个声明都可追溯到其来源。

## 清理

按照以下步骤删除本文创建的工件。

### 湖仓/数据湖工件

通过 Athena 控制台运行以下步骤。

#### 删除表

```sql
DROP TABLE blog_qs_athena_tpc_h_db_sql.customer_csv;
DROP TABLE blog_qs_athena_tpc_h_db_sql.orders_csv;
DROP TABLE blog_qs_athena_tpc_h_db_sql.orders_iceberg;
DROP TABLE blog_qs_athena_tpc_h_db_sql.lineitem_csv;
DROP TABLE lineitem_csv_s3_table; --(使用 S3 目录配置) 
```

#### 删除数据库

```sql
DROP DATABASE blog_qs_athena_tpc_h_db_sql; 
```

#### 删除 S3 Table 存储桶

- 要删除 `lineitem_csv_s3_table` 表，请使用 AWS CLI、AWS SDK 或 Amazon S3 REST API。
- 要删除命名空间 `blog_qs_athena_tpc_h_namespace`，请使用 AWS CLI、AWS SDK 或 Amazon S3 REST API。
- 要删除 `blog-qs-athena-tpc-h-db-sql-s3-table-mar-3` table 存储桶，请使用 AWS CLI、AWS SDK 或 Amazon S3 REST API。

#### 删除 S3 存储桶

使用 S3 控制台删除 S3 存储桶 `amzn-s3-demo-bucket`。

### Quick 工件

#### 删除自定义聊天 Agent

1. 在 Amazon Quick 中，导航至 Agent。
2. 选择 `TPC-H Analytics Agent` 并选择删除。
3. 确认删除。

#### 删除 Space

1. 导航至 Spaces。
2. 选择 `TPC-H Lakehouse Analytics Space` 并选择删除。
3. 确认删除。这将删除 Space，但不删除底层的主题、知识库或仪表盘——这些必须单独删除。

#### 删除仪表盘

1. 导航至仪表盘。
2. 选择 `TPC-H Lakehouse Analytics` 并选择删除。
3. 确认删除。

#### 删除主题

1. 导航至主题。
2. 选择 `TPC-H Analytics` 并选择删除。
3. 确认删除。

#### 删除知识库

1. 导航至集成 → 知识库。
2. 选择 `TPC-H Reference Knowledge Base` 并选择删除知识库。
3. 确认删除。这将删除知识库和已索引的文档。

#### 删除数据集

1. 导航至数据集。
2. 选择以下每个数据集并选择删除：
   - `TPC-H Unified (Joined)`
   - `TPC-H Customer (CSV)`
   - `TPC-H Orders (Iceberg)`
   - `TPC-H Lineitem (S3 Tables)`
3. 确认每次删除。这将删除 SPICE 数据并释放相关的 SPICE 容量。

#### 删除数据源

1. 导航至数据集 → 数据源。
2. 选择 `tpch-lakehouse-athena` 并选择删除。
3. 确认删除。

## 结论

本架构展示了 Amazon Quick 的 Agentic AI 如何将企业数据分析从技术瓶颈转变为可访问的自助服务能力。通过将 Amazon S3、AWS Glue 数据目录、Amazon Athena 和 Amazon Lake Formation 与 Amazon Quick 的对话式 AI agent 和仪表盘集成，业务用户现在可以通过自然语言界面查询复杂的湖仓数据，而无需 SQL 或 BI 专业知识。该解决方案跨多种存储格式（S3 Table、Iceberg、Parquet）无缝组合结构化 TPC-H 数据集与知识库中的非结构化数据，实现更丰富的上下文洞察。数据访问的这种民主化在保持企业级安全性、治理和现代数据驱动组织可扩展性的同时，加速了各行业的决策制定。

## 后续步骤

参考入门教程了解使用 B2B、收入、销售、市场营销和人力资源数据集的其他用例。要深入了解 Lake Formation 与 Quick 的权限，请参考 AWS 文档"将 AWS Lake Formation 与 Quick 结合使用"以及博客文章"使用 AWS Lake Formation 和 Amazon QuickSight 安全分析数据"。加入 Amazon Quick 社区，查找问题答案、学习资源和当地活动。

以下是供进一步阅读的链接：

- 使用 Amazon Quick 现代化商业智能工作负载
- Amazon QuickSight SPICE 和直接查询模式的最佳实践
- 通过具有 AWS Lake Formation 权限的 Amazon QuickSight 访问 Amazon S3 Tables 以及 Quick 中的 AWS 安全性

## 引用

- 原文：[Unleashing Agentic AI Analytics on Amazon SageMaker with Amazon Athena and Amazon Quick](https://aws.amazon.com/blogs/machine-learning/unleashing-agentic-ai-analytics-on-amazon-sagemaker-with-amazon-athena-and-amazon-quick/)
