---
title: "A Proved Core Inside a TypeScript App"
post: 2026-09-27-a-proved-core-inside-a-typescript-app.md
date: 2026-09-27T00:00:00+0800
tags: [bend, typescript, programming, ai-agents]
---

I wanted to know how much of [Bend 2](https://bend-lang.com) I could actually put to work inside an ordinary TypeScript application, so I built a small demo that works out a bill from recorded usage. The billing decision lives in Bend, where a law that covers every input takes the place of a test suite that covers the cases I happened to think of. Everything else is plain TypeScript: the UI, HTTP, storage, and the npm packages around them.

What got me to try it was this idea:

> The human says what "correct" means, an agent writes the code and the proofs, and the checker decides. Bend is the first tool I have seen that makes this division of labour work in everyday engineering.
>
> 人负责说清楚"什么是对的"，agent 写代码和证明，检查器负责判定。Bend 是我见过第一个能让这种分工在日常工程里实际跑起来的工具。

This post is what that cost and what it gave back, roughly in the order I ran into it.

## Draw the line at IO

I expected to split the code by importance: critical logic in Bend, the rest in TypeScript. The line that actually worked was **IO**. Anything pure can go in the proved core: data structures, algorithms, state machines, any computation whose answer has to be right. TypeScript keeps whatever touches the outside world: HTTP, files, the clock, the UI, and the npm packages that wrap them. The two meet in memory. The host calls the core as an ordinary function, through types generated from the Bend source.

Billing was a good first candidate because of its shape, not its importance. It is a pure decision that must be right for every input, and its rules can be written down as laws. Permissions, quotas, allocation, scheduling, merging and protocol state machines have the same shape.

A TypeScript type can say that a bill is a number. It can't say that the bill is the sum of each unit's price. Here is that statement as a Bend law, from my graduated-pricing core:

```python
law charge_exact:
  for +plan: C.Plan
  for n: Nat
  {C.charge(plan, n) == C.per_unit(n, plan) : Nat}
```

`charge` walks the pricing tiers, `per_unit` prices one unit at a time, and the law says they agree for every plan and every usage. The proof is what makes "every" literally true.

Once the first function is in, the next one is cheap. The first move pays for the bridge, the type generation and the test gate; after that, each pure function you move costs little, and the rest of the app barely notices. Over time the core grows and TypeScript thins into a shell around IO.

## What a proof gives that a test doesn't

**It covers every input, not the ones I thought of.** Bugs in decision logic tend to live in combinations nobody wrote a test for: a wildcard in an odd position, an empty list, a boundary value, a requester with no roles. I planted the same plausible bugs in a well-tested TypeScript function and in a proved core. The tests missed some of them. The proofs caught every one that the laws spoke about. The bugs the tests missed were the expensive kind.

**It forces the specification questions before any code exists.** Writing a law makes you decide things a TypeScript implementation decides by accident:

- Does a window that ends at 12:00 touch one that starts at 12:00?
- Is a requester with no roles covered by a rule for "any role"?
- What does a plan charge past its last tier?

Without a law, the answer is whatever the code happens to do, and nobody knows a choice was made.

**It gives reviewers something they can actually read.** A reviewer can read a dozen short laws and know what the core guarantees, without reading the code or the proofs, because the checker vouches that the code meets them. I didn't expect to care about this as much as I do.

## Most of the value came before the proof

The steps leading up to the proof caught most of the problems:

- **Reading the existing code** to list what it had to guarantee turned up bugs in it: edge cases it got wrong, inputs it quietly mishandled.
- **Drafting the laws** surfaced decisions nobody had made.
- **Falsifying the laws on concrete inputs** exposed a wrong specification in under a second, before any proof existed. The checker can evaluate code on literals, so instantiating a candidate law a few thousand times gives you a property test with the checker as the runner.

The proof comes last, and it is the cheap part. It turns "we checked a lot of cases" into "it holds for all of them", and it keeps holding when the code changes.

## Designing for the proof made the code better

How the code is shaped decides how hard the proofs are, so before writing anything I looked for the shape with the shortest induction. Again and again, that was also the better program:

- **A step the proof doesn't need is often a step the program doesn't need.** Rewriting an algorithm so its correctness argument is a single induction can remove a whole phase, such as a sort.
- **Make invalid inputs impossible to write.** If a bad value can't be expressed, the laws need no precondition, the core needs no validation, and the proofs need no case analysis. TypeScript validates once at the boundary, where the error message can still say what was wrong.

Sketching the proof is part of the design, not paperwork afterwards. One of my laws was satisfied by a version of the code that did nothing at all. The law was true and useless, and only sketching the proof showed it.

## Where a proof can still mislead you

A proof is exactly as strong as what it states and what the checker enforces. Four gaps I ran into:

- **Proofs protect only what the laws say.** A law written in terms of a helper says nothing about bugs in that helper. If "a matching deny means no" is stated with the core's own `matches`, a broken `matches` leaves the law true. Laws about the helper itself close the gap. Choosing the laws is the real design work.
- **Proofs can't see run time.** They say nothing about stack depth, time or memory. A proved function can still overflow the stack on realistic numbers, and small literal test cases won't show it. Test the core at real scale.
- **The host isn't proved.** The bridge's conversions, validation, IO and configuration are ordinary TypeScript and need ordinary tests. Keep that layer thin and check its conversions against a trusted reference.
- **An unsafe definition can prove anything.** A def that skips the termination check can "prove" a false equation, and the checker still prints "All terms check", with a warning next to it. The gate has to reject that warning, not just look for the success line.

And a proof that checks quickly may not be saying much. Three habits kept mine honest:

1. **Give every law a mutant.** Change one line of the core so the law becomes false, and require the proof to fail inside its own lemmas. Make sure the mutated core still compiles; a mutant that doesn't compile is caught for the wrong reason.
2. **Check that the falsifier can fail.** Plant a bug and require a counterexample. Build test inputs around the law's hypotheses: uniformly random inputs rarely satisfy them, so the falsifier finds nothing even when the law is false.
3. **Recognise equivalent mutants.** A change that computes the same function, such as `a < b ? a : b` versus `a <= b ? a : b`, survives every law, and it should. Compare the two functions before calling it a gap.

## The cost is tokens, not people

With one agent working sequentially, a proved core took several times longer than the same function with example tests. Most of that time went into deciding what the laws should say and how to shape the data, not into the proofs. Proofs usually checked on the first or second try: the checker answers in well under a second, and each error names the next goal.

That cost falls on agents, and it parallelises. Several agents can attack the same law with different strategies, such as which argument to induct on or which lemma to state, and the first proof that checks wins. Since the checker is the judge, nobody has to trust or review an agent's proof.

The one cost that doesn't parallelise is the human one: deciding what "correct" means. So keep laws short and readable enough that a person can approve a dozen in a few minutes. As more code moves into cores, reviewing laws becomes the main human job.

## The ecosystem is young

Bend's library ecosystem is small, but that is a matter of time rather than a limit on what belongs in Bend. I expect those libraries to be written by agents, and to come with proofs. A proved library has a property ordinary packages don't: its theorems hold for every input, so it doesn't break when used somewhere new. Proved facts also accumulate. A lemma about ordering, proved once for one project, gets reused unchanged by the next. One of my projects pulls in **bend-mathlib** as a submodule, and the few facts it lacks live in the project that needs them. Each proof makes the next one cheaper.

For now, expect to work around a few things:

- There is no official library output. I wrote **bend-emit** (<https://github.com/nohzafk/bend-emit>) to build a typed ES module from a core.
- Editor support lags behind the compiler.
- The JavaScript runtime is single-threaded and uses BigInt for numbers, and some standard-library functions that are easy to prove things about are slow at run time. Test at real scale.
- The language's rules are still being relaxed from release to release.

## Try it

The idea held up. The human says what "correct" means, agents write the code and search for proofs in parallel, and the checker decides. With the boundary drawn at IO, formal verification stops being an academic exercise and becomes part of everyday engineering.

I've packaged the method as an agent skill, **bend-ldd** (<https://github.com/nohzafk/bend-ldd>). It covers where a proved core belongs in an application, how to find the laws, and which tool to reach for when a proof won't check.
