---
title: 为什么Turbolinks发送了两次请求
date: 2015-01-22
tags: [Turbolinks, Rails]
category: 技术
---
前面有一篇文章介绍过使用[Turbolinks](/blogs/2013/02/28/turbolinks-make-form-resubmissioin.html)遇到的一个问题，最近又发现了另一个问题。

开发时，tail后台的log会发现某些情况下，同一个请求会触发两次，不过因为都是get请求，而且同一个地址请求后的响应式相同的，所以前台不能完全察觉到。不够下面的场景跟预期就不一致了。

假设需要一个功能可以在后台管理页面禁止用户账户，被禁止的账户在随后的所有访问当会重定向到禁止页面。

从实现上来讲，当判断出用户的禁用状态后，就会清除他的登录session，然后重定向到禁止页面。但是现象是用户会直接跳转到登录页面，当重新登陆后，则看到禁止页。查看后台就发现同一个地址请求了两次，第一次清除了session，第二次再访问因为没有session就转向到登陆页面了。

当然这种问题看看源码就清楚了，从Turbolinks的代码可以看出，在三种情况下，Turbolinks会尝试第二次请求同一个url。

* response的状态吗在400到600之间
* response header的content-type不匹配 /^(?:text\/html|application\/xhtml\+xml|application\/xml)(?:;|$)/
* 新页面的assets有变化,并且```data-turbolinks-track```为true时

```coffee
processResponse = ->
  clientOrServerError = ->
    400 <= xhr.status < 600

  validContent = ->
    (contentType = xhr.getResponseHeader('Content-Type'))? and
      contentType.match /^(?:text\/html|application\/xhtml\+xml|application\/xml)(?:;|$)/

  extractTrackAssets = (doc) ->
    for node in doc.querySelector('head').childNodes when node.getAttribute?('data-turbolinks-track')?
      node.getAttribute('src') or node.getAttribute('href')

  assetsChanged = (doc) ->
    loadedAssets ||= extractTrackAssets document
    fetchedAssets  = extractTrackAssets doc
    fetchedAssets.length isnt loadedAssets.length or intersection(fetchedAssets, loadedAssets).length isnt loadedAssets.length

  intersection = (a, b) ->
    [a, b] = [b, a] if a.length > b.length
    value for value in a when value in b

  if not clientOrServerError() and validContent()
    doc = createDocument xhr.responseText
    if doc and !assetsChanged doc
      return doc


fetchReplacement = (url, onLoadFunction, showProgressBar = true) ->
  triggerEvent EVENTS.FETCH, url: url.absolute

  xhr?.abort()
  xhr = new XMLHttpRequest
  xhr.open 'GET', url.withoutHashForIE10compatibility(), true
  xhr.setRequestHeader 'Accept', 'text/html, application/xhtml+xml, application/xml'
  xhr.setRequestHeader 'X-XHR-Referer', referer

  xhr.onload = ->
    triggerEvent EVENTS.RECEIVE, url: url.absolute

    #在这里会判断response是否会返回doc body，如果为空，则直接在浏览器再请求一次该url
    if doc = processResponse()
      reflectNewUrl url
      reflectRedirectedUrl()
      changePage extractTitleAndBody(doc)...
      manuallyTriggerHashChangeForFirefox()
      onLoadFunction?()
      triggerEvent EVENTS.LOAD
    else
      document.location.href = crossOriginRedirect() or url.absolute

```


