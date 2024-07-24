---
title: using record as dict key in Gleam
post: 2024-07-25-using-record-as-dict-key-in-gleam.md
date: 2024-07-24T17:55:52+0800
tags: [erlang, gleam, uuid]
---
# Records in Gleam: Comparison and Uniqueness

## Record Comparison

In [[Gleam]], records are compared by value (deep nested comparison), which can present challenges when using them as dictionary keys, unlike in some other functional languages.
#### Records are Compared by Value

It's important to note that Gleam doesn't have objects in the traditional sense. All data structures, including records, are compared by value. This means that two records with identical field values will be considered equal.

To make a record unique, **an additional identifier field is necessary.** This approach allows for distinguishing between records that might otherwise have the same content but represent different entities.
## Ensuring Uniqueness

### Simple Approach: UUID Field

One straightforward method to ensure record uniqueness is to add a UUID field. However, UUID strings can be memory-intensive and cpu-costly.

### Improved Approach: Erlang Reference

A more efficient alternative is to use an [[erlang reference]] as a unique identifier for records.

Erlang references are unique identifiers created by the Erlang runtime system. They have several important properties:

1. Uniqueness: Each reference is guaranteed to be unique within an Erlang node (and even across connected nodes).
2. Lightweight: References are very memory-efficient.
3. Unguessable: They can't be forged or guessed, which can be useful for security in some contexts.
4. Erlang-specific: They are native to the BEAM VM, so they work well with Gleam, which runs on this VM.

It's important to note that:
- Erlang references are not persistent across program runs. If you need to save and reload your records, you'll need to implement a serialization strategy.
- References are not garbage collected until the object they're associated with is no longer referenced.

## Example

```rust
import gleam/erlang

pub type TensorId =
  erlang.Reference

pub type Tensor {
  ScalarTensor(value: Float, id: TensorId)
  ListTensor(List(Tensor))
}

pub fn create_scalar_tensor(value: Float) -> Tensor {
  ScalarTensor(value, erlang.make_reference())
}

pub fn create_list_tensor(tensors: List(Tensor)) -> Tensor {
  ListTensor(tensors)
}

pub fn tensor_id(tensor: Tensor) -> TensorId {
  case tensor {
    ScalarTensor(_, id) -> id
    ListTensor(_) -> erlang.make_reference()
  }
}

pub fn tensor_equal(a: Tensor, b: Tensor) -> Bool {
  tensor_id(a) == tensor_id(b)
}
```

```rust
import gleam/dict

pub type GradientMap =
  dict.Dict(TensorId, Float)

pub fn create_gradient_map() -> GradientMap {
  dict.new()
}

pub fn set_gradient(map: GradientMap, tensor: Tensor, gradient: Float) -> GradientMap {
  dict.insert(map, tensor_id(tensor), gradient)
}

pub fn get_gradient(map: GradientMap, tensor: Tensor) -> Result(Float, Nil) {
  dict.get(map, tensor_id(tensor))
}
```