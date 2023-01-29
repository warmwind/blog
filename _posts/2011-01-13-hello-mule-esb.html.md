---
title: Hello Mule ESB
category: PROGRAMMING
tags:
- j2ee
- mule ESB
- ssh
date: 2011-01-13
status: publish
type: post
published: true
meta:
  _edit_last: '1'
  _wp_old_slug: ''
---
这些天在一个庞大的J2EE遗留系统中工作，其实很想体验真正企业级应用是如何实现的。不过每天忙于应付ERB、Service、Dao、Validator .xml 等文件，修复Bug，感受到的只是众多的Class和Config，以及由此导致的启动JBoss花费4分钟多（只publish三个EAR）和尝试用IntelliJ打开要等很久很久很久，最终放弃的痛苦。

今天这样的心情有所不同，接触了一个之前似乎在哪里看到过名字的东西叫做Mule ESB。

是否使用Mule ESB可以从下面的[mulesoft](http://www.mulesoft.org/what-mule-esb)网站给出的五个问题来考虑:
> * Are you integrating 3 or more applications/services?
> * Will you need to plug in more applications in the future?
> * Do you need to use more than one type of communication protocol?
> * Do you need message routing capabilities such as forking and aggregating message flows, or content-based routing?
> * Do you need to publish services for consumption by other applications?

也可以这样理解，Mule ESB就是用来解决上述问题才需要引入，而这种复杂性以及扩展性恐怕也只有在企业级的应用中才会出现，之前只是了解SSH，这些还远远不够。

进入正题。其实今天也就是跑通了Hello world以及在示例代码中增加了一个很小的功能。。。

这个Hello world的功能是：用户输入名称name，有两个Service来处理，第一个处理成Hello + name, 第二个进一步处理成Hello + name，how are you？这是个简单的模型，特别之处在于这两个Service彼此之间没有任何直接的通信，消息（name）的流转处理通过一个hello-config配置，每个Service只完成自己对输入消息的处理，然后输出即可。<a title="mulesoft" href="http://www.mulesoft.org/what-mule-esb" target="_blank">mulesoft</a>网站上有张图对这个功能作解释非常合适，转载一下
![](hello-mule.png)

其核心的配置如下：

```xml
<model name="helloSample">
     <service name="GreeterUMO">
         <inbound>
             <stdio:inbound-endpoint system="IN" transformer-refs="StdinToNameString"/>
         </inbound>
         <component class="org.mule.example.hello.Greeter"/>
         <outbound>
             <filtering-router>
                 <vm:outbound-endpoint path="chitchatter"/>
                 <payload-type-filter expectedType="org.mule.example.hello.NameString"/>
             </filtering-router>
    </service>
     <service name="ChitChatUMO">
         <inbound>
             <vm:inbound-endpoint path="chitchatter" transformer-refs="NameStringToChatString"/>
         </inbound>
         <component class="org.mule.example.hello.ChitChatter"/>
         <outbound>
             <pass-through-router>
                 <stdio:outbound-endpoint system="OUT" transformer-refs="ChatStringToString" />
             </pass-through-router>
         </outbound>
     </service>
     </service>
 </model>
 ```
这里面声明了两个Service分别对应前面功能说明中Service，比较重要的配置是：
	
* transformer-refs：在进入处理的Component之前会执行这里指定的方法，主要用来进行类型转换
* vm:inbound-endpoint/vm:outbound-endpoint: 指定一个输入输出的path。在这里GreeterUMO以chitchatter作为输出路径，ChatUMO以它作为输入，这样就会在这个path上监听，得到前者发出的消息。
* component：数据处理，这里指定了类，但没有指定具体方法，mule会在运行是根据参数类型来确定执行的方法。Greeter类中就会执行参数类型为NameString的方法。

    ```java
    public Object greet(NameString person){
          person.setGreeting(greeting);
    }
    ```

    当然如果有两个方法类型相同，就会抛出异常，需要额外的配置（不过现在我还不清楚，留待后续研究。。）

这个Hello world还是比较简单的，两个Service都是在同一个工程下，使用相同的配置文件。如果是在不同的工程里，该怎么做呢？还有很多要研究！
