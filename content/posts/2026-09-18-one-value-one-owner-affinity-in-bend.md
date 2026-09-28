---
title: "One Value, One Owner — Reading Bend Through Affinity"
post: 2026-09-18-one-value-one-owner-affinity-in-bend.md
date: 2026-09-18T09:31:47+0800
tags: [bend, programming, types]
---

Bend 2 is a new programming language. It looks like Python, behaves more like Haskell, and tries to combine three things that rarely go together: proofs checked at compile time, C-like speed, and parallelism across CPU threads and GPUs from one source. Its guide is candid about the goal: to give people "an ambiguity-free language to communicate their intents to AIs", with a compiler that checks the result mechanically.

While learning it I wrote a short book, *Bend 2, from zero* (<https://nohzafk.github.io/bend2-from-zero/>), where every claim comes with code you can run. Early on I wrote down a sentence I didn't yet understand:

> Affinity is the first key to understanding everything in Bend.

That is the kind of line that sounds deep and means nothing, so I tested it. I installed Bend 2.0.5, wrote small programs to see what the rule actually enforces, and then reread the language through it.

The line held up. Bend advertises three things:

- no garbage collector
- parallelism without locks
- proofs that cost nothing at runtime

They look like three separate pieces of engineering. They turned out to be three consequences of one rule about who owns a value. This post is about that rule, what it costs, and where it parts ways with Rust, which is where most programmers have met the word "affine" before.

## Where the word comes from

"Affine" isn't Bend's word. It comes from logic, from the question of what you may do with an assumption once you have it.

A proof can treat an assumption (a variable) in three ways, known as the **structural rules**:

| Rule | Meaning |
|---|---|
| **weakening** | you may *drop* an assumption without using it |
| **contraction** | you may *duplicate* an assumption and use it twice |
| **exchange** | you may *reorder* assumptions |

Ordinary languages allow all three, which is why nobody thinks about them. In 1987 Girard removed weakening and contraction and got **linear logic**, where every assumption is used exactly once. Systems that drop some of these rules are called **substructural type systems**; the standard reference is David Walker's chapter of that name in *Advanced Topics in Types and Programming Languages* (MIT Press, 2005).

Putting rules back one at a time gives a family, and each member has a name:

```
exactly once   linear
at most once   affine       ← Bend is here, and so is Rust
at least once  relevant
any number     unrestricted ordinary languages
```

Affine is linear plus weakening, nothing more. So Bend's default fits in one sentence:

> **A value may be used at most once.**

"At most" is not a loose way of saying "exactly". It is the whole difference between affine and linear, and it can be tested.

## The rule counts paths, not occurrences

This is the program that made it click for me. `x` appears twice in the source:

```python
import Base

def describe(c: Bool, x: U32) -> U32:
  match c:
    case True{}:
      (x + 1 : U32)
    case False{}:
      (x + 2 : U32)

def main() -> U32:
  describe(True{}, 10)
```

```
11
```

It compiles, because the checker counts uses **per execution path**, not per occurrence in the text. Any run takes one branch, so on every path `x` is used once.

Two uses on the same path are refused, with a refreshingly direct message:

```python
import Base

def main() -> U32:
  x = {3 : U32}
  (x + x : U32)
```

```
Error:
- expected : x
- observed : x (consumed more than once)
```

And the part people get wrong: **not using a value is fine.**

```python
def main() -> U32:
  x = {3 : U32}   # never used
  7
```

```
7
```

In a linear language this would be an error. Weakening is what makes an unused value legal, and, as we'll see, it is also what makes destroying a value free.

## Two annotations: quantity on the variable, kind on the type

Two different annotations are involved, and mixing them up cost me three failed experiments. One goes on the variable, the other on the type.

**Quantity** goes on the variable:

```
-x     erased      visible to the checker, deleted by the compiler
x      affine      the default, at most once
+x     reusable    may be used many times, at the cost of a reference count
```

**Kind** goes on the type declaration:

```
Type = Kind(&1)    at most once  — things with identity
Data = Kind(&2)    copyable      — things without
```

`+` is the escape hatch. It isn't free, since `+x` makes the value reference-counted, and it isn't always available: **it requires the type to be `Data`**. You can only copy what can be copied. Ask for it on a `Type`:

```python
def main() -> U32:
  +a = [0 : U32*4n]
  (a[0] + a[1] : U32)
```

```
Error:
- expected : Data
- observed : Type
```

`Array` is a `Type`, so it can never be `+`. `List` is `Data`, and the same kind of program passes:

```python
def main() -> Nat:
  +xs = {[1, 2, 3] : +List<U32>}
  Nat.add(List.length(&2, U32, xs), List.length(&2, U32, xs))
```

```
6n
```

(The `&2` passes the quantity to `List.length` explicitly. Bend puts the count in the type rather than inferring it.)

Which types are `Type`, then? In the `Base` library, 13 types are `Data` and only 3 are `Type`:

```
Array      a block of mutable memory
IO.OP      an I/O operation
App        an application / window state
```

All three have an identity. Copying a block of mutable memory would break the in-place update that makes arrays usable in a pure language. Copying an I/O handle would counterfeit a resource. Copying an application state would fork a window. Copying a `List<U32>` just copies a structure, and the two copies can't interfere with each other. That is the entire reason `+List<U32>` is legal and `+Array<U32>` isn't.

## What an array read returns

The in-place guarantee is where affinity stops being abstract and starts shaping syntax. Reading an array consumes it, so a read can't return just the element; the array would be gone. It returns both:

```python
def main() -> Array<U32> & U32:
  a = [0 : U32*8n]
  a[5] <- 42       # an in-place rewrite, not a copy
  a[5]             # returns the array AND the element
```

```
([0, 0, 0, 0, 0, 42, 0, 0], 42)
```

You get the array back, with the write in it, and the element beside it.

`Array<U32> & U32` is sugar for a `Sigma`, a dependent pair. Bend only lets you open one where it was handed to you, as a parameter or a field, never at a local binding. So either give the code its own def, or use the two projections `Base` already provides:

```python
def main() -> U32:
  a = [0 : U32*8n]
  a[5] <- 42
  b = Pair.fst(Array<U32>, U32, a[5])   # the array half, write intact
  Pair.snd(Array<U32>, U32, b[5])       # the element half
```

```
42
```

`Pair.fst` and `Pair.snd` are one-line defs whose parameter is a pair, which is exactly the shape the rule asks for. The general pattern: whenever you read from a `Type`, the thing you read from comes back alongside the value, and a function parameter is where you take the pair apart.

## Three selling points, one rule

The guide covers speed, parallelism and proofs in separate chapters, but each follows from "one value, one owner", and the guide says so in passing.

### No garbage collector

From the guide:

> There is no garbage collector. Since values are affine, a `match` frees the node it opens on the spot, and only `+` values carry a reference count.

With a single owner, opening a node with `match` can free it immediately, because nobody else can be holding it. And because the logic is affine rather than linear, a value that is never used can simply be dropped. This also explains a rule that looks like style: in Bend you destructure with `match` rather than reaching for fields. That isn't an idiom. It is the language's memory management.

### Parallelism you don't have to justify

A parallel call is an ordinary assignment: two calls on the right, two names on the left. Here it is doing real work:

```python
import Base

def pow2(+n: Nat) -> U32:
  match n:
    case 0n:
      1
    case 1n+p:
      a b = pow2(p) pow2(p)
      (a + b : U32)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print(U32.show(pow2(10n)))
```

```
1024
```

The two calls run as two tasks and are joined by the assignment. Both read `p`, the predecessor bound by `case 1n+p`, which is only legal because `+n` makes it reusable. Remove the `+` and the line is refused with the error from earlier: `expected : p`, `observed : p (consumed more than once)`.

The guide describes the contract like this:

> A parallel call promises the compiler two things: 1. The calls are independent. 2. They run in roughly the same time.
>
> **Since Bend is pure and affine, the first point always holds.** The second is yours to keep.

This split is my favourite thing in the language. You never assert or prove that the two calls don't interfere. The ownership rule already guarantees it: a second reference to a value can't be written, so there is nothing to alias and nothing to race. What's left for you is load balancing, which really does need a human.

Put the other way round: **in Bend you cannot write the racy program.** For both sides of a parallel call to touch one array, the array would have to be reusable, and we've already seen that refused, because of its kind. The compiler doesn't warn you about the race; there is no program to warn about.

### Proofs that vanish at runtime

The `-x` quantity marks an *erased* variable:

> Erased variables can only appear in types and proofs: the checker sees them, the compiler deletes them.

Proofs live entirely in the checker's view of the program and are gone by the time it runs. That is how Bend can promise "fast *and* provable" without it being a trade-off.

## The price, and where Bend differs from Rust

Rust has affine types too: a moved value is affine, and use after move is a compile error. But the two languages pay for the property in very different ways, and this is the comparison I wish I'd had before writing any Bend.

**Rust adds borrowing on top.** Ownership stays single, but `&x` gives you a temporary second viewer, and lifetimes make sure the view ends before the value does. It is a lot of machinery, and it buys the ordinary experience: pass a reference, use it, keep your value.

**Bend has no borrowing.** The word "borrow" appears nowhere in the guide; "affine" appears nine times. There is no `&x` and no lifetime. A function argument is consumed by default: after `f(xs)`, `xs` is gone.

| | Rust | Bend 2 |
|---|---|---|
| default | affine (move) | affine |
| use it temporarily | `&x`, restored when the borrow ends | no such concept |
| use it more than once | `.clone()`, or restructure ownership | `+x`, a reference count |
| exists only for the type checker | `PhantomData`, zero-sized types | `-x`, erased |

That leaves you two choices for any value, consume it or reference-count it, and you have to say which. The guide admits the cost openly:

> Bend does almost no inference, meaning it requires more annotations than similar languages. This is what allows Bend's checker to be significantly faster than other provers, and its error messages more precise, at the expense of programs and proofs being more verbose.

The verbosity is real, not cosmetic. But the rule also produced the result that changed how I see the design. Closures in Bend are affine and **cannot** be given `+`:

```python
def main() -> U32:
  +f = {x => (x + 1 : U32) : U32 -> U32}
  (f(1) + f(2) : U32)
```

```
Error:
- expected : Data
- observed : Type
```

A closure is a `Type`, so even one that captures nothing can't be copied. At first this looks like a restriction you have to work around.

Bend's answer is a **template parameter**, written `~f`, which substitutes its argument at compile time:

```python
# ~f: substituted at compile time, not passed at runtime
def twice(~f: U32 -> U32, x: U32) -> U32:
  f(f(x))
```

Inside `twice`, `f` isn't a value being passed around; it is code being substituted. In the guide's words:

> Each distinct set of `~` arguments compiles to its own copy of `twice`, so `f` costs nothing at runtime and, unlike a closure, may be called as many times as you like.

So "a closure can't be copied" doesn't lead to "write more code". It leads to "inline the function", which is faster than the function pointer you'd otherwise have used. A restriction in the type system turns into an optimisation at runtime. `List.map` is written this way.

## In one sentence

> **Affinity means a value is consumed at most once, on any execution path.**

That single rule gives you memory management without a collector, because the one use can free the value on the spot. It gives you parallelism without locks and without proof obligations, because two owners can't be expressed. And erasure on top of it gives you proofs with no runtime cost.

The price is that there is no borrowing, so a value is either consumed or reference-counted, and you have to annotate which.

That is why I call it the first key. Not because it is Bend's most important feature, but because Bend doesn't really have three features. It has one, and the others follow from it. Once you accept "one value, one owner", most of the language stops being surprising, including the annoying parts.
