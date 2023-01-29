---
title: Rails中隐藏的check_box
date: 2013-06-02
tags: Rails, checkbox
category: PROGRAMMING
status: publish
---
Rails中，我们经常会在form中使用check\_box这个helpler方法，在controller中，可以通过params[:category]来获取category的值。然而，如果检查一下check_box这个helper方法生成的html代码，会有点不如想象那样直接可懂。

例如下面一个简单的form中

```erb
<%= form_for(@post) do |f| %>
  <div class="field">
    <%= f.label :category %>
    <%= f.check_box :category %>是否设置类型
  </div>
  <div class="actions">
    <%= f.submit %>
  </div>
<% end %>
```
READMORE

```html
<input name="post[category]" type="hidden" value="0" />
<input id="post_category" name="post[category]" type="checkbox" value="1" />是否设置类型
```

上面就是那个check_box生成的html代码，问题是为什么会有一个与期望的input同名的隐藏域呢？而且它已经被设定为value是0，那么它将伴随着表单提交而提交上去，这样的话，在controller里面是如何拿到正确的值的呢？

其原因是这样的：

* 浏览器不会提交没有选中的checkbox，所以，如果没有那个隐藏域，当checkbox没有选中时，这个字段将不会有值post后台。结果会是，当这个字段有check的值存储以后，将无法再更改为uncheck的值。
* 上面的html或者只提交隐藏域，或者提交同名的两个字段。HTML规范中规定表单字段提交的顺序与在表单中出现的顺序是相同的，最后一次出现的值代表了该字段的值。因此无论该checkbox是否选中，后台都可以得到对应的值。

BTW，如果是要使用checkbox group，则需要指定{:multiple => true}，并且避免将uncheck的默认值设为nil。