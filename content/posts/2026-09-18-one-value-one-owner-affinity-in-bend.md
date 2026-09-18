---
title: "One Value, One Owner — Reading Bend Through Affinity"
post: 2026-09-18-one-value-one-owner-affinity-in-bend.md
date: 2026-09-18T09:31:47+0800
tags: [bend, programming, types]
---

**Bend 2 is a new programming language.** Its syntax is Python-shaped, its semantics are closer to Haskell, and it sets out to combine three things that rarely sit together: proofs checked at compile time, C-like speed, and parallelism across CPU threads and GPUs from a single source. The language's own guide states the ambition plainly — to give people "an ambiguity-free language to communicate their intents to AIs", with a compiler that can mechanically check the result. That is the bet, and it does not live in the syntax. I wrote a short book about Bend 2 while learning it — *Bend 2, from zero*, at **https://nohzafk.github.io/bend2-from-zero/** — where every claim comes with code you can run; this post is the one idea from it I keep coming back to.

One claim of mine stood out above everything else — I wrote it down before I understood what it meant:

> Affinity is the first key to understanding everything in Bend.

It reads like a slogan, and slogans are cheap. So rather than read Bend top-down, I decided to learn what **affinity** actually is and then read Bend through it. I installed Bend 2.0.5 and ran nine small programs to find out what the rule really enforces.

It survives. **Affinity is not a feature of Bend; it is the mechanism the rest of Bend is derived from.** The three things Bend sells are:

- no garbage collector
- parallelism without locks
- proofs that cost nothing at runtime

They are not three pieces of engineering. They are three consequences of one rule about who owns a value.

But the interesting part is what the rule *costs*, and where it diverges from Rust, which is where most programmers will have met the word "affine" before.

## Where the word comes from

"Affine" is not a Bend coinage. It comes from logic, specifically from asking what you are allowed to do with an assumption once you have it.

In a proof, an assumption (a variable) can be treated in three ways, called the **structural rules**:

| Rule | Meaning |
|---|---|
| **weakening** | you may *drop* an assumption without using it |
| **contraction** | you may *duplicate* an assumption and use it twice |
| **exchange** | you may *reorder* assumptions |

Ordinary programming languages allow all three, which is why you never think about them. In 1987 Girard removed all three and got **linear logic**, where every assumption is used exactly once. The family is now called **substructural type systems** — the standard reference is David Walker's chapter of that name in *Advanced Topics in Types and Programming Languages* (MIT Press, 2005).

Then people started putting rules back one at a time, and each combination got a name:

```
exactly once   linear
at most once   affine       ← Bend is here, and so is Rust
at least once  relevant
any number     unrestricted ordinary languages
```

**Affine logic adds back weakening and nothing else.** That is the entire definition, and it is where the name comes from — an affine combination in geometry lets a coefficient go to zero, so a term can vanish, and "a term can vanish" is exactly the rule being added.

So the one-sentence definition of Bend's default is:

> **A value may be used at most once.**

The word doing the work in that sentence is **at most**, and it is not a rounding of "exactly once". It is the whole difference between affine and linear, and it is worth testing.

## The rule is about paths, not occurrences

Here is the program that made it click for me. `x` appears twice in the source:

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

It compiles. The checker counts uses **per execution path**, not per textual occurrence. A single run walks one of the two branches, so on every path `x` is used exactly once, and the program is legal. This is the precise reason the rule says "at most once" rather than "exactly once as written".

The same rule is enforced elsewhere with a message that is refreshingly direct. Two uses on one path:

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

And the complement, which is the part people get wrong: **unused is fine**.

```python
def main() -> U32:
  x = {3 : U32}   # never used
  7
```

```
7
```

If Bend were linear rather than affine, this would be an error. Putting weakening back is what makes "declare a value and not use it" legal — and as you will see in a moment, it is also what makes a value's destruction free.

## Two levels: quantity on the term, kind on the type

