### Batch Normalization<sup>[[1]](https://mp.weixin.qq.com/s/rYAZgkpvcI6t_Lcdyyxgrg)</sup>
在训练过程中，当我们更新之前的权值时，每个中间激活层的输出分布会在每次迭代时发生变化。这种现象称为内部协变量移位(ICS)。所以很自然的一件事，如果我想防止这种情况发生，就是修正所有的分布。简单地说，如果我的分布变动了，我会限制住这个分布，不让它移动，以帮助梯度优化和防止梯度消失，这将帮助我的神经网络训练更快。因此减少这种内部协变量位移是推动batch normalization发展的关键原则。
- 替代方法
  - Layer Normalization
  - Instance Normalization
  - Group Normalization (+ weight standardization)
  - Synchronous Batch Normalization

