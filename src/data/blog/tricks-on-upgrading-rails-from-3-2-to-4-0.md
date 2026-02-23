---
title: Tricks On Upgrading Rails From 3.2 to 4.0
pubDatetime: 2014-08-26T00:00:00+08:00
description: Tricks On Upgrading Rails From 3.2 to 4.0
slug: tricks-on-upgrading-rails-from-3-2-to-4-0
category: 技术
tags:
  - Rails,Mongoid,Capistrano,Upgrade
---

很久一段时间以来，我们使用的都是Rails3.2 + Mongoid3，虽然Rails4发布已经快一年的时间了，但由于mongoid3不能支持Rails4，所以升级就一推再推，不过终于在近期Mongoid发布4.0以后完成了这次期盼已经的升级。心情是兴奋地，不过过程还是曲折的，不少细节，只看升级文档，或者google，不看源码还是真心不好解决。本文不是升级指导，因已经有很多文章，本文将对这次升级遇到的问题做个简单的介绍，包括了Rails，Mongoid，Capistrano。


每次升级有两个前提必须保证才可以稍微顺利一些：

* 完备的测试
* 通读官方[升级文档](http://edgeguides.rubyonrails.org/upgrading_ruby_on_rails.html)。当然升级基本完成后才发现因为已经有Rails4已经有一年的时间，网上其实有不少可以参考的其他人的文章，中英文都可以，还有好心人翻译了国外的博文。

###Strong Parameters
它主要用来增强mass assignment的安全性，Rails3中通过使用attr\_accessible在model层面进行控制，没有声明为attr_accessible的属性不能用mass assignment来赋值。但通常来说这个赋值的行为发生在controller级别，所以Strong Parameter将这样行为的限制上升在controller，并通过下面的格式来进行限制。

```ruby
params.permit(:name, {:emails => []}, :friends => [ :name, { :family => [ :name ], :hobbies => [] }])
```
这其中定义了三种格式的参数类型，其中期望emails的值为Array的类型，而friends是一组Array的资源，有name属性，family的值为Array并含有name属性，hobbies的值则是Array类型。

###controller测试异常缓慢
我们使用的MiniTest，升级完成后运行controller测试时，非常非常的缓慢。后来发现当测试中request请求成功后，停在了在render layout那这一步，需要将近5分钟才可以完成。测试本身是成功的，而这5分钟也与asset precompile的时间类似。

>Rails 4 no longer sets default config values for Sprockets in test.rb, so test.rb now requires Sprockets configuration. The old defaults in the test environment are: config.assets.compile = true, config.assets.compress = false, config.assets.debug = false and config.assets.digest = false.

其中最主要的设置为

```ruby
# Don't fallback to assets pipeline if a precompiled asset is missed
config.assets.compile = true
```
此项设置的主要目的是当找不到precompiled的asset时是不是需要时时编译。当然，我们是不需要这样的设置的，所以当设置为```false```时就解决了这个问题。

*不过有个问题还是不明白，之前的默认值为```true```是如何正确工作的呢？*

###测试单独通过，rake test失败
使用rake运行所有测试时，抛出

```ruby
TypeError: compared with non class/module
```
无法定位是什么问题，好在有人遇到了一样的问题 [https://github.com/freerange/mocha/issues/199](https://github.com/freerange/mocha/issues/199),不要使用ruby2.0.0-p0，改为2.0.0-p353就好了。

###Capistrano
原先使用的是Capistrano2，由于Capistrano3做了很大的改动，所以为了平稳尽快完成Rails的升级，对Capistrano尽量做到最小的改动,[这篇文章](https://github.com/capistrano/capistrano/wiki/Upgrading-to-Rails-4#asset-pipeline)一定要看。其中两点最重要：

* 升级到2.15.4
* 将manifest.yml从shared/assets目录移到releases，并重命名为assets_manifest.yml，否则部署时会报错说有重复的manifest文件

需要注意的是，升级之后在部署过中可能会看到一些err输出，实际上是Capistrano将info的输出信息作为err打印到console了。参见这里[INFO messages while asset precompiling treated as errors](https://github.com/capistrano/capistrano/issues/625)

###嵌入的支持
Rails4会在response的header里增加一下的默认值，其中```SAMEORIGIN```限定了iframe在同一个domain中可以使用。如果取消这一限制有两种做法，一个是在下面的全局配置中将```X-Frame-Options```改为```ALLOWALL```。当然，如果只想针对单个请求，可以将这个设置在该请求的response中去除```response.headers.except! 'X-Frame-Options'```。

```ruby
config.action_dispatch.default_headers = {
'X-Frame-Options' => 'SAMEORIGIN',
'X-XSS-Protection' => '1; mode=block',
'X-Content-Type-Options' => 'nosniff'
}
```

###Mongid中使用Only后的限制
升级Mongoid4后，使用Only后的model对象将为只读，不可以再修改，否则会抛出下面的异常。检测document是否为只读可以直接在model上调用```readonly?```。在Mongoid3中没有这样的限制

```ruby
Mongoid::Errors::ReadonlyDocument:
Problem:  Attempted to persist the readonly document 'Entry'.
Summary:
  Documents loaded from the database using #only cannot be persisted.
Resolution:
  Donot attempt to persist documents that are flagged as readonly.
```
另外使用only后，如果直接读取没有加载的属性，将抛出异常```ActiveModel::MissingAttributeError: Missing attribute: 'not_load_attr’```。在Mongoid3中返回nil。

下面是一些升级指导的链接

* [http://edgeguides.rubyonrails.org/upgrading_ruby_on_rails.html#upgrading-from-rails-3.2-to-rails-4.0](http://edgeguides.rubyonrails.org/upgrading_ruby_on_rails.html#upgrading-from-rails-3.2-to-rails-4.0)
* [http://www.oschina.net/translate/get-your-app-ready-for-rails-4](http://www.oschina.net/translate/get-your-app-ready-for-rails-4)
* [https://ruby-china.org/topics/15579](https://ruby-china.org/topics/15579)
* [http://www.sitepoint.com/get-your-app-ready-for-rails-4/](http://www.sitepoint.com/get-your-app-ready-for-rails-4/)




