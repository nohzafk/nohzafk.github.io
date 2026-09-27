---
title: "A Proved Core Inside a TypeScript App"
post: 2026-09-27-a-proved-core-inside-a-typescript-app.md
date: 2026-09-27T00:00:00+0800
tags: [bend, typescript, programming, ai-agents]
---

I built a demo app to find out how much of Bend's power I could put to work inside a TypeScript application. The demo does one thing: it works out a bill from recorded usage. That decision lives in [Bend 2](https://bend-lang.com), where a law about every input replaces a test suite about the cases I happened to imagine. Everything else is ordinary TypeScript: the UI, the HTTP, the storage and the npm packages that wrap them. This post is the report from that demo: what the proved core cost, and what it gave back.

The bet that made me try it is one sentence:

> The human says what "correct" means, an agent writes the code and the proofs, and the checker decides. Bend is the first tool I have seen that makes this division of labour work in everyday engineering.
>
> 人负责说清楚"什么是对的"，agent 写代码和证明，检查器负责判定。Bend 是我见过第一个能让这种分工在日常工程里实际跑起来的工具。

Everything below is what that cost and what it bought, in the order I met it.

## The Line Is IO, Not Importance

The boundary between the two languages turned out to be **IO**, not how critical the code is. Everything pure can live in the proved core: data structures, algorithms, state machines, and every computation whose answer must be right. TypeScript keeps what touches the outside world: HTTP, files, time, the UI, and the npm packages that wrap them. The two meet in memory: the host calls the core as a function, through types generated from the Bend source.

So I started with billing. What makes it a good fit is not its importance but its shape: a pure decision whose answer must be right for every input, and a rule a person can write down as a law. Permissions, quotas, allocation, scheduling, merging and protocol state machines have that shape too, so a core can hold them the same way. A TypeScript type can say that a value is a number. It cannot say that a bill is the sum of its unit prices, or that a deny always wins. Only a law says that, and only a proof says it for every input.

Then the next pure function moves in, and the next. The first function pays for the bridge, the type generation and the gate. After that, each move costs little, and the rest of the application barely changes. Over time the core grows, and TypeScript thins to a shell around IO.

## What a Proof Gives That a Test Does Not

**Every input, not the examples I thought of.** A test checks the cases its author imagined; a law is proved for every input. Bugs in decision logic tend to live in combinations nobody wrote a test for: a wildcard in an unusual position, an empty list, a boundary value, a requester with no roles. When I planted the same plausible bugs in a well-tested TypeScript function and in a proved core, the tests missed some of them and the proofs missed none of the ones the laws spoke about. The bugs the tests miss are the expensive kind.

**The specification questions arrive before the code is written.** Stating a law forces decisions a TypeScript implementation makes by accident:

- Does a window that ends at 12:00 touch one that starts at 12:00?
- Is a requester with no roles covered by a rule for "any role"?
- What does a plan charge past its last tier?

Without the law, the answer is whatever the implementation happens to do, and nobody knows that a choice was ever made.

**Laws are a contract a person can review.** A reviewer reads a dozen lines in plain language and knows what the core guarantees, without reading the code or the proofs, while the checker vouches that the code meets them. That is the part I did not expect to care about as much as I do.

## Most of the Value Arrived Before the Proof

The steps before proving catch most of the problems:

- **Reading the existing code** to list what it must guarantee found bugs in it: edge cases it got wrong, inputs it silently mishandled.
- **Drafting the laws** turned up the decisions nobody had made.
- **Falsifying the laws on concrete inputs** found a wrong specification in under a second, before any proof existed. The checker runs code on literals, so a candidate law instantiated a few thousand times is a property test with the checker as the runner.

The proof comes last, and it is the cheap part. It turns "we checked many cases" into "it holds for all of them", and it keeps holding when the code changes.

## Designing for the Proof Made the Code Better

The shape of the code decides how hard the proofs are, so I looked for the shape with the shortest induction before writing anything. Repeatedly, that shape was also the better program:

