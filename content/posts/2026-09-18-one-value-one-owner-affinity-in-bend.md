---
title: "One Value, One Owner — Reading Bend Through Affinity"
post: 2026-09-18-one-value-one-owner-affinity-in-bend.md
date: 2026-09-18T09:31:47+0800
tags: [bend, programming, types]
---

**Bend 2 is a new programming language.** Its syntax is Python-shaped, its semantics are closer to Haskell, and it sets out to combine three things that rarely sit together: proofs checked at compile time, C-like speed, and parallelism across CPU threads and GPUs from a single source. The implementation is TypeScript; the core theory underneath it is mechanized in Lean. The language's own guide states the ambition plainly — to give people "an ambiguity-free language to communicate their intents to AIs", with a compiler that can mechanically check the result. That is the bet, and it does not live in the syntax. I wrote a short book about Bend 2 while learning it — *Bend 2, from zero*, at **https://nohzafk.github.io/bend2-from-zero/** — where every claim comes with code you can run; this post is the one idea from it I keep coming back to.

One claim stood out above everything else:

> Affinity — this is the first key to understanding everything.

It reads like marketing, and I wanted to know whether it survives contact with the language. So rather than read Bend top-down, I decided to learn what **affinity** actually is and then read Bend through it. I installed Bend 2.0.5 and ran nine small programs to find out what the rule really enforces.

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

It is also why the check can be cheap. There are no loop constructs in Bend to reason about: work is repeated by recursion, and termination is verified *structurally* — a recursive call has to pass a smaller part of its input, obtained by pattern matching:

> The check reads the arguments of a recursive call from left to right: each must be passed unchanged until one is a smaller part of its parameter, and the ones after it are free. So, put the parameter that shrinks first.

No fixpoint over a loop body, no termination oracle. Both ownership and termination are answered by looking at the shape of the source.

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

`Array<U32> & U32` is sugar for a `Sigma` — a dependent pair. The surprise is that you cannot take it apart with a local binding:

```python
  p = a[5] <- 42
  (a2, b) = p      # rejected
```

```
- message : a parameter or field scrutinee
            (a match cannot scrutinize a local binder: give it its own def)
```

That message *is* the rule: a pair may be destructured where it is a parameter or a field, never at a local binder. So either give it its own def — literally what the error asks for — or use the two projections `Base` already ships:

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

`Pair.fst` and `Pair.snd` are one-line defs in `Base` whose parameters are pairs — exactly the shape the rule demands. I would have liked to know this on day one: wherever a `Type` is read, something comes back beside the value, and a def parameter is where you take it apart.

## Three selling points, one mechanism

Bend advertises fast, parallel and provable. In the guide these are separate chapters. In fact each one is a corollary of "one value, one owner", and the guide says so in passing.

**No garbage collector.** From the guide:

> There is no garbage collector. Since values are affine, a `match` frees the node it opens on the spot, and only `+` values carry a reference count.

One owner means that when `match` opens a node, the act of reading it out is also the act of freeing it, because there is provably nobody else holding it — and `affine` (not `linear`) is what makes that free when nobody holds the value at all. This explains a Bend rule that otherwise looks like mere style: you destructure values with `match` rather than by reaching for fields. That is not idiom. It is the only memory management the language has.

**Parallelism that needs no proof from you.** A parallel call in Bend is written `a b = f(x) g(y)`, and the guide frames it as a two-part promise:

> A parallel call promises the compiler two things: 1. The calls are independent. 2. They run in roughly the same time.
>
> **Since Bend is pure and affine, the first point always holds.** The second is yours to keep.

Read that division of labour again, because it is the best thing in the language. Point 1 — that the two calls do not interfere — is not something you assert and not something you must prove. It follows from the type system: `x` has one owner, so a second simultaneous reference to it is not expressible, so there is no aliasing, so there is no data race. Point 2, load balancing, is the part that genuinely requires a human. You are left with the scheduling problem and relieved of the correctness proof.

The sharper form is the negative one: **in Bend you cannot write the racy program.** `Array` is a `Type`, so there is no syntax that hands the same array to two parallel calls. It is not that the compiler warns you. There is no program to warn about.

The obvious question is whether that pays off. I ran the project's own mandelbrot benchmark — 4096×4096, 51 iterations per pixel — three ways, three times each, on an M3 Max:

| mode | runs (s) |
|---|---|
| serial CPU | 5.062 · 5.067 · 5.047 |
| parallel CPU (14 threads) | 0.729 · 0.728 · 0.737 |
| GPU | 0.073 · 0.060 · 0.059 |

Same `.bend` source, byte-identical generated C, one difference: the mode. Twelve times faster than the parallel CPU path.

Then run the same three modes on work the guide says is *bad* for a GPU. On n-queens (17×17, limit 11730) the GPU is 1.5× **slower** than the parallel CPU — 1.352 s against 0.889 s. That is the conclusion the guide reaches, and it is the more useful half of the result. Affinity buys you the *correctness* of a parallel call. It says nothing about where the work should run. That part stays yours.

One caveat, and it applies to every GPU number here: they are warm. A cold first run of the same binary costs 0.339 s against 0.060 s once warmed, so the fair comparison is the warmed one — which is also not the one you get on your first run. The seconds belong to one machine; the ratio is what transfers.

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

Each distinct `~` argument compiles to its own copy of `twice`, so `f` is not a value being passed — it is syntax being substituted. Inside the template it can be called as many times as you like:

> Each distinct set of `~` arguments compiles to its own copy of `twice`, so `f` costs nothing at runtime and, unlike a closure, may be called as many times as you like.

The constraint "a closure cannot be copied" does not lead to "so write more code". It leads to "so inline the function" — and inlining is faster than the function pointer you would have used otherwise. **A restriction in the type system became an optimisation in the runtime.** Bend writes `List.map` this way.

## The one sentence

> **Affinity means a value is consumed at most once, on any execution path.**

From that single rule you get: memory management with no collector, because the last use is the only use and can free on the spot. Parallelism with no locking and nothing to prove, because two owners are unrepresentable. And proofs with no runtime cost, because proofs can be erased entirely.

The cost is symmetrical: no borrower, so the alternative to consuming a value is reference-counting it, and everything must be annotated to say which one you meant.

That is why it is called the first key. Not because it is Bend's most important feature, but because Bend does not really have three features — it has one, and the other two are what falls out. If you take "one value, one owner" as given, most of the language stops being surprising, including the parts that are annoying.
