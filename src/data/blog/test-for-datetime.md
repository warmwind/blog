---
title: Test For DateTime
pubDatetime: 2010-12-08T00:00:00+08:00
description: Test For DateTime
slug: test-for-datetime
category: 技术
tags:
  - DateTime
  - Test
---
在代码中经常遇到在某个方法内部获取当前时间，并对时间进行一定处理。这往往会使测试遇到困难，因为在测试中无法准确获取产品代码内部的当前时间。例如下面的产品与测试代码，

```csharp
public class Product{
    public static Product CreateProduct(string name){
        Product product = new Product();
        product.name = name;
        product.timestamp = DateTime.Now;
        return product;
        }
}
[Test]
public should_generate_a_product_with_given_name(){
    Product product = Product.CreateProduct("book");
    Assert.AreEqual("book", product.Name)
}
```
这个简单的方法，我们只可以验证name属性，而无法对timestamp做测试，如果在测试中也使用DateTime.Now，则很有可能导致这个测试random success，因为产品代码和测试代码所使用的Now已经不是同一时间，在毫秒级别h会有差异。

解决方案有两个：

* 不准确的验证timestamp的值，而只需要保证这个时间在允许的误差范围内，例如

  ```csharp
    Assert.IsTrue(DateTime.Now - product.timestamp &lt; new TimeSpan(0, 0, 1) );
  ```

* 将timestamp的值放在方法签名上作为参数传入。这时方法实现与测试代码将变为

  ```csharp
    public class Product{
        public static Product CreateProduct(string name, DateTime timestamp){
            Product product = new Product();
            product.name = name;
            product.timestamp = timestamp;
            return product;
            }
        }
    [Test]
    public should_generate_a_product_with_given_name(){
        DateTime timestamp = DateTime.Now;
        Product product = Product.CreateProduct("book", timestamp);
        Assert.AreEqual("book", product.Name);
        Assert.AreEqual(timestamp, product.Timestamp);
    }
  ```
在大部分的应用中，对时间没有非常严格的精度要求，所以从代码可测的角度讲，第二种显然更好一些，如果在被测方法内部对时间有更为复杂的处理，那么这种方案的优势会更明显。它让我们对时间可以进行任意设定，有非常灵活的控制。