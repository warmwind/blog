---
title: 常用易混的四个Rails View Helper方法
date: 2013-12-01
tags: Rails
category: 技术
---

Rails中有非常多强大的View Helper，今天其实想在这里简单总结其中4个与安全相关但又容易混淆的。

它们分别是: [h](http://api.rubyonrails.org/classes/ERB/Util.html#method-c-h), [html_safe](http://api.rubyonrails.org/classes/String.html#method-i-html_safe), [simple\_format](http://api.rubyonrails.org/classes/ActionView/Helpers/TextHelper.html#method-i-simple_format), [sanitize](http://api.rubyonrails.org/classes/ActionView/Helpers/SanitizeHelper.html#method-i-sanitize)。

READMORE

#### h

我们经常需要在页面上动态展示文字，这些完全可能来自用户的输入。所以为了防止XSS，在页面渲染时，需要对文字进行转义。在Rails2时，经常见到如下的代码

```erb
<%= h some_text %>
```
其中h方法就是进行转义操作，它的同义方法为html_escape。当然在Rails3之后，h方法已经是默认调用，所以不要再显示出现了。
从源代码可以看出，这里会对四种符号进行转义（&"'><），也就是在Rails的console中可以尝试如下代码

```ruby
include ERB::Util
 => Object
> puts html_escape("is a > 0 & a < 10?")
is a &gt; 0 &amp; a &lt; 10?
```

#### html_safe

其实h方法的实现依赖此方法，其实现中首先判断是否是html_safe，如果是就直接返回，否则做转义替换。

```ruby
def html_escape(s)
  s = s.to_s
  if s.html_safe?
    s
  else
    s.gsub(/[&"'><]/, HTML_ESCAPE).html_safe
  end
end
```
html_safe是个很容易理解错误的方法。它不是像方法名那样将调用的对象转换为安全的，而是变成了另一个类型。它是打开String后添加的一个方法，因此可以在任何String上调用，返回一个SafeBuffer对象。

```ruby
class String
  def html_safe
    ActiveSupport::SafeBuffer.new(self)
  end
end
```
SafeBuffer是个特别的类，它覆写了String的+, << 和 []，当在erb中输出时，它不进行转义，而当给它concat一个普通的String时，它会对连接的这个字符转义。可以这样理解这个对象，它认为自己是“Safe”的缓冲池，当你给它连接字符时，则需要将其转义来保证“Safe”，而如果连接的同样是个“Safe”的对象，就不要转义了。并不是在页面上输出所有的字符时我们都需要转义，一个典型的应用场景如下（引用自[http://makandracards.com/makandra/2579-everything-you-know-about-html_safe-is-wrong](http://makandracards.com/makandra/2579-everything-you-know-about-html_safe-is-wrong)）：

```ruby
def group(content)
  html = "".html_safe
  html << "<div class='group'>".html_safe
  html << content
  html << "</div>".html_safe
  html
end
```

#### simple_format

这个方法比较好理解，顾名思义，用来格式化字符串的，主要的目的是将两个或多个换行符(\n)替换成(p)， 一个换行符替换成(&lt;br /&gt;)

#### sanitize

它提供了比h方法更加灵活转义策略，可以自定义不需要转义的tag。例如需要在页面显示让用自定义某些style时，就可以可以允许&lt;style&gt;标签，而不将其转义。
