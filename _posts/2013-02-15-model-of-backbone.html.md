---
title: Backbone中的Model
category: 技术
tags:
- Backbone
- Javascript
date: 2013-02-15
---
Backobone是一个JavaScript的前端框架，使具有复杂交互的页面实现能更加清晰。其中Model是核心的部分，它主要主要有下面几个方面：

  * 控制着Backbone中View呈现的内容
  * 与Backbone中Collection的交互
  * 承载着校验，数据运算等功能
  * 与服务端交互的桥梁

Backbone代码一个很显著的特点就是看到满篇的this.model，对新手来说理解这里的model到底是什么以及怎么样传递，什么时候要toJSON，什么时候直接传递，有一点不够直接。这里主要来介绍一下在Model与Collection和View通信中容易混淆的一些场景，希望有所帮助。
READMORE

#### Model与View

Backbone中的View主要用来展示Model以及绑定各种事件回掉。View需要与Model绑定可以有两种方式。

1.  通过构造函数初始化

  ```coffee
  var PostView = Backbone.View.extend();
  var Post = Backbone.Model.extend();
  var post = new Post({title: "post title"});

  var postView = new PostView(post);
  var anotherPostView = new PostView({model: post});
  var anotherPostView2 = new PostView({model: post.toJSON()});
  ```
  上面的代码都是通过构造函数将model传如一个View中，唯一的不同是postView是直接传入model对象，anotherPostView是传入了一个hash对象，key值为model，而anotherPostView2则是将post转换为JSON后传入。

  这三种有什么不同呢？

  Backbone的View构造函数可以接受参数，默认传入的参数可通过this.options来访问，postView就是这种情况。

  但是一些特别的参数例如model（其他的参数还有collection, el, id, className,tagName和attributes），如果anotherPostView，model会直接添加到View对象中，可以通过this.model调用，这时的结果是整个post对象，拥有Backbone Model的所有方法。获取title的方式是this.model.get('title')

  anotherPostView2与anotherPostView不同在于model被转化为了JSON对象，所以获取title的方式为this.model.title。

  那么应当选取哪一种呢？

  三种方式都可以满足基本的数据展示需求，只是调用方式的不同，不过推荐使用第二种，因为完整的model对象拥有更完整的事件机制。比如，希望在model改变的时候重新渲染view，那么就可以通过下面的方式

  ```coffee
  this.model.on('change', this.render, this);
  ```
  这样的基础是，当通过set改变model的属性时，会自动出发change事件。

2.  通过render方法传入model

  View最重要的方法就是render，它决定如何展现数据。稍微复杂一些的View通常会通过underscore的template方法生成DOM模板，然后传入Model替换其中的Pleaceholder。例如Backbone的网站上给出的例子。

  ```coffee
  var Bookmark = Backbone.View.extend({
    template: _.template(…),
    render: function() {
      this.$el.html(this.template(this.model.attributes));
      return this;
    }
  });
  ```
  这里的model可以在render方法中传入，然后进一步传入模板中。注意，传入模班的model调用了attributes方法，也就是toJSON，因为在模板中通常直接调用JSON中的key。

  那么这两种model与view的关联方式如何取舍呢？我的经验是，如果View只服务于特定的model，那么就在构造函数传入。如果随着model的不同，我们希望这个View可以渲染不同的模板，而View是同一个对象，那么就在render时调用，需要的话在render方法中使用

  ```coffee
  this.model = model
  ```
  将传入的model应用于当前View的model。

#### Model与Collection

Collection是Backbone中一组有序的Model集合，当页面需要管理多个同种类型的Model时，Collection提了很多的便利，例如很多的集合操作，基于集合的事件。Collection可以指定包含的model对象类型，例如

```coffee
var Posts = Backbone.Collection.extend({
  model: Post
});

var posts = new Posts();
posts.add(post);
posts.add({title: "a new post"});
```
前三行定义了一个Post的Collection，后面向其中添加了两个post，一个是Model对象，一个是hash对象。虽然添加的方式不同，但是当被添加到集合之后，它们的存储都是一样的，因为hash对象会被转换为对应的model对象，如果model定义了initialize方法，还会去调用它。相对于View与Model，Collection与Model的关联方式要简单许多。

这里简单的分析了view与collection中的model用法，相信即使对backbone不是了解，现在看到满篇的this.model应该不会头疼了。
