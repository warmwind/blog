---
title: Box2D--Physics Engine
pubDatetime: 2011-04-17T00:00:00+08:00
description: Box2D--Physics Engine
slug: box2d-physics-engine
---
[Demo](/apps.html#angry_tank)

Box2D是一个强大的物理引擎(Physics Engine)，有c++, java, js等多种版本。当前流行的Angry birds游戏就使用它作为物理引擎。Wikipedia中给出的定义是：
> A <a href="http://en.wikipedia.org/wiki/Physics">physics</a> engine is <a href="http://en.wikipedia.org/wiki/Computer_software">computer software</a> that provides an approximate <a title="Computer simulation" href="http://en.wikipedia.org/wiki/Computer_simulation">simulation</a> of certain simple <a title="Physical system" href="http://en.wikipedia.org/wiki/Physical_system">physical systems</a>, such as <a href="http://en.wikipedia.org/wiki/Rigid_body_dynamics">rigid body dynamics</a>(including <a href="http://en.wikipedia.org/wiki/Collision_detection">collision detection</a>), <a href="http://en.wikipedia.org/wiki/Soft_body_dynamics">soft body dynamics</a>, and <a title="Fluid simulation" href="http://en.wikipedia.org/wiki/Fluid_simulation">fluid dynamics</a>, of use in the <a title="wikt:domain" href="http://en.wiktionary.org/wiki/domain">domains</a> of <a href="http://en.wikipedia.org/wiki/Computer_graphics">computer graphics</a>, <a title="Video game" href="http://en.wikipedia.org/wiki/Video_game">video games</a> and <a href="http://en.wikipedia.org/wiki/Film">film</a>. Their main uses are in video games (typically as <a title="Game middleware" href="http://en.wikipedia.org/wiki/Game_middleware">middleware</a>), in which case the <a title="Simulation" href="http://en.wikipedia.org/wiki/Simulation">simulations</a> are in <a title="Real-time computer graphics" href="http://en.wikipedia.org/wiki/Real-time_computer_graphics">real-time</a>. The term is sometimes used more generally to describe any <a href="http://en.wikipedia.org/wiki/Software_system">software system</a> for simulating physical phenomena, such as <a title="High-performance computing" href="http://en.wikipedia.org/wiki/High-performance_computing">high-performance scientific simulation</a>.

近期为了给Tankcraft做spike，实现了一个简单的坦克，包括的功能有：

* 左右键控制坦克前后移动
* 上下键调整炮筒的角度
* 空格键发射炮弹，根据炮筒角度不同炮弹运行的抛物线也不一样
* 当运行到有坡度的地面时，坦克整体布局不发生改变
		
<!-- tank.jpg image was not available in original blog -->

其中关键技术点包括：

Body:

在Box2D中，整个界面成为一个World，World中可以创建多个不同的Body，Body可以具有质量，摩擦力，位置，形状等等属性。例如上图中坦克的底座，操作舱，轮子，炮筒，炮弹，斜坡，四周方框都是Body。Body共有三种：

* staticBody：不能有任何移动和变化。例如，四周方框和斜坡
* dynamicBody: 可以任意移动变化。除过方框和斜坡外的其余部分都是这种类型
* kinematicBody：通常用于给定初始速度后可以移动的物体

Body Joint:

多个Body之间可能毫无关系，也可能紧密结合，Body Joint就是用来处理不同Body之间关系的一个对象。共有9种Joint：

* Distance Joint
* Friction Joint
* Gear Joint
* Line Joint
* Mouse Joint
* Prismatic Joint
* Pulley Joint
* Revolute Joint
* Weld Joint

有一篇blog对joint讲解的非常详细：[](http://blog.allanbishop.com/box2d-2-1a-tutorial-part-2-joints/)，这里不再详述每种joint的适用场景。只简单列举用到的两种：

* Weld Joint: 这应该是最简单最直接的一种连接，就是将两个Body绑定在某个点上。例如操作舱和坦克底部，它们彼此绑定而且没有相对移动。

	```js
	joint = new b2WeldJointDef;
	var car_body_position = car_body.GetPosition()
	joint.Initialize(car_body, car_head, new b2Vec2(car_body_position.x - 50/30, car_body_position.y));
	world.CreateJoint(joint)
	```

* Revolute Joint：这种方式是用来处理两个Body之间旋转的一种连接，例如车轮和底座之间，以及炮筒与操作舱之间。

	```js
	var joint = new b2RevoluteJointDef;
	var joint_point = new b2Vec2(car_head.GetWorldCenter().x + 25/30, car_head.GetWorldCenter().y)
	joint.Initialize(gun, car_head, joint_point);
	joint.enableLimit = true;

	joint.referenceAngle = 20 * Math.PI / 180
	gun_joint = world.CreateJoint(joint)
	```

	这里定义了在Joint时两个Body的初始角度差。另外要特别注意的就是，定义的joint\_point是car_head的最后端，而gun的Position一定要根据car_head的Position设置正确，保证gun的最左端与joint\_point重合，否则无法实现合理的绕joint_point旋转的效果！
* ApplyImpulse:
	这个用来给发出的炮弹初始速度以及角度。由于炮弹必须要沿着炮筒的方向，所以需要理解这个方法的参数含义，并且考虑几个关键点坐标来计算。

	```js
	var bulletDef = new b2BodyDef;
	bulletDef.type = b2Body.b2_dynamicBody;
	fixDef.shape = new b2CircleShape(
	    4/30
	);
	fixDef.friction = 4
	fixDef.density = 2
	fixDef.filter.groupIndex = 1;
	var gun_joint_position = gun_joint.GetAnchorA()
	bulletDef.position = new b2Vec2(2 * gun.GetPosition().x - gun_joint_position.x,  2 * gun.GetPosition().y -  gun_joint_position.y);
	var bullet=world.CreateBody(bulletDef);
	bullet.CreateFixture(fixDef);

	bullet.ApplyImpulse(new b2Vec2(gun.GetPosition().x - gun_joint_position.x, gun.GetPosition().y - gun_joint_position.y), gun_joint_position)
	```

以下是一些有用的链接：

* [http://www.box2dflash.org/docs/2.1a/reference](http://www.box2dflash.org/docs/2.1a/reference)
* [http://www.box2d.org/manual.html](http://www.box2d.org/manual.html)
* [http://blog.allanbishop.com/box2d1a-tutorial-part-2-joints](http://blog.allanbishop.com/box2d1a-tutorial-part-2-oints)
* [http://www.box2d.org/index.html](http://www.box2d.org/index.html)
