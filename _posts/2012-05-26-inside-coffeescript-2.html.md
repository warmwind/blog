---
title: Inside CoffeeScript：语法强壮
category: 技术
tags:
- CoffeeScript
- Javascript
date: 2012-05-26
---
前一篇文章主要说了CoffeeScript的语法强大的几点，它极大的简化了JS的语法，更清晰简洁，另外很重要的一点是它从语法本身的角度避免了JS的若干陷阱。

1\. ==

JS中，使用双等号比较时，它会尝试进行类型转换再比较，这就导致了下面的几个问题

```js
console.log('' == '0'); //false
console.log(0 =='');    //true
console.log(0 == '0');  //true
```

而在CoffeeScript中，如果使用==，将会自动编译为===，这从根本上解决了这个问题，另外还提供了一些更具语义的方法名，如 is, isnt等。
READMORE
2\. Loop

CoffeeScript有两种循环，针对数组的for ... in和针对对象的for ... of。其中针对对象的循环在JS本身是具有陷阱的。JS中对对象的循环会将对象整个原型链中的属性全部都包括进来，所以通常需要使用hasOwnProperty方法来判断属于当前对象自身的属性而排除原型链的属性。CoffeeScript并没有根本解决这个问题，但提供了own 关键字简化了解决方案

```coffee
myRect =
  x: 100
  y: 200

Object.prototype.z = 300

#x,y,z
for key, value of myRect
  console.log key  

#x,y
for own key, value of myRect
  console.log key
```

3\. Binding

先看下面的例子

```coffee
class Foo
  constructor: (@value) ->

  display: ->
    console.log @value

  robustDisplay: =&gt;
    console.log @value

foo = new Foo(20)

foo.display();            #20
foo.robustDisplay();      #20

anotherDisplay = foo.display
anotherRobustDisplay = foo.robustDisplay

anotherDisplay()                 #undefined
anotherRobustDisplay()           #20
```

前面的两次调用都返回20，这是我们期望的值，但是当调用another*方法时，第一个返回了undefined，而第二个正确。这是怎么回事呢，不过是给了另一个别名，就导致了错误。仔细观察会发现错误的方法使用的是“->”，而正确的方法使用了“=>”(Fat Arrow)。

要找到根本的原因，得要提一下JS的Scope和Context的概念

[\<\<CoffeeScript: Accelerated JavaScript Development\>\>](http://book.douban.com/subject/6310125/)一书中给出了这样的描述
> Scope: A variable’s scope is its home, as defined by three rules:
>
> *  Every function creates a scope, and the only way to create a scope is to define a function.
>
> *  A variable lives in the outermost scope in which an assignment has been made to that variable.
>
> *  Outside of its scope, a variable is invisible.

> Context(==This):

> * When the new keyword is put in front of a function call, its context is the new object.

> * When a function is called with call or apply, the context is the first argument given.

> * Otherwise, if a function is called as an object property (obj.func) or obj['func']), it runs in that object’s context.

> * If none of the above apply, then the function runs in the global context.

简单说scope就是定义时变量的可见性，context是运行时this所指的对象环境。例子中的两个方法的实现中都输出this.value。那么当使用foo对象去o调用时，this指的就是foo对象，从而第一个执行都正确返回。当使用another*时，this对象已经发生了变化，而不再指向foo，所以anotherDisplay()返回了undefined,因为global对象并没有value值。那么anotherRobustDisplay()为什么正确呢，看看它编译的JS就清楚了

```js
this.robustDisplay = __bind(this.robustDisplay, this);
```
在编译出的代码中有上面一个调用，它的作用就是将对robustDisplay绑定在当前对象中，而不随着调用者的变化而变化，这样它将可以知道value值。

上面只是列举了几个小例子，用以展现CoffeeScript的语法强壮之处。当然，使用的时候还是要特别注意：
  
* 与python一样，它使用缩进表示层次关系，所以编辑器的空格与tab键一定要统一
* 像ruby一样，方法调用传递参数可以省略括号，所以方法链调用特别要注意，推荐除非特别简单，否则都使用括号
* 参数之间的空格也要特别注意，省略括号时，是否有空格会对表意产生巨大影响
