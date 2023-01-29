---
title: ! 'Inside Ruby: Eigenclass'
category: 技术
tags:
- Metaprogramming
- Ruby
date: 2012-02-03
---
在[Inside Ruby: Object Model](/2012/02/02/inside-ruby-object-model.html)中提到，object拥有method，但是method并不存在于object中，而是在class中，这样同一个class的不同实例可以共享method。

我们知道在Ruby中，可以定义singleton method，这种method只针对某个特定的object定位，而其它的object则没有该方法。如下面的片段：

``` ruby
obj = Object.new
def obj.my_singleton_method
  puts 'one singleton method'
end

obj.my_singleton_method            # => "one singleton method"
Object.new.my_singleton_method     # => NoMethodError
```
READMORE
那么对于singleton method如何用上述理论来解释呢？

my_singleton_method不能存在于obj中，因为obj不是class，它也不能存在于Object这个class中，因为如果那样的话，所有的Object实例都会有这个方法，不会抛出异常。

对class method也可以做同样的分析，因为不同的类实际是Class的不同对象，从属于某个类的class method，其它类是不会有该方法的。

实际上，对每个object(class也是一种对象)，它还可以有一个特殊的隐藏的class，这就是Eigenclass(也叫Singleton class，Meta class)。

``` ruby
class Object
  def eigenclass
    class << self
      self
    end
  end
end

class A
  class << self
    def a_class_method; end
  end
end

obj = A.new
class << obj
  def a_singleton_method; end
end

obj.eigenclass                                         # => Class
obj.class                                              # => A
obj.eigenclass.superclass                              # => A
obj.eigenclass.instance_methods().grep(/a_sin/)        # => [:a_singleton_method]
```

上面的代码片段中，首先在class Object上加入一个eigenclass方法，用于返回被隐藏的eigenclass，然后给class A定义一个class method，给class A的实例obj定义一个singleton method。从运行的结果可以看出：

* ruby的class并没有告诉我们“真相”，obj的class方法返回结果实际上应该是eigenclass而不是A。</li>
* obj的method存在于它的eigenclass的instance method中，这就回答了最开始提出的那个singleton method到底存在何处的问题</li>

再看下面的片段

```ruby 
class B < A ; end

B.methods.grep(/a_/)                                   # => [:a_class_method]
B.superclass.eigenclass.instance_methods.grep(/a_/)    # => [:a_class_method]
```

这里想要说的是当向上寻找一个class method的时候，实际上是沿着eigenclass的super class来寻找的，也就是说一个类的eigenclass的superclass是它的superclass的eigenclass。

[《Metaprogramming Ruby》](http://book.douban.com/subject/4086938/")一书对这些有非常详细的解释，推荐参考。
