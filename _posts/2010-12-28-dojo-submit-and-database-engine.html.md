---
title: Dojo submit and Database Engine
category: PROGRAMMING
tags:
- dojo
- InnoDB
- maven
- MyISAM
- mysql
- ssh
date: 2010-12-28
status: publish
type: post
published: true
meta:
  _edit_last: '1'
  _wp_old_slug: ''
---
今天给前面纯javascript写的Magic Grid增加一个排行的功能，也就是在玩家完成游戏后，可以输入姓名并提交，可以查看当前排名Top10的玩家名称和分数。

功能上并不复杂，不过当前工作的项目是J2EE的，那么就使用相关的技术来实现这个小功能：SSH+MySql+Maven。

整个过程中遇到了两个问题印象比较深刻。

### 使用Ajax提交结果

Struts常用的Ajax插件有下面几种：
> 
  * *Ajax Parts* The [AjaxParts Taglib (APT)](http://code.google.com/p/struts2ajaxpartstaglibplugin/) is a component of the Java Web Parts (JWP) project [http://javawebparts.sourceforge.net](http://javawebparts.sourceforge.net/) that allows for 100% declarative (read: no Javascript coding required!) AJAX functionality within a Java-based webapp.
  * *Dojo* The [Ajax Tags Dojo Plugin](http://struts.apache.org/2.0.14/docs/ajax-tags.html) was represented as a theme for Struts 2.0. For Struts 2.1, the Dojo tags are bundled as a plugin.
  * *YUI* The [Yahoo User Interface (YUI) Plugin](http://cwiki.apache.org/S2PLUGINS/yui-plugin.html)has only a few tags are available so far, but the YUI tags tend to be easier to use than the Dojo versions.

对我这个只是提交的小应用来说，几种都差不多，网上似乎关于Dojo的例子不少，所以选用了struts-dojo-tags。使用起来也非常简单，


1. 在pom.xml中加入依赖

  ```xml 
  <dependency>
         <groupId>org.apache.struts</groupId>
         <artifactId>struts2-dojo-plugin</artifactId>
         <version>2.2.1</version>
   </dependency>
   ```

2. 在jsp文件头部添加下面一行语句

  ```php
  <%@ taglib prefix="sx" uri="/struts-dojo-tags" %>
  ```

下面是我第一次写的用来提交的表单代码

```xml
<s:form action="submit" method="post" theme="simple">
  <sx:div id="rank">
      <s:label value="Input your name: " for="rankBean.name"/>
      <s:textfield key="rankBean.name"/>
      <s:hidden key="rankBean.score"/>
      <img id="loadingImage" src="images/loading.gif" style="display:none"/>
      <sx:submit targets="rank" showLoadingText="false" indicator="loadingImage"/>
  </sx:div>
</s:form>
```

sx:submit设定了用来接收响应的元素是id为rank的div，在得到响应之前显示一个loading image。
这个“照搬”Struts网站上关于[Dojo submit](http://struts.apache.org/2.0.14/docs/dojo-submit.html)使用的代码看似没有问题，但是很tricky的是每次点击submit按钮都会同时发送两个相同的post请求。
纠缠了很久才发现，我使用的并不正确，其中id为rank的div不能使用sx:div, 而只要改为struts本身提供的s:div便只会发送一个请求了。

但是现在仍然还不知道这样解决的原因何在，网上只找到了一篇相关的blog，只有一个评论──“won't fix”。有待后续找到答案，也诚恳希望有相关经验的同志们给予答复。

###Database Engine
在Spring框架内写Hibernate的测试，利用Spring的Transaction机制，可以方便的保持测试数据的整洁。
测试代码如下

```java
<pre class="brush:java">@TransactionConfiguration(transactionManager = "transactionManager", defaultRollback = true)
@Transactional
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(locations = {"../config/applicationContextForTest.xml"})
public class HibernateRankDaoTest {

    @Autowired
    private SessionFactory sessionFactory;
    @Autowired
    private HibernateRankDao rankDao;
    private Rank rank;

    @Before
    public void setUp() throws Exception {
        rank = RankUtil.defaultRank();
        rankDao.saveOrUpdate(rank);
    }

    @Test
    public void should_update_rank(){
        Rank saved = rankDao.get(rank.getName());
        saved.setScore(200);
        rankDao.saveOrUpdate(saved);
        Rank result = rankDao.get(rank.getName());
        assertEquals(saved.getId(), result.getId());
        assertEquals(200, result.getScore());
    }
}
```
测试功能也非常简单直接，但是无论如何也无法在执行完测试后rollback所有的数据。尝试了各种Spring和Hibernate的配置，都没有作用。
最后发现，问题其实是Mysql数据库本身。Mysql默认使用的engine是MyISAM,而它是不支持Transaction的！改成InnoDB，就一切OK了。
关于InnoDB与MyISAM比较，可参考
[http://www.mikebernat.com/blog/MySQL_-_InnoDB_vs_MyISAM](http://www.mikebernat.com/blog/MySQL_-_InnoDB_vs_MyISAM)