There are two annotations in play and confusing them cost me three failed experiments. One is written on the variable, the other on the type.

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

`+` is the escape hatch, and it is not free: `+x` turns the value into a reference-counted one. But `+` is also not unconditional — **it requires the type to be `Data`**, because copying a value presupposes that the value can be copied. Ask for it on a `Type` and you get:

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

`Array` is a `Type`, so it can never be `+`. But a `List` is `Data`, and the same shape of program passes:

```python
def main() -> Nat:
  +xs = {[1, 2, 3] : +List<U32>}
  Nat.add(List.length(&2, U32, xs), List.length(&2, U32, xs))
```

```
6n
```

(`&2` is the quantity being threaded through `List.length` explicitly; the count is in the type, not inferred.)

So which types are `Type`? I counted the `Base` library: **13 are `Data`, and exactly 3 are `Type`.**

```
Array      a block of mutable memory
IO.OP      an I/O operation
App        an application / window state
```

All three are things with an identity. Copying a block of mutable memory would break the in-place-update guarantee that makes arrays usable in a pure language; copying an I/O handle would counterfeit a resource; copying an application state would fork a window. Copying a `List<U32>`, by contrast, just copies a structure, and the two halves cannot interfere.

That, and nothing else, is why `+List<U32>` is legal and `+Array<U32>` is not.

## What an array read actually returns

That in-place guarantee is worth looking at once, because it is where affinity stops being an abstraction and starts shaping syntax. A read cannot hand back the element alone — if it did, the array would be gone, since reading consumes it. So it returns both:

```python
def main() -> Array<U32> & U32:
  a = [0 : U32*8n]
  a[5] <- 42       # an in-place rewrite, not a copy
  a[5]             # returns the array AND the element
```

```
([0, 0, 0, 0, 0, 42, 0, 0], 42)
```

The array half comes back with the write in it and the element half beside it — one value, delivered as a pair, because a function that returned only the element would have destroyed the array on the way.

`Array<U32> & U32` is sugar for a `Sigma` — a dependent pair, and Bend opens one only where it was handed to you, as a parameter or a field, never at a local binder. So either give it its own def, or use the two projections `Base` already ships:

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

`Pair.fst` and `Pair.snd` are one-line defs in `Base` whose parameters are pairs — exactly the shape the rule demands. Wherever a `Type` is read, something comes back beside the value, and a parameter is where you take it apart.

## Three selling points, one mechanism

Bend advertises fast, parallel and provable. In the guide these are separate chapters. In fact each one is a corollary of "one value, one owner", and the guide says so in passing.

**No garbage collector.** From the guide:

> There is no garbage collector. Since values are affine, a `match` frees the node it opens on the spot, and only `+` values carry a reference count.

One owner means that when `match` opens a node, the act of reading it out is also the act of freeing it, because there is provably nobody else holding it — and `affine` (not `linear`) is what makes that free when nobody holds the value at all. This explains a Bend rule that otherwise looks like mere style: you destructure values with `match` rather than by reaching for fields. That is not idiom. It is the only memory management the language has.

**Parallelism that needs no proof from you.** A parallel call is an ordinary assignment — two calls on the right of it, two names on the left. Here it is doing real work, in a function you can run:

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

Two calls, two tasks, joined by the assignment. `p` is the predecessor the `case 1n+p` pattern binds, and **both calls read it**, which is legal only because `+n` marks it reusable. Take the `+` away and the line is refused, with the message you met further up: `expected : p`, `observed : p (consumed more than once)`.

The guide frames the rest of it as a two-part promise:

> A parallel call promises the compiler two things: 1. The calls are independent. 2. They run in roughly the same time.
>
> **Since Bend is pure and affine, the first point always holds.** The second is yours to keep.

Read that division of labour again, because it is the best thing in the language. Point 1 — that the two calls do not interfere — is not something you assert and not something you must prove. It is the ownership rule, applied to a line that happens to run twice at once: no second reference to a value is expressible, so there is nothing to alias, so there is nothing to race — and so nothing you were asked to prove. Point 2, load balancing, is the part that genuinely requires a human. You are left with the scheduling problem and relieved of the correctness proof.

