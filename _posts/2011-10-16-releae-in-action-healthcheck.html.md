---
title: 软件发布实战 -- 状态检查
category: 工作
tags:
- Release
- Integration
- Feedback
- Health Check
date: 2011-10-16
---
当前项目的发布周期是两个星期,指的是总共6,7个项目一起发布。从第一天code cut，经历如下的过程：![deploy](deploy.png)
总共三个阶段，每次发布上去以后各个项目都要进行回归测试，发现bug就需要打tag，重新经过QA环境。

如果每次环境保持比较稳定，比如发布的操作系统，部署方式都没有改变，那基于已有稳定cloud环境保证的基础上，不会打太多tag。

但是我们就经历了上面两种方式的变化。系统从Debian改为CentOS，部署方式从同一个appliction变为两个application，同一台VM， 进而变为两个application，两个VM。这一次，在很短的时间里tag的数量就飙升到20。

在如此紧密的发布，这么多的小版本中，如何快速完成下面两个检测呢？

* 快速查看发布了正确的版本。可以点击查看当前版本中更新的内容，但显然这需要记住每个tag更改的内容，在tag较多团队太多时不实际。</li>
* 快速查看基础架构(比如数据库连接)运行良好。运行测试可以做到，但依然效率太低。</li>

Live Version和Health Check可以实现这一点。

1、Live Version

也就是显示当前运行的版本。Rails中默认显示index页面，我们可以将这个页面稍作改变，以支持版本显示。

```erb
#live_version.html.erb
<!DOCTYPE html>
<html>
  <head>
    <meta name="package-git-sha" content="<%= package_git_sha %>">
    <title>Version: <%= package_version %>, <%= package_git_sha %></title>
  </head>
  <body><%= package_version %></body>
</html>
```

```ruby
#version task
task :version do
  write_version_file("live_version.html.erb", "public/live_version.html")
  write_version_file("live_version.yml.erb", "live_version.yml")
end

#get version from jenkins
def package_version_label
  build_id = ENV['BUILD_NUMBER'] || 'dev'
  "1.#{build_id}"
end
```

最上面是显示版本的页面模板, 默认的index链接到这个模板。下面是rake task, 当package整个应用时将给version具体的信息。其中用到了[Jenkins Parameter](https://wiki.jenkins-ci.org/display/JENKINS/Parameterized+Build)的属性。这样当访问应用的根目录时会显示程序的版本信息， 实现中， 如果是普通提交构建，版本会使用时间戳，如果是Tag版本构建，会显示Git tag+ Build number+ App name的格式。

2、Health Check

它的作用在于快速显示程序的基本状态，比如数据库链接是否正常。我们使用了heartbeat和status两种:
* Heartbeat: 当一切正常返回OK。通常在发布过程中发布了一个应用后都会去检查Hearbeat是否正常。如果异常，将使用status来查看细节。
* Status：显示每个连接的具体状态，仅在Heartbeat异常时帮助定位。

发布的过程并不需要每个分支去测试，因为基本的功能实现有各种单元测试和集成测试，所以这种状态信息的快速反馈十分必要，这是加快发布的重要一环。