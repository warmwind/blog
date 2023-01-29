---
title: Validation Refactor -- Command Pattern
category: 技术
tags:
- Command Pattern
- Refactor
- Test
date: 2011-03-17
---
曾经遇到过几次如下的代码

```java
public void validate(Person person, List<String> errors) {
  if (!validateName(person.getName())) {
    return;
  }
  if (!validatateAge(person.getAge())) {
    return;
  }
  if (!validateHeight(person.getHeight())) {
    return;
  }
  System.out.println("Validation Success!");
}
```
这一个Validator中的方法，对Person对象的三个属性进行校验，当某个属性失败时，将错误信息加入errors中，然后停止校验。
这是个简单的例子，可以想象，当对象比较复杂，属性很多时，此方法将会相应增加很多if和return，非常难看。由于每个属性的校验都有return语句，所以无法通过抽取方法来重构。今天米高告诉了一种方案，经过验证，效果不错。
方案如下：

```java
public interface StopableMethod {
  boolean excute();
}

public class Excutor {
  private List<StopableMethod> methods;

  public Excutor(List<StopableMethod> methods) {
    this.methods = methods;
  }

  public void excute(){
    for (StopableMethod method : methods) {
      if(!method.excute()){
        break;
      }
    }
  }
}

public class ValidateName implements StopableMethod {
  private String name;

  public ValidateName(String name) {
    this.name = name;
  }

  public boolean excute() {
    if (name == null) {
        System.out.println("Name invalid.");
        return false;
    }
  return true;
  }
}
```
其中牵扯了三个部分

* StopableMethod:所有验证方法实现的接口
* Excutor：遍历执行所有方法，方法返回false则终止
* ValidateName:校验Name的方法，实现上述接口。每个属性的校验方法都按照这个类实现

重构后调用的代码如下

```java
@Test
public void should_fail_fast_when_validation_error() {
  person.setName(null);
  person.setAge(0);
  List<StopableMethod> methodList = new ArrayList<StopableMethod>();
  methodList.add(new ValidateName(person.getName()));
  methodList.add(new ValidateAge(person.getAge()));
  new Excutor(methodList).excute();
}
```
调用时，将所有验证方法的List传递给Excutor，执行excute即可。这样重构虽然增加了很多validate类，但是每个都很小，测试很简单，而且在测试中互相没有任何影响。

实际上，这是Command Pattern的一种实现，典型的Command Pattern结构如下
![](Command_Design_Pattern_Class_Diagram.png)

其中的对应关系为

* Command：StopableMethod
* Concrete: ValidateName
* Receiver: Person
* Invoker: Excuter
* Client: Test方法

Command Pattern通常应用于以队列或堆栈的形式保存一组命令对象的场景，如：Multi-level undo，Transactional behavior， Progress bars， Wizards， GUI buttons and menu items， Thread pools， Macro recording， Networking， Parallel Processing， Mobile Code。

[From: http://en.wikipedia.org/wiki/Command_pattern](http://en.wikipedia.org/wiki/Command_pattern)
