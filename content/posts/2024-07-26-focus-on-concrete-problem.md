---
title: focus on concrete problem
post: 2024-07-26-focus-on-concrete-problem.md
date: 2024-07-25T17:47:44+0800
tags: [functional, gleam, racket]
---
I want to share what I've learned while  [porting The Little Learner from Racket to Gleam](https://github.com/nohzafk/the_gleam_learner).  I will compare some Racket code with Gleam.

[Gleam](https://gleam.run) is a simple functional programming language. Checkout this great article why [simple programming language](https://ryanbrewer.dev/posts/simple-programming-languages.html) matters.

The language is so straightforward that an experienced programmer can learn it in just a day or two. However, to truly appreciate its simplicity and constraints, one must have prior experience with complex programming languages and substantial coding practice.

## focus on concrete problem

> It is hard for less experienced developers to appreciate how rarely architecting for future requirements / applications turns out net-positive. {=[John Caremark](https://en.m.wikipedia.org/wiki/John_Carmack)}

Gleam's philosophy is to focus on concrete problem rather than building abstractions.

Consider this Racket code I encountered, it is used in different places for different things.

```lisp
(λ (l . r) l)
```

Although it looks beautiful, this function is overly complex and marking it difficult to understand.

The function behaves as follows:
   - If called with a single list argument, it returns the first element of that list.
   - If called with multiple arguments, it returns the first argument.

however it is never called with more than three arguments in the code base.

Translating this to Gleam result in a more understandable code, with not too much verbosity.

```rust
pub type Shape = List(Int)

pub fn default_shape_fn_1(shape: Shape) -> Shape {
  case shape {
    [] -> []
    [head, ..] -> [head]
  }
}

pub fn default_shape_fn_2(shape: Shape, _: Shape) -> Shape {
  shape
}
```

## [[no hidden complexity]]

Racket provides layers of abstraction like `rename-out` to override operators like `+ - * / > < =` (literally can be anything) when exporting module. This is great for building abstraction to teach concepts or to build another new language/DSL, but such flexibility often comes with maintainability costs and cognitive burden.

The Little Learner provides different implementations for tensors. Functions, and operators that appear identical have different meanings across different tensor implementations. Also operators are overridden, when reading the codebase, I often get confused by operators like `<`, sometimes it compare numbers, other times it compare scalars or tensors, Racket is a dynamic language, without type annotation, checking those functions and operations can be really frustrating and confusing.

While this uniform abstraction layer is beneficial for teaching machine learning concepts, it can be challenging when examining the actual code.

In contrast, Gleam shines with its simplicity and lack of hidden complexities. Everything must be explicitly stated, making the code clean and readable. Additionally, the compiler is smart enough to perform type inference, so you usually don't need to add type notations for everything.