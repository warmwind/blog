---
title: 支付宝集成——生成请求URL
date: 2014-01-03
tags: alipay
category: 技术
---

去年的这个时候，开始开发基于支付宝的收费模块，现在已经运行了快到一年。这期间从担保交易到即时到帐，再到支持手机支付，经历了用户真正的验证后，今天来总结一下支付宝集成中得注意事项。当然要先申请支付宝的商家服务，拿到PID和Key，并至少签约成即时到帐、双工或者担保交易的一种。

以开发的角度，从发起到结束可以分为以下两个主要步骤：生成请求URL（网页版和手机版的生成方式是不同的），支付宝回调校验和应答。这里先来说一下生成请求URL的注意事项。

READMORE

#### 电脑网页版生成请求URL

  这会是一个普通的GET请求，支付宝的网关是，https://mapi.alipay.com/gateway.do，需要在网关后增添上需要的参数。如果请求成功，可以看到支付宝的登录页面。其中有几个需要注意的参数：

  * 同步转向地址return_url：用户支付成功以后的同步转向页面
  * 异步通知地址notify_url：当用户的交易状态发生任何变化（比如买家已付款，卖家已发货等）的时候，支付宝都会以POST方式来请求这个地址，并传递相应的参数。
  * sign和sign_type：支付宝要求对请求的参数需要做MD5加密，除了这两个参数以外，其它的参数都需要跟据字母顺序排序后加密。
  * 商户订单号out\_trade\_no：这里可以定义为系统中的某个唯一的值，它与支付宝的订单号一一对应。
  * logistics\_fee, logistics\_type, logistics\_payment：如果是担保交易，则必须指定这三个关于快递的参数。

#### 手机网页支付生成请求URL

  手机网页支付与电脑网页支付有很大的不同：

  * 手机端只支持即时到帐交易
  * 手机端数据交互格式不是普通的URL的参数，而是xml格式，在请求中的req_data参数需要传入的格式应该如下：

  ```xml
  <direct_trade_create_req>
    <subject>#{options[:subject]}</subject>
    <out_trade_no>#{options[:out_trade_no]}</out_trade_no>
    <total_fee>#{options[:price]}</total_fee>
    <seller_account_name>#{options[:seller_email]}</seller_account_name>
    <call_back_url>#{options[:call_back_url]}</call_back_url>
    <notify_url>#{options[:notify_url]}</notify_url>
  </direct_trade_create_req>        
  ```
  * 手机端请求URL时分两步，首先获取token，再以token请求支付页面

    第一步，请求移动网关http://wappaygw.alipay.com/service/rest.htm，参数包含一些基本参数和上面的req_data外，要指定service为alipay.wap.trade.create.direct。当然也是需要MD5加密的（支付宝也支持RSA加密，不过由于我们的系统允许用户输入自己的PID和KEY来使用，所以我们选择了简单的MD5加密）。

    第二步，解析返回的参数，取出token，然后构造执行的请求req_data为

    ```xml
    <auth_and_execute_req>
    <request_token>#{token}</request_token>
    </auth_and_execute_req>
    ```
    再一次请求移动网关，并将service设为alipay.wap.auth.authAndExecute。幸运的话，应该就能在手机上看到手机的支付宝登陆页面了。

生成URL中最长出现的错误可能就是MD5加密的错误，这时通常需要检查加密参数的顺序是否正确，或者参数是否完备或有多余了。
