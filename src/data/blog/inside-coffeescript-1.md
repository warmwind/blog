---
title: Inside CoffeeScript：语法强大
pubDatetime: 2012-05-26T00:00:00+08:00
description: Inside CoffeeScript：语法强大
slug: inside-coffeescript-1
---
第一次听说CoffeeScript是Rails 3.1将它作为默认的支持，第二次深入的理解是Nodejs的兴起，CoffeeScript用它独特的语法样式，使我这个面向对象出身的程序员在写JavaScript时找到了似曾相识的感觉。当然如果对它的理解仅仅停留在语法的简化，那么只能说对[JS(The World's Most Misunderstood Programming Language)](http://javascript.crockford.com/javascript.html)本身并不熟悉。

[<< JavaScript语言精粹 >>](http://book.douban.com/subject/3590768/)一书中提交了很多JS本身语法存在的缺陷，例如全局变量，分号自动补全，==等。CoffeeScript的golden rule是“It's just JavaScript”, 但是它如何避免这些陷阱，则从另一方面体现了它的强大。本文将从语法强大方面来举例分析。

1）函数默认参数 + 字符串连接

```js
favorite = function(language){
  if(language == null){
    language = 'CoffeeScript';
  }
  console.log("I love " + language + " best");
}
favorite()
```

```coffee
favorite = (language = 'CoffeeScript') -> console.log "I love #{language} best"
```
2）可变参数Splats

这样一个例子：足球赛事中，一般的排名是，冠军，亚军，和其他球队，这里再复杂一点，加上最后一名。也就是：

```text
Given

allTeams = ['Chelsea', 'Bayern', 'Barcelona', 'Real Madrid', 'Milan', 'Inter', 'HengDa']

Output:

champaion: Chelsea
runner-up: Bayern
others:Barcelona, Real Madrid, Milan, Inter
last:HengDa
```
用JS和CoffeeScript分别实现

```js
var allTeams = ['Chelsea', 'Bayern', 'Barcelona', 'Real Madrid', 'Milan', 'Inter', 'HengDa'];
order = function(teams) {
  var champion = teams[0];
  var runnerup = teams[1];
  var others = teams.length >= 3 ? teams.slice(2, teams.length - 1) : [];
  var last = teams[teams.length - 1];
  console.log("Champion is " + champion);
  console.log("Runnerup is " + runnerup);
  console.log("others are " + others);
  console.log("last is " + last);
};

order(allTeams);
```

```coffee

allTeams = [
  'Chelsea'
  'Bayern'
  'Barcelona'
  'Real Madrid'
  'Milan'
  'Inter'
  'HengDa'
]

order = (champion, runnerup, others..., last) ->
  console.log "Champion is #{champion}"
  console.log "Runnerup is #{runnerup}"
  console.log "others are #{others}"
  console.log "last is #{last}"

order allTeams...
```

3）Destructing Assignment

在Ruby中有同样的语法，下面的例子实现了Fibonacci数列

```coffee
#Fibonacci
[last, current] = [0,1]

for i in [0..10]
  console.log last
  [last, current] = [current, current + last] 

console.log last
```
更加强大的是当右侧是一个对象时，会根据该对象的属性进行赋值：

```coffee
class Shape
  constructor: (@width) ->
  computeArea: -> throw new Error('I am an abstract class!')
class Square extends Shape
  computeArea: -> Math.pow @width, 2
class Circle extends Shape
  radius: -> @width / 2
  computeArea: -> Math.PI * Math.pow @radius(), 2

#The instanceof operator tests presence of constructor.prototype in object prototype chain.
showArea = (shape) ->
  unless shape instanceof Shape
    throw new Error('showArea requires a Shape instance!') 
  console.log shape.computeArea()

showArea new Square(2) # 4 
showArea new Circle(2) # pi
```

```coffee
myRect =
  x: 100
  y: 200

{x: myX, y: myY} = myRect

#定义了myX和myY两个变量，并调用myRect.x和myRect.y分别赋值
console.log myX
console.log myY

#当定义的变量名称与右侧对象的key值相同时，可以更精简为
{x, y} = myRect
console.log x
console.log y
```
4）class与inheritance
定义了class与extends来是语法来包装JS使其更加类似面向对象的语言。给个简单例子

```coffee
class Shape
  constructor: (@width) ->
  computeArea: -> throw new Error('I am an abstract class!')
class Square extends Shape
  computeArea: -> Math.pow @width, 2
class Circle extends Shape
  radius: -> @width / 2
  computeArea: -> Math.PI * Math.pow @radius(), 2
  
#The instanceof operator tests presence of constructor.prototype in object prototype chain.
showArea = (shape) ->
  unless shape instanceof Shape
    throw new Error('showArea requires a Shape instance!') 
  console.log shape.computeArea()

showArea new Square(2) # 4 
showArea new Circle(2) # pi
```
