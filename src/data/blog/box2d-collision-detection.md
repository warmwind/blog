---
title: Box2D-Collision Detection
pubDatetime: 2011-06-01T00:00:00+08:00
description: Box2D-Collision Detection
slug: box2d-collision-detection
---
[Demo](/apps.html#angry_tank)

碰撞检测是物理引擎中非常重要的部分，一般分为两种：

* Discrete Collision Detection: 离散碰撞检测。
从实现的角度来说，就是在每TimeStep时刻计算所有当前物体的Contact，由于Box2D处理的都是刚体，这样如果在计算的结果中有overlap的刚体存在，那么这些物体之间必然存在碰撞关系。
* CCD(Continuos Collision Detection): 连续碰撞检测。
与离散检测不同，并不是只在某些时刻检测碰撞情况，而是根据物理学的相关知识，通过当前的速度，加速度，位置，方向等信息计算在每个离散采样时间间隔内的运动轨迹，以轨迹来判断是否存在碰撞。


既然两种方式存在，那么如何选择，他们之间有怎么样的区别呢？

Tunneling

下面的图可以用来揭示部分原因
<!-- Image not available: Physics011.jpg -->
<!-- Image not available: tuneling.jpg -->

第一张图中，假设一个物体以恒定速度从左向右运动，物理引擎分别在t1,t2,t3时刻采样，这样在t2时刻物体处于障碍物前方，而t3时刻位于障碍物右方，这就好像物理穿过了障碍物。这种现象叫做Tunneling，也是离散碰撞检测带来的问题。同样的现象如第二张图，坦克发射的炮弹落在了障碍物的中间，这是因为穿过了前面的物体，而恰好没有穿过后一个。CCD由于计算了物理的运动轨迹，它与障碍物之间就会有交叉，所以不会产生Tunneling现象。

Box2D中，static与dynamic物体之间的以及kinematic与dynamic物体之间都是使用CCD，所以这两类物体之间不会错过任何碰撞。但是dynamic物体之间默认采用离散检测，而将与CCD的控制转换通过Body的bullet属性交给设计者。当此属性为true的时候，就对该物体使用CCD。

除了使用CCD可以消除Tunneling想象外，也可以通过提高采样频率来降低它发生的概率，例如上面的途中，如果将采样频率提高一倍，就恰好可以检测到碰撞。

无论使用何种方式当检测到碰撞后，都需要计算物体发生碰撞的时刻，因为刚体不允许出现overlap，所以需要将物体恢复到发生碰撞的时刻，等待下一次界面更新，渲染碰撞效果。这个第一次碰撞的时间叫做TOI(Time of Impact)。

两种碰撞检测方式的取舍就是性能与精确度的权衡，一般来说可以从下面的角度来考虑：

* CCD非常昂贵。相对于只有固定间隔的离散检测来说，时间变量的引入使引擎的计算工作加大，当物体较多时，影响更为明显。
* CCD应该只用于高速运动的关键物体。比如Angry Birds中发射的小鸟，玩家绝对不能接受小鸟穿过障碍物。
* 不是所有高速物体都要使用CCD，因为往往当物体速度非常块时，我们是希望忽略它的碰撞关系的。
* 不要将CCD应用于在初始位置已经接触的物体。

