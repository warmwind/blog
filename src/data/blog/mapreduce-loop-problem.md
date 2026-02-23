---
title: "! 'MapReduce: 一个i和1导致的悲剧'"
pubDatetime: 2012-11-26T00:00:00+08:00
description: "! 'MapReduce: 一个i和1导致的悲剧'"
slug: mapreduce-loop-problem
category: 技术
tags:
  - MapReduce
  - MongoDB
---
听说MapReduce已经很久了，这两天才第一次真正的尝试一下。要说的是因为一个很简单的错误，折腾了好一会儿，刚好让我有了更多的理解。因祸得福吧。

要实现的是一个很简单的功能，统计每一天新增的数据的数量，以天为单位，数据库中的created_at字段存储是以秒为单位的。考虑到将来这样的数据可能会非常大，所以使用MapReduce就成了自然的选择。

我使用的是mongodb,最开始的代码如下：

```ruby
def map
  <<-MAP
function() {
  d = new Date(this.created_at.getFullYear(), this.created_at.getMonth(), this.created_at.getDate());
  d.setSeconds(#{Time.zone.utc_offset});
  emit(d, 1);
}
  MAP
end

def reduce
  <<-REDUCE
function(key, values) {
  var result = 0;
  for (i in values) {
    result += i;
    }
  return result;
}
  REDUCE
end
```
这是从网上一个地方找的例子。MapReduce的原理就是首先根据给定的条件做group操作，然后根据聚合后的每个小单元进一步操作。最后会得到一个hash的数组，{"_id" => key, "value" => value},其中的key就是map操作时emit操作的第一个参数， value是从reduce操作中的返回值。

这段代码看似正确，先在map中将数据库中的时间戳字段映射到每一天，在reduce中取出已经被map过的值，循环加一即可，因为这里只是关心数量，而没有其他的运算，甚至可以将那个for循环替换为 return values.length都可以。

事实证明，在小数据量时，这个结果是正确的，所以我的测试通过了，但是当运行大规模数据时，结果差了很多，几千条数据就有一个数量级的差距，而且毫无规律。

为什么呢？

答案其实就在MongoDB MapReduce的文档中！简单的拷贝过来而不深入思考，这个问题很严重！
>When you run a map/reduce, the <tt>reduce</tt> function will receive an array of emitted values and reduce them to a single value. Because the reduce function might be invoked more than once for the same key, the structure of the object returned by the reduce function must be identical to the structure of the <tt>map</tt> function's emitted value.

也就是说reduce方法是会被多次调用的，所以Map中emit的object需要和Reduce中的返回值结构一致，这样当被多次调用的时候，结果才会被merge在一起。在加入一些调试信息可以发现，*map和reduce都是会被多次调用的，而且并不是map完毕之后才调用reduce，两者是交互进行的*。

回头再看前面那段代码，如果将1换成i其实就是正确的，可能误操作将i改成了1，并且自己想当然的给了一个解释才导致了这个小悲剧的发生。

思考，理解，不能想当然！  

[http://www.mongodb.org/display/DOCS/MapReduce](http://www.mongodb.org/display/DOCS/MapReduce)