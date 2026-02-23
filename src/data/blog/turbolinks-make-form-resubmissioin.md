---
title: Turbolinks导致的表单重复提交警告问题
pubDatetime: 2013-02-28T00:00:00+08:00
description: Turbolinks导致的表单重复提交警告问题
slug: turbolinks-make-form-resubmissioin
---
Turbolinks将在Rails4中会被默认引入，它类似于PJAX，但是会托管整个页面的body部分，在页面跳转时，不会重新加载整个页面，而是使用JavaScript重写页面并且更新浏览器中的地址，从而使页面访问的速度大大加快。  

尽管Rails4还没有正式发布，但现在的项目已经在使用Turbolinks了，它不需要任何额外的配置，添加到Gemfile后即可。最近遇到了一个问题如下：

几乎所有的应用都会有表单的验证、错误显示、提交并重定向等，比如下面的rails controller中的create action，当post成功存储以后，重定向到post列表页面，如果存储失败，render当前新建页面，由于post实例变量的存在，new页面被render时会自动填入用户已经输入的信息以及validation的错误信息。

``` ruby
def create
  @post = Post.new(params[:post])
  if @post.save
    redirect_to @post
  else
    render action: "new"
  end
end
```

这里的重定向遵循了[PRG模式(post-redirect-get)](http://en.wikipedia.org/wiki/Post/Redirect/Get)，这样当用户点击后退或者刷新页面都不会出现表单重复提交的警告。

但是加入Turbolinks之后，当表单提交成功，然后刷新页面，仍然会出现表单重复提交的警告。

Turbolinks的文档中提到的如果想禁止它，可以在container的标签上加入data-no-turbolink。不过这样尝试仍然不工作。从表现来看，浏览器页面在表单提交后整个刷新，是一个302redirect，但是似乎post请求的状态始终还在。

找不到根本的原因，所以有了下面的解决方案：

```ruby
def create
  @post = Post.new(params[:post])
    if @post.save
      render :json =>; {:redirect_url => posts_path}
    else
      render :partial => "form", :status => 400
    end
  end
```

```coffee
$(document).on "ajax:complete", ".post form", (event, xhr, status) ->
  if status == "success"
    res = $.parseJSON xhr.responseText
    Turbolinks.visit res.redirect_url
  else
    $('.entry-show.entry').html xhr.responseText
```
如上面的代码，  

1.  使用Ajax提交表单，在rails中也就是将原有的表单增加一个:method=>true的属性。     
2.  在controller中对象保存成功之后返回Json或者text，里面包含需要转向的url。  
3.  在Ajax的success回调中使用Turbolinks.visit path方法“转向”到成功的地址。实际上是JavaScript重新页面，速度很快  

如果保存失败，比如校验不通过等，需要重新render界面，并回显相关信息。这时不能直接像成功后的回调那样使用visit方法，这将丢失原来的信息。如果将所有的参数手动传入呢，当然也不可取。  

我这里采取的方法，是原有的表单提取为partial，并在controller中保存失败后render。而在Ajax的回调中失败时，将返回的partial写入页面，替换原来的表单。因为这个partial是在controller中渲染好的，所以保存了所有的输入和验证信息。

通过使用Ajax提交表单，成功解决了Turbolinks引入的表单重复提交警告的问题，而且加速了页面的显示。