---
title: 支付宝集成——校验与应答
pubDatetime: 2014-01-04T00:00:00+08:00
description: 支付宝集成——校验与应答
slug: alipay-verify-request
---

前一篇文章介绍了如何生成支付宝的请求URL，当顺利打开支付宝的登录页面后，这里的操作就与应用本身无关了，完全在支付宝内部完成。当用户的交易状态改变，比如付款成功时，支付宝会通过POST发送请求URL中设定的notify_url。由于通常都需要在回调中进行业务逻辑处理，因为，为了防止恶意或伪造请求，需要对该请求进行严格的校验。

####  MD5校验
按照请求URL中的规则，对参数再进行一次MD5运算，与传递过来的sign值进行比较，这是为了保证URL的完整性，参数的值没有在传递过程中被篡改，因为需要的KEY值只有支付宝和系统内部可知。


####  支付宝校验
对网页版的支付异步回调，支付宝提供了专门的service来校验合法性。在收到POST请求的*一分钟内*，可以请求下面的地址，如果返回的body是个字符串true，则这是个有效的通知。
手机版是没有这个校验service的。

```html
https://mapi.alipay.com/gateway.do?service=notify_verify?partner=xxxxx&notify_id=xxxxx
```

支付宝的异步通知规则为,所以当异步回调成功处理之后，一定要返回success文字，并且要在业务逻辑上注意检测是否已经处理过该请求，防止重复处理。

>程序执行完后必须打印输出“success”(不包含引号、前后无空格和其他多 余字符)。如果商户反馈给支付宝的字符不是 success 这 7 个字符,支付宝 服务器会不断重发通知,直到超过 24 小时 22 分钟。
一般情况下,25 小时以内完成 8 次通知(通知的间隔频率一般是: 2m,10m,10m,1h,2h,6h,15h)

此篇与上篇文章介绍了与支付宝交互的内部流程，实际在开发中有很多库可用，它们主要提供了生成URL，校验，以及通知内容的封装等。基于Ruby On Rails的技术栈，我们采用了下面两个gem：

* <a href="https://github.com/Shopify/active_merchant" target="_blank">activemerchant</a>：这个集成了全球流行的支付网关
* <a href="https://github.com/flyerhzm/activemerchant_patch_for_china" target="_blank">activemerchant\_patch\_for\_china</a>：这个gem集成了 alipay (支付宝), 99bill (快钱), tenpay (财付通), 19pay(捷迅支付) and yeepay(易宝)

在支付宝手机网页支付方面，由于当时没有找到现成的gem，所以就是自己实现了。

前两天在上看到Ruby China上的<a href="http://ruby-china.org/topics/12992" target="_blank">这篇文章</a>介绍了一个gem，专门用于支付宝，可以通过查看它的源代码来了解实现细节。不够这个gem似乎也还不包括手机移动支付的部分。