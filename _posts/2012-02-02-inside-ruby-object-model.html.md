---
title: ! 'Inside Ruby: Object Model'
category: PROGRAMMING
tags:
- Metaprogramming
- Ruby
date: 2012-02-02
status: publish
type: post
published: true
meta:
  _edit_last: '1'
---
今天来重新了解一下ruby的Object Model，之所以是重新，因为是从内部来看，而不是从外部的使用上。

1\. object
object = instance variables + methods(包括一个指向所属class的方法)。使用object.instance_variables 和object.methods可以查看对应的信息, 区别在于前者存在于object本身，而method存在于object的class中，这些method在class中被称作instance method，这也是为什么同一个class不同object可以共享方法，但是不能共享instance variable。

2\. class
class也是一个object，是Class的实例，拥有instance methods和指向父类的方法superclass。Class是Module的子类，所以一个class也是一个module。

3\. module
module与class没有根本差别，因为class本身就是module的子类，但是引入module与class的目的是不同的。通常来说，class用来实例化和继承，而module用来mix in或者作为namespace。
READMORE
下面的代码片段展示了部分上述内容

```ruby
class MyClass
  def my_method
    @v = 'instance variable'
  end
end

obj = MyClass.new
obj.instance_variables    # => []
obj.my_method
obj.instance_variables    # => [:@v]
obj.methods == MyClass.instance_methods    # => true
MyClass.class        # => Class
Class.superclass     # => Module
Module.superclass    # => Object
MyClass.superclass   # => Object
```

4\. include

先看下面的代码

```ruby
module A; end
module B; end

class BaseClass; end
class MyClass < BaseClass
  include A
  include B
end

MyClass.ancestors   # => [MyClass, B, A, BaseClass, Object, Kernel, BasicObject]
MyClass.superclass  # => BaseClass
```

在面向对象的语言中，当我们调用方法的时候，首先会在当前类中寻找，如果找不到，则会去父类中，然后是父类的父类。Ruby中提供了一个superclass方法，顾名思义是返回父类，但是Ruby并不是按照superclass的返回结果层层向上寻找方法。与Java和C#一样，Ruby不允许多继承，但是Module的引入使得它有所不同，不同在于，Ruby是按照ancestors的返回结果来寻找，这个ancestor tree中包含了class和module。

所以，Ruby查找方法的顺序为：当前类 -> include的module的逆序，-> 继承的父类。原因在于 ，Ruby中，当在一个class中include一个module时，它会创建一个匿名类，包装那个module，并且将这个匿名类插入祖先树中，仅仅在当前类之上。而superclass对此一无所知。

[《Metaprogramming Ruby》](http://book.douban.com/subject/4086938/")一书对这些有非常详细的解释，推荐参考。