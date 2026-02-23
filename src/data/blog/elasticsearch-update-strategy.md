---
title: Elasticsearch--更新策略
pubDatetime: 2014-11-25T00:00:00+08:00
description: Elasticsearch--更新策略
slug: elasticsearch-update-strategy
---
[前一篇](/blogs/2014/11/24/elasticsearch-mapping.html)文章介绍了如何在Elasticsearch上做动态映射，这篇文章会介绍下如何更有效的做ES的数据更新。

### 更新频率
如果把ES看做另一个数据库，那么它总是会比系统原有的数据库滞后，因为数据会先存入原有数据库，再同步到ES。那么滞后的时间就是一个敏感的参数。根据业务的不同，差别很大。我了解到有的系统可以接受10分钟以上的延迟，不过我们作为一个数据平台，用户提交或修改数据后，是希望能立刻查询到修改的结果的，所以理论上是越短越好，但频繁的更新会给ES服务器带来很大的[开销](https://www.found.no/foundation/keeping-elasticsearch-in-sync/#the-problems-of-too-frequent-updates-and-non-batch-updates)。

### 异步更新
更新可以采用同步和异步两种方式。

* 同步：
使用elasticsearch-rails这个gem中的[Automatic-Callback](https://github.com/elasticsearch/elasticsearch-rails/tree/master/elasticsearch-model#automatic-callbacks)
，在inlcude```Elasticsearch::Model::Callbacks```后，实际上就是在每一次数据增删改后使用callback来往ES发送请求。

* 异步：
采用[Asynchronous-Callback](https://github.com/elasticsearch/elasticsearch-rails/tree/master/elasticsearch-model#asynchronous-callbacks)的方式，将每一次的更新放入队列。

同步的缺点是显而易见的，因为需要进行一次http请求与外部的服务器相连，影响原有的操作效率。特别是与ES的链接有问题时，会直接Timeout异常。因此在产品环境中一定要使用异步更新，它不仅规避了效率和稳定性问题，也让我们有了更大的灵活性在更新之前做更多的数据处理工作，例如后面要提到的数据聚合。


### 聚合，使用Bulk API
针对每一条数据的增删改就做一个更新，虽然是异步，但是在ES这边，是低效的，而且像我们这样每秒都有很多数据变化的系统是不现实的（实际上第一次上线时就采用这种方式，导致ES的CPU和内存急剧增加）。幸运的是，ES提供了Bulk API，并且也推荐使用它来进行[批量的更新](http://www.elasticsearch.org/guide/en/elasticsearch/guide/current/bulk.html#bulk)。一个简单的批量的请求体如下，它可以同时包含增删改操作，并且可以是多条。

```json
{ "delete": { "_index": "website", "_type": "blog", "_id": "123" }} 
{ "create": { "_index": "website", "_type": "blog", "_id": "123" }}
{ "title":    "My first blog post" }
{ "index":  { "_index": "website", "_type": "blog" }}
{ "title":    "My second blog post" }
{ "update": { "_index": "website", "_type": "blog", "_id": "123", "_retry_on_conflict" : 3} }
{ "doc" : {"title" : "My updated blog post"} } 
```
我们的更新策略是：

* 在一次更新时间内，将对数据的三种操作分别加入三个sidekiq队列，index, update和delete。
* 如果一次更新内，三个队列的优先级不同，例如如果一个数据同时在update队列和delete队列里，那么就从delete队列删除，这表示用户先更新了数据，然后又删除了，就只需要对ES做一个删除操作

### 错误处理
当sidekiq开始处理某些数据后，为了防止其它的sidekiq worker也去处理，需要将redis中对应数据暂时删除。但是如果因为某种原因出错，则还需要将这条数据重新加入队列中，以此来实现重试操作。
需要注意的是，批量操作时，ES会将所有的数据更新状态都返回，系统需要根据是否出现error来从返回的结果中提取出错的数据，仅仅将这些数据重新加入队列，而不要简单的将所有数据都重新加回，增加负载。

下面的文章介绍了更多信息
[https://www.found.no/foundation/keeping-elasticsearch-in-sync](https://www.found.no/foundation/keeping-elasticsearch-in-sync/)