The sharper form is the negative one: **in Bend you cannot write the racy program.** For both sides of a parallel call to touch one array, that array would have to be reusable — and you already watched that be refused, on the kind rather than the shape. It is not that the compiler warns you about the race. There is no program to warn about.

**Proofs that vanish at runtime.** The `-x` quantity marks an *erased* variable:

> Erased variables can only appear in types and proofs: the checker sees them, the compiler deletes them.

Proofs live entirely in the checker's view of the program and cost nothing when it runs. Combined with the erased quantity, this is how Bend can offer formal verification without paying for it at runtime — which is what makes the promise "fast *and* provable" coherent rather than a trade-off.

## The price, and where Bend parts ways with Rust

Affine types are not unique to Bend. Rust has them — a moved value is affine, `use after move` is a compile error. But the two languages pay for the property in completely different currency, and this is the comparison I would want before writing a line of Bend.

**Rust adds borrowing on top of affinity.** The type system enforces "one owner", and then `&x` lets you *temporarily* have a second viewer, with lifetimes making sure the view ends before the value does. That is a large amount of machinery, and it buys you the ordinary programming experience: pass a reference, use it, keep your value.

**Bend has no borrow at all.** I grepped the entire guide: the word "borrow" appears **zero** times, while "affine" appears nine. There is no `&x` to reach for, no lifetime to satisfy. A function argument is consumed by default — after `f(xs)`, `xs` is gone.

| | Rust | Bend 2 |
|---|---|---|
| default | affine (move) | affine |
| use it temporarily | `&x`, restored when the borrow ends | no such concept |
| use it more than once | `.clone()`, or restructure ownership | `+x`, a reference count |
| not needed at runtime | monomorphisation | `-x`, erased |

The consequence is the verbosity the guide openly admits to:

> Bend does almost no inference, meaning it requires more annotations than similar languages. This is what allows Bend's checker to be significantly faster than other provers, and its error messages more precise, at the expense of programs and proofs being more verbose.

Rust uses borrowing to avoid copying. Bend cannot, so its only moves are *consume* or *refcount*. That is where the annotations come from, and it is a real cost, not a stylistic one.

It also produces the one result that changed how I think about the design. Closures in Bend are affine and **cannot** be given `+`:

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

A closure is a `Type`, so even a closure that captures nothing cannot be copied. Read naively, this is a restriction the language makes you work around.

Bend's answer is a **template parameter**, written `~f`, which inlines its argument at compile time:

```python
# ~f: substituted at compile time, not passed at runtime
def twice(~f: U32 -> U32, x: U32) -> U32:
  f(f(x))
```

Inside the template, `f` is not a value being passed — it is syntax being substituted. The guide's own words:

> Each distinct set of `~` arguments compiles to its own copy of `twice`, so `f` costs nothing at runtime and, unlike a closure, may be called as many times as you like.

The constraint "a closure cannot be copied" does not lead to "so write more code". It leads to "so inline the function" — and inlining is faster than the function pointer you would have used otherwise. **A restriction in the type system became an optimisation in the runtime.** Bend writes `List.map` this way.

## The one sentence

> **Affinity means a value is consumed at most once, on any execution path.**

From that single rule you get: memory management with no collector, because the last use is the only use and can free on the spot. Parallelism with no locking and nothing to prove, because two owners are unrepresentable. And proofs with no runtime cost, because proofs can be erased entirely.

The cost is symmetrical: no borrower, so the alternative to consuming a value is reference-counting it, and everything must be annotated to say which one you meant.

That is why it is called the first key. Not because it is Bend's most important feature, but because Bend does not really have three features — it has one, and the other two are what falls out. If you take "one value, one owner" as given, most of the language stops being surprising, including the parts that are annoying.
