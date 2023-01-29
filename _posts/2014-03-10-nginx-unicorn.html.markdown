---
title: Nginx 与 Unicorn
date: 2014-03-10
tags: Capistrano,Nginx,Rails,deploy
category: PROGRAMMING
status: publish
---
Capistrano, Nginx 与 Unicorn的搭配作为Rails应用的部署方式是现在成熟与流行的模式，[Deploying Rails app using Nginx, Unicorn, Postgres and Capistrano to Digital Ocean](https://coderwall.com/p/yz8cha)这篇文章详细介绍了如何来使用，本文希望稍微深入一些来看看Nginx与Unicorn之间是如何通信的，以及Unicorn如何实现部署时做到了零宕机。

READMORE

####Unicorn
Unicorn是应用服务器，以master/workers的模式工作。当master进程启动时，会将整个应用加载到内存中，之后会fork出若干个worker，master不处理任何请求，这时worker的工作。master进程管理所有的worker，它清楚每个worker处理请求的时间，当超过某个阈值时，会kill掉这个worker，并立刻fork出一个新的，以防止大量耗时的请求将worker耗尽。fork一个worker是瞬间完成的。

####负载均衡
传统的负载均衡是会基于某种算法（例如根据worker上次一个处理的时间）将下一个request加入到worker的队里中，但是如果很不幸这个worker正在处理的是一个耗时的操作，那么队列中的后续请求就block了。而unicorn的负载均衡是Unix系统内核完成的，所有的worker在就绪时通过unix的select(2)来从队列中（这里的队列其实是shared listen socket）抓取请求。通过这种方式，请求队列在master进程上，而一旦有可用的worker，就可以立即进行处理，而不会出现前面的问题，除非所有的worker都在处理慢请求，那只能等到超时后被master kill掉，然后重新fork出worker。
当然，如果出现这种情况，就是系统本身有问题或者遭到了攻击。

#### 零宕机部署
[Capistrano](http://capistranorb.com)是一个简单易用的自动化部署工具，可通过脚本配置，将应用部署到多个服务器中，支持在不同的部署阶段执行相应的任务。不过零宕机部署的主要功劳在unicorn。在部署时，我们会向当前的unicorn master进程发送USER2信号，它会开始创建一个新的master进程，重新加载应用。之后fork它自己需要的worker。第一个fork出的子进程会发现还有另一个旧的master进程，那么就会向它发送QUIT信号，旧master会等待自己所有的worker完成当前的请求后终止。由于旧的worker会继续处理完当时的请求，所以用户不会察觉到程序的修改，而同时，新的master和worker已经开始工作，所有新来的请求会由新的worker处理，这样就实现了零宕机。
> * QUIT - graceful shutdown, waits for workers to finish their current request before finishing.
> * USR2 - reexecute the running binary. A separate QUIT should be sent to the original process once the child is verified to be up and running.

```ruby
unicorn_pid = "#{shared_path}/pids/unicorn.pid"
test -s unicorn_pid && kill -USR2 `cat #{unicorn_pid}`
```
当然，这只是针对的仅有代码修改的部署。如果牵扯到数据库迁移，就不能简单的这样处理，因为数据库是在新旧worker之间共享的。不过也可以通过迁移脚本来尽可以达到这个目的，这就是另一个话题了。

###Nginx
Nginx是一个http服务器和反向代理服务器，功能强大，而且配置起来并不复杂。下面简单介绍一下其中的几个主要概念。

####upstream
它定义了一组server，可以通过unix的socket，也可以是domain name或者IP地址。这里使用那种方式需要根据与unicorn设置的配合来确定，如果在unicorn中设置了listen某个端口，则nginx也要使用端口，如果unicorn中设置了listen某个socket，则unicorn中就要指定socket的位置，这个就是ngxin与unicorn通信的地方。
upstream除了可以定义server的地址以外，还可以作为进行负载均衡的设定。通过设置weight来改变默认的权重，也可以使用默认的方法，例如least_conn来设定使用连接最少的server，ip_hash来设定将同一个ip的request发送给同一个server。

```nginx
upstream example {
    server backend1.example.com weight=5;
    server 127.0.0.1:8080       max_fails=3 fail_timeout=30s;
    server unix:/var/apps/example/tmp/sockets/unicorn.sock;
}
```

```ruby
#unicorn.rb
listen 8090
listen APP_ROOT + "/tmp/sockets/unicorn.sock"
```
###server
它定义了一个虚拟的server，下面的配置定义都非常表意，需要注意的时proxy_pass，这里使用了上面定义的upstream，也就是将所有的请求都转向到example这一组server上。
nginx在处理request时是有一定顺序的，例如下面的定义中，nginx会检测request header中的HOST是example.com还是example.net来匹配不同的server。而在匹配的server中，还会根据location的设置来匹配不同的设置，例如请求的是example.com/test.gif，则会匹配第二个location，从而在增加一个30天的过期时间。

```nginx
server {
        listen 80;
        server_name example.com;
        root /var/apps/example/current/public;
        index index.html index.htm;

        access_log /var/log/nginx/example_access.log info;
        error_log /var/log/nginx/example_error.log;

        location / {
          proxy_pass http://example;
        }
        location ~* \.(gif|jpg|png)$ {
          root /var/apps/example/current/public;
          expires 30d;
        }
}
server {
        listen 80;
        server_name example.net;
}
```

上面只是简单介绍了一下unicorn和ngxin如何工作以及如何配置，下面的一些文章有更详细的介绍：

* [http://sirupsen.com/setting-up-unicorn-with-nginx](http://sirupsen.com/setting-up-unicorn-with-nginx)
* [https://blog.engineyard.com/2010/everything-you-need-to-know-about-unicorn](https://blog.engineyard.com/2010/everything-you-need-to-know-about-unicorn)
* [https://github.com/blog/517-unicorn](https://github.com/blog/517-unicorn)
* [http://tomayko.com/writings/unicorn-is-unix](http://tomayko.com/writings/unicorn-is-unix)
* [http://nginx.org/en/docs/http/ngx_http_upstream_module.html](http://nginx.org/en/docs/http/ngx_http_upstream_module.html)
* [http://nginx.org/en/docs/http/request_processing.html](http://nginx.org/en/docs/http/request_processing.html)