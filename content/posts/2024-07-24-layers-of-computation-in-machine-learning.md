---
title: Layers of Computation in Machine Learning
post: 2024-07-24-layers-of-computation-in-machine-learning.md
date: 2024-07-24T05:41:41+0800
tags: [[]]
---
This is my thought about the layers of computation in Machine Learning while [porting The Little Learner to Gleam](https://github.com/nohzafk/the_gleam_learner).

1. **Bit-Level Representation**: At the lowest level, data is stored as bits in memory. However, direct manipulation at this level is rarely necessary in modern ML. I learned how flat binary tensors are represented in memory and how to manipulate bit arrays for performing arithmetic operations on tensors.
2. **Arithmetic Operations**: Higher-level abstractions allow for operations on tensor objects without manual bit manipulation. These tensors represent multi-dimensional arrays of numbers, which can be integers or floating-point values. A important concept is that how the operations are extended to apply to tensors of certain shapes, rather than just apply to numbers.
3. **Automatic Differentiation**: This layer use a dual data structure `#(tensor, link)` to connect a tensor with its generating function. This structure is crucial for backpropagation, where gradients are computed via the chain rule. Nodes in the graph represent operations, while edges represent tensors flowing between operations.
4. **Differentiable Data and Model Parameters**: A tensor, by nature of its operations and structure, is differentiable. Any list or sequence of tensors adhering to the operations defined is also differentiable. At the top of the computation tier, differentiable data (which generally represent model parameters) are passed to gradient descent or other optimization functions. These are updated during training using optimization algorithms based on gradients calculated through the lower layers.