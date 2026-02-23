---
title: Express Js
pubDatetime: 2011-07-04T00:00:00+08:00
description: Express Js
slug: express-js
---
Javascript通常运行于客户端浏览器，可以方便的操作HTML中的DOM元素，另外，提供也提供了一些事件响应机制，将表单验证等很多功能置于前台完成，降低前端与服务器端的交互次数，提高用户体验。在服务器端，有很多的框架可以选择，包括SSH，Spring MVC，ASP.Net MVC等，这些框架提供了良好的结构，可以创建强健的Web应用。

然而，前端与后端的割裂在某种程度上限制了Web开发人员的全面发展，而且我们往往需要可以快速的创建我们的应用系统，在这一点上，上面的框架显得过于笨重。如果可以让前后台可以无缝连接，那么将会大为简化系统的开发，基于Node.js的Express就是这样一种框架。

谈到Express就必须要了解Node.js，Wikipedia对Nodejs的定义是：
> Node.js is an event-driven I/O server-side JavaScript (on V8 JavaScript engine) environment for Unix-like platforms. It is intended for writing scalable network programs such as web servers. It was created by Ryan Dahl in 2009, and its growth is sponsored by Joyent, which employs Dahl.

> Node.js is similar in purpose to Twisted for Python, Perl Object Environment for Perl, libevent for C and EventMachine for Ruby. Unlike most JavaScript, it is not executed in a web browser, but is instead a form of server-side JavaScript. Node.js implements some CommonJS specifications. Node.js includes a REPL environment for interactive testing.

当前web的应用的现状：很多应用（如聊天室，网络游戏等）都希望在连接建立以后始终保持这个连接，随时与发送请求获取响应。传统的服务器，为每个请求单独开始新的线程，在客户并发请求数量巨大的情况下，使用传统的方式实现资源的合理配置并不容易。而Node.js使用事件驱动，通过这种方式以单线程的方式实现并发的快速响应，所有的方法都通过回掉方式进行处理，之后回到事件循环。而在实践循环的时间，可以随时接受新的事件，CPU不会有任何的消耗。

本文不是要详细介绍Node.js，而是Express框架，希望通过Route，View，Database这三个方面的实现来与传统的web框架作比较，来分享服务器端的实现的简洁与强大。
1\. Route

```js
  app.get('/user/:id', function(req, res){
      res.send('user ' + req.params.id);
  })
```
上面代码在当用户访问"http://server:port/user/1"这样的地址时触发，执行上面所定义的匿名函数，参数1会放入req.params.id中。这里还支持使用正则表达式匹配更多的情况。

Middleware

Express中，可以对某个请求进行顺序的若干处理，比如从数据库加载用户信息，判断用户权限，然后操作数据。这可以使用Middleware完成。Middleware与普通的回掉函数不同的地方在有另一个函数作为参数，通常叫做next()。当在某个Middleware中调用next()时，系统会自动调用下一个匹配的路由进行处理。

Route Param Pre-conditions

```js
app.param('userId', function(req, res, next, id){
  User.get(id, function(err, user){
    if (err) return next(err);
    if (!user) return next(new Error('failed to find user'));
    req.user = user;
    next();
  });
});

app.get('/user/:userId', function(req, res){
  res.send('user ' + req.user.name);
});
```

上面的代码中，当请求该路由时，会先执行param，这里通常可以进行一些校验，从数据库读取数据等等任务，之后基于Middleware的功能，调用next()，转回主回掉函数。

Struts使用极为复杂的配置来实现路由功能，Spring MVC加入了annotation，在代码可读性上有了较大提高，但依然没有这里的直接。同时Middleware，特别是Route Param Pre-conditions类似于AOP，可以在真正的业务逻辑处理前进行预处理工作，使代码更清晰简洁。

2\. View

Express支持Haml， Jade， EJS， CoffeeKup，jQuery等视图。

可通过app.set('view engine', 'jade')加载并激活对应的template，Jade是Express中默认的template。下面代码实现了在render页面以及页面与后台的数据绑定(使用hmal作为view engine)

```haml
%h1= title
%form{ method: 'post' }
  %div
    %div
      %span Title :
      %input{ type: 'text', name: 'title', id: 'editArticleTitle' }
    %div
      %span Body :
      %textarea{ name: 'body', rows: 20, id: 'editArticleBody' }
    %div#editArticleSubmit
      %input{ type: 'submit', value: 'Send' }
```

```js
get('/blog/new', function(){
  this.render('blog_new.html.haml', {
    locals: {
      title: 'New Post'
    }
  });
});

post('/blog/new', function(){
  var self = this;
  articleProvider.save({
    title: this.param('title'),
    body: this.param('body')
  }, function(error, docs) {
    self.redirect('/')
  });
  
```  
3\. Database

由于JSON是天然的javascript数据传递格式，可以看到在路由定义中render view使用的变量定义也是通过JSON的格式进行，所以Express自然对基于document的数据库提供了良好的支持，也就是Mongo DB。它的driver是node-mongodb-native，通过下面的代码就可以使用mongo。

```js
var mongo= require('mongodb').Db
db= new Db('db-name', new Server(host, port, {auto_reconnect: true}, {}));
db.open(function(){});
```