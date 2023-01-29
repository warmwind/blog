---
title: Elasticsearch--动态类型字段的mapping
date: 2014-11-24
tags: [Elasticsearch]
category: 技术
---
[ElasticSearch](http://www.elasticsearch.org/)是一个基于[Lucene](http://lucene.apache.org/core/)构建的搜索引擎，通过RESTful的api可以进行数据的更新与搜索。目前github就是用的ES。

通常来讲，如果是要进行精确的查询，可以直接针对数据库进行，合理的构建index，可以在数据库层面进行快速准确查询。然后在某些场景下，当数据集合的列无法确定时，很难加index，这会导致在数据量增大时性能严重下降。例如当前项目是一个在线表单，采用Mongodb作为数据库。当对表单和数据建模时就存在这样的问题，数据存储的每一列数据是不固定的，依赖于表单中该列字段类型的定义。这样就无法对数据中的列构建index。当对这一列进行排序，过滤时，不得不遍历当前表单下的所有数据。

ES会对所有的字段构建自己的index和存储，这样不仅分散了数据库的访问压力，也避免了数据库缺失index的问题。这篇文章不是介绍如何从零开始使用ES，网上有很多的入门教程，从安装到运行hello world，此文以及后续的几篇文章将用来介绍我们如何更有效的在产品环境中使用ES。

###如何对对动态类型字段如何做mapping

#### 动态类型的问题

Mapping就是一个映射的定义，如何将系统中的数据类型映射到ES内。ES在内部对一个index下的type会根据mapping来进行存储，所以要求type中的每个字段类型必须一致。例如对一个User表，如果有个name字段，那么一条user数据中的name为string了类型的话，后续所有的user对象中的name都必须为string，否则做index时就会出错。

但是在我们的系统中，Form对象存储了每个字段的定义，而数据对象Entry存储字段对应的值，这样不同的entry对象的同一个字段的类型基本上都不相同。例如Form1的第一个字段是文本类型的姓名，Form2的第一个字段可能是Hash类型的地址({province: '陕西省', city: '西安'}),那么Form1下面的Entry的field\_1值类型与Form2下地field\_1值类型就完全不同，这样是无法直接index到ES的。

#### dynamic templates
一个简单的mapping定义如下，它将```tweet```的```message```属性映射为string

```json
{
    "tweet" : {
        "properties" : {
            "message" : {"type" : "string" }
        }
    }
}
```
ES默认支持[多种类型](http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/mapping-types.html)的定义，string, integer, array, object等等。
因为我们系统中字段的类型不是无限多，所以我们采取了在字段后加入类型后缀来区分不同字段的方式来区分entry的不同字段。例如上面的Form1的entry第一个字段就是field\_1\_string，而Form2是field\_2\_hash,再加上ES的dynamic_templates就可以进行动态的定义了，例如下面的映射

```ruby
mappings: {
    entry: {
        date_detection: false,
        dynamic_templates: [
            {
                strings: {
                    match: '.*_string|_c_.*|.*_other',
                    match_pattern: 'regex',
                    match_mapping_type: 'string',
                    mapping: {
                        type: 'string',
                        analyzer: 'ik'
                    }
            },
            {
                dates: {
                    match: '.*_date|.*_datetime|created_at|update_at',
                    match_pattern: 'regex',
                    mapping: {
                        type: 'date'
                    }
                }
            },
            {
                hashes: {
                    match: '*_hash',
                    mapping: {
                        type: 'nested',
                    }
                }
            },
            {
                hash_propeties: {
                    path_match: '*_hash.*',
                    mapping: {
                        type: 'string',
                        index: 'not_analyzed'
                    }
                }
            }
        ]
    }
}
```
这样定以后长生的mapping结果如下，可以看到有两个field\_1的mapping，但是类型不同：

```json
{
  "field_1_string" : {
                  "type": "string",
                  "analyzer": "ik"                  
               },

  "field_1_hash" : {
    "type": "nested",
    "properties": {
       "city": {
          "type": "string",
          "index": "not_analyzed"
       },
       "district": {
          "type": "string",
          "index": "not_analyzed"
       },
       "province": {
          "type": "string",
          "index": "not_analyzed"
       },
       "street": {
          "type": "string",
          "index": "not_analyzed"
       }
    }
}
}
```

几点需要说明的地方

* not\_analyzed: 这个设置告诉ES不要分析这个值，在搜索的时候我会精确匹配这个字段的值，另外它也会加速index
* match\_patten: 以指定使用'regex'，那么```match```条件就会去用正则表达式去匹配field名称，如果未指定，那么match中的*则为ES的通配符
* path_match: mapping中第34行，这可以指定hash中的每个key的mapping类型
* date_detection：JSON本身没有date类型的，ES会尝试将可能的date类型的字符串进行转换，这并不是我们需要的，因为虽然存储的是日期，但类型可能是字符串。因此需要显示的设置为false，然后提供一个template将系统中可能的date类型做mapping即可。

mapping需要谨慎严格的定义，特别是像我们这样对象的数据类型是动态的，因为所有的数据都将根据它来同步，一般来说后续不太可能重新修改，常常需要重新index所有的数据，特别当产品环境的数据量到达千万甚至更多时，做一次完整的index，花费可以有数小时，甚至几天。


下面这篇文章在开发的过程中给了不少思考：
[http://joelabrahamsson.com/dynamic-mappings-and-dates-in-elasticsearch/](http://joelabrahamsson.com/dynamic-mappings-and-dates-in-elasticsearch/)
