---
title: Web Framework大杂烩之Data Binding
category: 技术
tags:
- Rails
- Spring MVC
date: 2011-01-11
---
昨天在使用Spring MVC做界面，一边做一边在想着前面使用ASP.NET MVC时是如何实现的。在花了一段时间把CRUD搞定之后，不禁感叹，做到这个程度，似乎也就是做了Rails中下面的一句话：

```ruby
rails generate scaffold
```

于是，我觉得似乎有必要把接触过的这几个框架做个比较，至少从应用层面可以对Rails, Java和 .NET有个结构性的认识。

既然是从做View时想到的这些，那么就先比较一下View中的Data Binding，也有的称为Model Binding。当我们提交表单时，如果完全手工处理，那么需要在后台从Request中取出每个Field的值，然后组装为需要的Model对象。当表单比较大，Field比较多时，就演变成了纯粹的体力劳动。这种自动包装表单为Model对象的功能就是Data Binding。

### Rails

Rails中Convention over Configuration的原则使得不需要任何额外的工作就可以实现banding。

```ruby
# view代码
<% form_for(@product) do |f| %>
  <p>
    <%= f.label :title %><br />
    <%= f.text_field :title %>
  </p>
  <p>
    <%= f.label :description %><br />
    <%= f.text_area :description %>
  </p>
  <p>
    <%= f.submit 'Create' %>
  </p>
<% end %>

#controller代码
  def create
    @product = Product.new(params[:product])

    respond_to do |format|
      if @product.save
        format.html { redirect_to(@product, :notice => 'Product was successfully created.') }
     else
        format.html { render :action => "new" }
      end
    end
  end
```

其中form_for(@product)是Rails提供的view helper，将界面中的title和description属性与product对象绑定起来，而这个对象在controller中定义。当使用post到create方法时，rails从request params中创建包含数据用于存储的对象.

### Spring MVC

```java
//view代码
<form:form action='/product/create.htm' commandName="product">
    <form:input path="title"/>
    <form:input path="description"/>
    <input type="submit"/></div>
</form:form>

//controller代码
@RequestMapping(value = "/product/create.htm", method = RequestMethod.POST)
public String create(Product product) {
    service.save(product);
    return REDIRECT_LIST_VIEW;
}
```

这里view使用\<form:form\>做view helper，其中的commandName属性指定了使用的model名称，\<form:input\>用来标明属性来实现binding。

实际上，还可以使用另一种数据binding叫做“ModelAttribute”

```as3
//view代码
<form:select path="role">
     <form:option value="NONE" label="--- Select ---"/>
     <form:options items="${roles}"/>
</form:select>

//controller代码
@ModelAttribute("roles")
public ROLE[] roles() {
     return ROLE.values();
}
```
这种做法相当于在controller中声明了一个变量，在view中可以直接以${name}的方式使用。

### ASP.NET MVC

```csharp
//view代码
<%
    using (Html.BeginForm("Create", "Product", FormMethod.Post)) { %>
      <%= Html.TextBox("title") %>
      <%= Html.TextBox("description") %>
   <input type="submit"/>
<% } %>

//controller代码
[AcceptVerbs(HttpVerbs.Post)]
public ActionResult Create(Product product)
{
    service.save(product);
    return RedirectToAction("list");
}
```

这里在View中的Binding是通过DefaultModelBinder来实现的。它先查找是否有设定prefix，如果有的话就查找prefix.property，如果没有的话，就直接查找property。这里直接查找property。这也是因为在controller中的Create方法设定了Product参数，如果参数为空，则不会做任何binding。

另一种banding是使用ViewData对象，这是ASP.NET MVC Controller提供的内置对象，类似于数组，可以在controller中赋值，在view中取用。另外，如果view继承自ViewPage<Model>

```csharp
<%@ Page Title="" Language="C#" MasterPageFile="/product.aspx" Inherits="System.Web.Mvc.ViewPage<Product>" %>
```

则可以直接使用Model来获取数据，Model是ViewData的内置对象。

可以看出，三种框架在Data Binding中，共同点就是都注重Name Convention，这也当前发展的趋势吧。