- **A step the proof does not need is often a step the program does not need.** Rewriting an algorithm so that its correctness argument is one induction can remove an entire phase, such as a sort.
- **Make invalid inputs unwritable.** A representation in which a bad value cannot be expressed needs no precondition in the laws, no validation inside the core, and no case analysis in the proofs. TypeScript validates once, at the boundary, where the error message can still say what was wrong.

Sketching the proof belongs to the design, not to the paperwork after it. One of my laws was satisfied by a version of the code that did nothing at all: the law was true and useless, and only the sketch showed it.

## What the Proofs Did Not Cover

- **Proofs protect only what the laws state.** A law written in terms of a helper says nothing about bugs inside that helper. If "a matching deny means no" uses the core's own `matches`, a broken `matches` leaves the law true. Laws about the helper itself close the gap. Choosing the laws is the design work, and the proofs are comparatively cheap.
- **Proofs cannot see run time.** They say nothing about stack depth, time or memory. A function can be proved correct and still overflow the stack on realistic numbers, so test the core at real scale, with real magnitudes; small literal instances will not show it.
- **The host is not proved.** Conversions in the bridge, validation, IO and configuration are ordinary TypeScript and need ordinary tests. Keep that layer thin and check its conversions against a trusted reference.
- **An unsafe definition proves anything.** A def that skips the termination check can "prove" a false equation, and the checker still prints "All terms check", with a warning buried beside it. A gate must reject that warning, not just look for the success line.

## Making Sure the Proofs Mean Something

A proof that checks quickly may be saying nothing at all. Three habits kept mine honest:

1. **Give every law a mutant.** Change one line of the core so that the law becomes false, and require the proof to fail inside its own lemmas. Make sure the mutated core still compiles: a mutant that fails to compile is caught for the wrong reason.
2. **Control the falsifier.** Plant a bug and require a counterexample. Build the instances around the law's hypotheses. Uniformly random inputs rarely satisfy them, and then the falsifier finds nothing even when the law is false.
3. **Recognise equivalent mutants.** A change that computes the same function, such as `a < b ? a : b` against `a <= b ? a : b`, survives every law, and that is correct. Compare the two functions before calling it a gap.

## The Cost Is Tokens, Not People

Written by one agent in sequence, a proved core took several times longer than the same function with example tests. Most of that time went into deciding what the laws should say and shaping the data, not into the proofs. The proofs usually checked on the first or second attempt: Bend's checker answers in well under a second, and each error names the next goal.

That cost falls to agents, and it parallelises. Several agents can attack the same law with different strategies: which argument to induct on, which lemma to state. The first proof that checks is kept. The checker is the judge, so no agent's work needs to be trusted or reviewed. The cost is tokens, and tokens are cheap.

The one cost that does not parallelise is the human's: deciding what "correct" means. Keep the laws short and readable enough that a person can approve a dozen of them in minutes, because as more code moves into cores, reviewing laws becomes the main human work.

## The Ecosystem Is a Matter of Time

Bend is young and its library ecosystem is small, which is a question of time rather than a limit on what belongs in Bend. Those libraries will be written by agents, and they will be proved. A proved library has a property no ordinary package has: its theorems hold for every input, so it does not break when it is used somewhere new. Facts accumulate too. A lemma about ordering, proved once for one project, is reused unchanged by the next. One of mine pulls in **bend-mathlib** as a submodule; the few facts it lacks live in the project that needs them. Each proof makes the next one cheaper.

Today, expect to work around a few things:

- There is no official library output. I wrote **bend-emit** for that (<https://github.com/nohzafk/bend-emit>): it builds a typed ES module from a core.
- Editor support lags the compiler.
- The JavaScript runtime is single-threaded with BigInt numbers, and some standard-library functions that are easy to prove things about are slow at run time. Test at real scale.
- Rules of the language are still being relaxed release by release.

## Where to Look

That bet held up: the human says what "correct" means, agents draft the code and find the proofs in parallel, and the checker decides. Once the boundary is drawn at IO, formal verification stops being an academic exercise and becomes everyday engineering.

The method for running that loop is packaged as an agent skill, **bend-ldd** (<https://github.com/nohzafk/bend-ldd>): where a proved core belongs in an application, how to find the laws, and which tool to reach for when a proof will not check.
