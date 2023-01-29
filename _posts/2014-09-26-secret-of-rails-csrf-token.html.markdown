---
title: Rails CSRF token 探秘
date: 2014-09-26
tags: Rails,CSRF,Ajax
category: PROGRAMMING
status: publish
published: true
---

[CSRF](http://guides.rubyonrails.org/security.html#cross-site-request-forgery-csrf)(Cross-Site Request Forgery)是一种常见的攻击手段，Rails中下面的代码帮助我们的应用来阻止CSRF攻击。

```ruby
class ApplicationController < ActionController::Base
  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception
end
```
这段代码是Rails4自动生成的，这里使用了```with: :exception```设置了对在```handle_unverified_request```使用的策略是抛出异常```ActionController::InvalidAuthenticityToken```。 Rails3中默认使用的```reset_session```。
Rails防止CSRF的机制是在表单中随机生成一个authenticity_token，同时存储于表单的隐藏域以及当前的session中，当表单提交时，而server端就可以比较这两处的是否一致来做出判断，判断请求的来源是否可靠，因为第三方是无法知道session中的token的。

```ruby
# Sets the token value for the current session.
def form_authenticity_token
  session[:_csrf_token] ||= SecureRandom.base64(32)
end
```
```html
<div style="margin:0;padding:0;display:inline">
  <input name="utf8" type="hidden" value="✓">
  <input name="authenticity_token" type="hidden" value="EZWDs44j5vzY+DCsgTHL0iPYiOUwaFnemwtGmo2AVRM=">
</div>
```

当然，这些都是正常情况，当表单要作为ajax提交，也就是```data-remote=true```时，情况就不同了，默认配置下，```authenticityt_token```不再自动生成。如果是Rails3就会发现session中的信息不见了，如果是把user_id存储在session中的，当然登录的状态就改变了。如果是Rails4，默认就会得到上面提到的```InvalidAuthenticityToken```异常。


```ruby
#form_tag_helper.rb
def html_options_for_form(url_for_options, options)
   options.stringify_keys.tap do |html_options|
     ...
     if html_options["data-remote"] &&
        !embed_authenticity_token_in_remote_forms &&
        html_options["authenticity_token"].blank?
       # The authenticity token is taken from the meta tag in this case
       html_options["authenticity_token"] = false
     elsif html_options["authenticity_token"] == true
       # Include the default authenticity_token, which is only generated when its set to nil,
       # but we needed the true value to override the default of no authenticity_token on data-remote.
       html_options["authenticity_token"] = nil
     end
   end
 end
```
上面代码的5-14行可以看到生成token时的配置判断，从中也可以得到解决的两种办法：

1\. 配置

```
config.action_view.embed_authenticity_token_in_remote_forms = true
```

2\. 通过JS获取

其实在默认的layout中，一般会有一行```<%= csrf_meta_tags %>```，它的定义是：

```ruby
def csrf_meta_tags
  if protect_against_forgery?
    [
      tag('meta', :name => 'csrf-param', :content => request_forgery_protection_token),
      tag('meta', :name => 'csrf-token', :content => form_authenticity_token)
    ].join("\n").html_safe
  end
end
```
它在页面的head中增加一个```csrf-token```的属性

```html
meta content="authenticity_token" name="csrf-param" />
meta content="VY13wlC2rgGccbkxyvm7Z1WX4LKH+71vzIj+8Um0QO8=" name="csrf-token" />
```
这与表单渲染出的authenticity\_token是完全一致的，所以这就给了我们通过js来给表单设置authenticity_token的办法，如下

```javascript
//application.js
$('input[name=authenticity_token]').val($('meta[name=csrf-token]').attr('content'))
```