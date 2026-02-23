---
title: Box2D-Post Collision Detection
pubDatetime: 2011-06-01T00:00:00+08:00
description: Box2D-Post Collision Detection
slug: box2d-post-collision-detection
category: 技术
tags:
  - Box2D
  - Collision Detection
  - Physics Engine
---
[Demo](/apps.html#angry_tank)

在检测到碰撞后，我们往往需要进行一些处理，比如在Angry Birds中当小鸟撞击到障碍或者击中猪后，会有碰撞的声音，破碎的效果等，这些都是在碰撞检测后进行处理的。

<!-- Image not available: collison.jpg -->

如上图，坦克发出的炮弹击中了空中飞行的物体，之后炮弹消失，物体旋转下落。

实现的代码如下

```js
var contactListener = new Box2D.Dynamics.b2ContactListener;
contactListener.BeginContact = function(contact) {
   var bullet = contact.GetFixtureB().GetBody();
   var fly = contact.GetFixtureA().GetBody()
   var fly_data = fly.GetUserData()
   if(bullet.GetUserData() == "bullet" && fly_data != null &amp;&amp; fly_data.indexOf("fly") != -1){
       trace("bullet collision detected");
       bullet.SetUserData("dead")
       fly.SetLinearVelocity(new b2Vec2(0, 3))
       fly.SetAngularVelocity(2)
    }  
 };
 ```

Box2D中Body拥有一个userData属性，可以在里面存储任何数据。当引擎检测到碰撞时，就会回掉上面的函数，此时可以使用userData中存储的数据来判断碰撞的对象。对于上面的效果，首先根据userData判断出子弹和物理，然后设置炮弹的userData为dead，以及给飞行物体设置新的线速度和角速度。这样飞行物体就会改变飞行状态，而在下一次的界面update操作中可以destroy所有dead的物体。

这里需要注意的是不能直接在回掉函数中destroy body，box2D不允许这样做，原因是body可能用于与其他物体的碰撞检测中。所以只能在回掉函数中记录需要destroy的物体并且在更新函数中销毁。
