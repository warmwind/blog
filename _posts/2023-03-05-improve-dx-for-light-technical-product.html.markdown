---
title: 如何提升轻技术产品的DX（Developer Experience）
date: 2023-03-05
tags: 
- DX
- 创业
category: 创业
---

> 开发者体验（Developer Experience，DX）指的是软件开发人员在使用某个产品或服务创建软件应用程序时的整体体验，也可理解为UX of Developer。
> 

技术型产品的DX包含文档、工具、API、社区、性能、安全等众多方面，例如文档，下面几个方面都非常重要：

- 清晰的结构
- 良好的搜索
- 充足的样例
- 可快速体验的的demo
- 展示设计理念与内部原理

特别想强调下最后一点，要善于利用开发人员理性，将其带入产品内部，这会最大化产品的最佳实践与价值。

以OLAP数据库CH（ClickHouse）为例，其关于[index](https://clickhouse.com/docs/en/guides/improving-query-performance/sparse-primary-indexes/sparse-primary-indexes-design)的设计理念详细介绍了数据从插入到生成索引到存储方式的内部过程，如下图，

![Untitled](/assets/img/dx-for-light-tech-product/dx-clickhouse.png)

但不得不说，整体上CH文档的DX还是有待提升，搜索不够精确，很多部分的介绍比较简略，这也是为什么会有之前的 [二十四分钟精通ClickHouse Materialized View](https://www.oscarjiang.site/posts/master-clickhouse-mv.html)

与数据库、开发框架等这类完全面向developer的技术型产品不同，面向非技术型用户，但又需要技术人员少量参与的轻技术型产品，则既需要能让开发人员快速理解并接入，也能协助非技术业务用户与开发沟通而不会不知所措，也就是

**💡让产品本身，成为非技术用户与技术人员沟通的工具**

下面简单介绍在[浩客](https://howxm.com)我们的一些思考和实践。

### 明确双方职责，消除彼此顾虑
![Untitled](/assets/img/dx-for-light-tech-product/dx-howxm1.png)


上图来自于浩客[帮助中心](https://howxm.com/help/articles/x-sdk-intro)，告知业务人员和研发人员浩客的核心设计和双方的分工边界，研发人员只需在不同平台配置一次，业务人员便可根据需要进行使用。

同时，双方要统筹考虑各个平台的业务设计和集成方式，以最大化利用浩客平台提供的扩展性和灵活性。

### 让产品代替业务人员与自己团队的开发进行技术沟通

![Untitled](/assets/img/dx-for-light-tech-product/dx-howxm2.png)

上图是创建iOS应用时的说明，业务人员并不需要理解如何去集成，研发人员也不用了解所有前后的细节。可以想象，让业务人员将当前上下文告知研发将是一件多么复杂和痛苦的事情，因此系统提供了供研发查看的版本，会从技术角度说明该如何去做，在哪里查看更细节的帮助等，业务人员一键下载后交于研发即可。

### 让产品代替业务人员与我方开发进行技术沟通

![Untitled](/assets/img/dx-for-light-tech-product/dx-chrome-extension1.png)
![Untitled](/assets/img/dx-for-light-tech-product/dx-chrome-extension2.png)

上图是web sdk的debug log以及服务端请求数据。当业务人员发现问卷的行为与预期不符时，可以启动调试模式，将上面的信息，直接发送给我们。

一般来说，客户端的行为数据是比较难定位的，对方的系统我们也不一定有权限访问。通过这种方式，我们的研发人员便可快速查看现场的运行情况，协助对方业务人员解决问题。对我们自己的DX是巨大的提升。

### 研发无需投入即可让完成业务初步测试
![Untitled](/assets/img/dx-for-light-tech-product/dx-chrome-extension3.png)


**💡DX的终极状态应该就是不用写一行代码**

上面是浩客的Chrome插件[HowXM Tools](https://chrome.google.com/webstore/detail/howxm-tools/anhinnebdhplihakagdjmdpfdhnbnhhk)，它允许业务人员在自己系统没有集成SDK的情况下，体验真实的投放效果，完全无需研发介入。

* 明确双方职责，消除彼此顾虑
* 让产品代替业务人员与自己团队的开发进行技术沟通
* 让产品代替业务人员与我方开发进行技术沟通
* 研发无需投入即可让完成业务初步测试

以上是几个比较典型的思考，轻技术型产品，用户仍然是非技术业务人员，但需要技术给予辅助。提升DX，关键是让产品本身成为业务人员与技术人员沟通的工具，让产品「蜕变」为低门槛非技术型产品，Developer的整体体验在此过程将自然得到提升。