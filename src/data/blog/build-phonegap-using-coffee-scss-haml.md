---
title: Build Phonegap Application using CoffeeScipt Scss and Haml
pubDatetime: 2013-06-04T00:00:00+08:00
description: Build Phonegap Application using CoffeeScipt Scss and Haml
slug: build-phonegap-using-coffee-scss-haml
category: 技术
tags:
  - PhoneGap
  - CoffeeScript
---
Refer to [phonegap-scaffold](https://github.com/warmwind/phonegap-scaffold)

[PhoneGap](http://phonegap.com/) is a tool that allows developer to build cross platform mobile native application using javascript, html and css. 

This is great, however, the raw js, html and css is outdate. There are plenty of techniques that can be used to improve the efficiency. For example, 

* [CoffeeScript](http://coffeescript.org/) for javascript
* [Haml](http://haml.info/) for html
* [Scss](http://sass-lang.com/) for css


All of these "new" tech have clear syntax and can be easiliy compiled to raw files.

For development purpose, we also need:

* Autocompile to raw files
* Rake tasks to run test. Jasmine for JavaScript
* Different urls for different environment. (developement, uat, production, etc)
* Rake tasks to deploy app to simulators for quick look
* Ajust styles in browser, no need to deploy each time

So I create a repo in github called [phonegap-scaffold](https://github.com/warmwind/phonegap-scaffold). 