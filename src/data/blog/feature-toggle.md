---
title: Feature Toggle
pubDatetime: 2012-01-29T00:00:00+08:00
description: Feature Toggle
slug: feature-toggle
category: 技术
tags:
  - Feature Toggle
---
每个迭代(两周)发布一次，所有功能必须完整可用。这对项目的计划，story的划分都提出了很高的要求。然而有的功能很难在一个迭代内完成，例如某个story在临近迭代结束的时候开始，或者某个系统的某个特性需要持续若干迭代的开发， 在整体完成之前不能出现在产品中。那么如何控制未完成的功能不出现在产品中而又不影响新的代码开发呢？这时就需要引入Feature Toggle。

在Rails中Feature Toggle可以分为三个部分：

* 定位配置文件：比如toggle的名称，开关属性，使用环境等，下面的文件中表示有个show_user_name的feature，只在qa和staging环境中打开

    ```xml
    show_user_name:
      switch: on
      when: [qa,staging]</pre>
    ```
* 实现解析配置文件的Ruby文件：这个文件最主要是在Object对象上实现一个方法，用于判断配置文件中定义的标志位的状态。

  ```ruby
    class Object
      def show_feature? feature_name
        feature_toggle.active? feature_name
      end
      ...
    end
  ```

* 使用：调用show_feature?方法，并传入toggle的名称，以此来控制是否执行相关代码。

从使用角度来说，并没有多大的难度，但下面两点必须要注意，否则会有很大的可能产生问题：

* Feature Toggle的应只针对尚未完成的功能，而不是作为选择功能的控制器。
功能完成之后，就立刻删除与该feature相关的所有控制代码。特别要摒弃的思想是保留已经完成的功能，但是把该功能关掉，以备将来使用。这完全可以从源码控制工具中轻松得到，而一旦保留在代码中，就需要增加额外的维护成本。
* 测试。
对使用Feature Toggle的每个功能都需要测试打开与关闭两种场景，因为两种条件下可能都会对其他功能产生影响。我们的项目中曾出现过一个功能完成之后，就一直关闭，很长时间以后在产品环境中打开，因为觉得那个功能对其他都没有影响，但是却导致了系统异常。

Feature Toggle是实现持续发布的重要手段，但当控制的条件较多时，就一定是什么地方出了问题，好用但不能滥用。

下面的文章有有更加深入的解释：[http://martinfowler.com/bliki/FeatureToggle.html](http://martinfowler.com/bliki/FeatureToggle.html)