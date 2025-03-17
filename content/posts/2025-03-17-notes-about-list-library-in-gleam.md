---
title: Notes about list library in Gleam
post: 2025-03-17-notes-about-list-library-in-gleam.md
date: 2025-03-17T00:36:27+0800
tags: [gleam, list.max, order.negate]
---
# Gleam language: how to find the min element in a list

**Gleam** language standard library has a [list.max](https://hexdocs.pm/gleam_stdlib/gleam/list.html#max) to find the maximum element in a list, but to my surprise it doesn't provide a counterpart `list.min` function, in order to do that, you have to use compare function with `order.negate`

```rust
import gleam/list
import gleam/int
import gleam/order

pub fn main() {
  let numbers = [5, 3, 8, 1, 9, 2]
  
  // Find the minimum value using list.max with order.negate
  let minimum = list.max(numbers, with: fn(a, b) {
    order.negate(int.compare(a, b))
  })
  
  // Print the result (will be Some(1))
  io.debug(minimum)
}
```

Another noteworthy aspect is that when a list contains multiple maximum values, `list.max` returns the last occurrence of the maximum value. This behavior contrasts significantly with Python's `list.max`, which returns the first occurrence in such cases. I observed this discrepancy while comparing different implementations in both languages.

```rust
  partitions
  |> list.max(fn(a, b) {
    float.compare(a |> expected_entropy, b |> expected_entropy)
    |> order.negate
  })
```

In the code snippet provided, the result will be the last element in the list that has the minimal entropy value.