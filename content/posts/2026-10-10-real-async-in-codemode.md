---
title: "Real Async in Codemode: A Proved Scheduler, and Where I Part Ways With opencode"
post: 2026-10-10-real-async-in-codemode.md
date: 2026-10-10T23:00:00+0200
tags: [ai-agents, codemode, bend, typescript, javascript, programming]
series: ["Building My Own Harness"]
---

In [the previous post](/posts/2026-10-10-codemode-without-a-sandbox/) I explained why my agent keeps the evaluator of [opencode's codemode package](https://github.com/anomalyco/opencode/tree/dev/packages/codemode) and replaces its scheduler with a core written in [Bend](https://bend-lang.com). At that point the scheduler was a list of candidate laws. It is now built, proved, and wired into the evaluator.

Along the way I found something I had not expected. opencode's codemode does not run `async` functions as asynchronous functions. It runs them inline, to completion, at the point of the call. I first read that as a missing feature. After more reading I think it is a deliberate design, and a sensible one. I still chose differently.

This post covers both parts: how the scheduler was designed as a proved core, and why my agent makes `async` real when opencode does not.

## What the scheduler decides

A codemode script is JavaScript that the model writes. It calls tools, and every tool call returns a promise:

```js
const files = await Promise.all(paths.map(p => tools.read({ path: p })))
```

The evaluator turns syntax into values. The scheduler decides everything about promises:

- when a tool call starts and when it queues;
- what `await`, `Promise.all`, `Promise.allSettled` and `Promise.race` deliver, and when;
- which calls a race, a timeout or an abort interrupts;
- what the end of the script waits for;
- which failures nobody awaited.

In my agent the scheduler is a pure state machine in Bend. The evaluator reports what the script does as an event, the core answers with commands, and a thin TypeScript layer performs those commands:

```
step(state, event) -> (state', commands)

events:   EvCall  EvAsync  EvOk  EvErr  EvDone  EvThrew  EvWait  EvReturn  EvAbort
commands: Made  Spawned  Waiting  Start  Interrupt  Wake  Finish
```

The core knows two kinds of promise, numbered by one counter in the order the script makes them:

- **Tool**: a tool call. It queues, holds one of the concurrency slots while it runs, and counts against the call budget.
- **Fn**: one execution of an `async` function. It runs from the moment the evaluator reports it until the function returns or throws. It never holds a slot, never queues, and is not counted against the budget.

The script itself has three modes. **Live**: the script is running. **Draining**: the top-level script has returned, but tool calls and async executions are still going. Their waiters still resume, and new tool calls from them are still accepted. **Over**: the script finished or was aborted, and the core does nothing from then on. `Finish` comes exactly once, when no tool call is queued or running and no async execution is going. It carries the returned value and the list of failures that nothing awaited.

That last list matters more than it looks. If a script forgets to `await tools.post(msg)`, it returns `"done"` while the post failed. Without the report, the model believes the message went out.

## Getting the laws right took two drafts

The first draft had 13 laws, each about one behaviour: the concurrency limit, the budget, race, abort, and so on. Proving them stalled after 4. The cause was the shape of the laws, not the difficulty of the proofs. Every law took "the state is valid" as its premise, and "valid" was defined loosely enough that one law (the budget) turned out to be false under it. Strengthening the invariant meant re-proving everything that used it.

I took the problem to a stronger model and asked for a review of the laws themselves. It suggested three layers:

1. **Pure decisions.** For example: given the members of a `Promise.all` and their states, does it wait, reject or fulfil? These are small functions with exact laws (`vd_all`, `vd_settled`, `vd_race`). They need no premise about the state at all.
2. **One step.** What a single event does, under a small, local premise ("the ids are distinct"), not under a global invariant.
3. **The whole run.** One law, `sc_inv`, says that every state a run can reach satisfies the invariant. Only this layer needs it.

The redraft had 30 laws, and they were proved. I proved them by sending several prover agents out in parallel, one per group of laws. This worked, but it produced a 15,241-line proof file. Three of the provers had each built their own copy of the same proof framework, about 4,400 lines in total. None of them knew the others existed, so each one invented the same idea alone.

The lesson went into my Bend workflow notes: when several provers work on one unit, build the shared lemma layer first and do not let anyone copy a lemma.

The larger fix was in the laws. Six of the step laws (start, interrupt, cut, keep, frame, race-cuts) turned out to describe pieces of one relation: how a single step may move each existing promise. So I replaced them with one law, `sc_calls`. For every promise that existed before a step:

- an ended promise stays exactly as it ended, with no command;
- a tool call that lost a race this step ends `Interrupted`: one `Interrupt` if it was running, no command if it was queued, and it never starts;
- any other queued promise stays queued, or starts with exactly one `Start`;
- any other running promise keeps running;
- an async execution is never interrupted.

Each line of the law carries its reason. A call marked running with no `Start` never reaches the tool, so the script hangs. A second `Start` runs the tool twice. A race loser left in the queue starts later and runs a tool whose result nobody will read.

The unit now has 25 laws and an 8,027-line proof. It also has 35 mutants: deliberately wrong versions of the core, and each must break the proof of the law it targets. Every law is also falsified on random states before it is proved. A wrong law is cheaper to find with 3,000 random cases than with a failed proof.

## Wiring it into the evaluator

I wanted a clear boundary between the scheduler and the evaluator. The evaluator is opencode's code, and it should stay easy to update from upstream. So one TypeScript module owns all scheduling. It holds the fibers, the waiters' Deferreds, and the values behind the tokens the core passes around. The evaluator reaches it through one small interface: `call`, `spawn`, `ended`, `wait`, `returned`, `abort`. A grep for fiber, semaphore and interrupt APIs over the evaluator's sources finds nothing; they appear only in the scheduler module.

Replacing opencode's scheduler changed some behaviour that a script can observe. Each change follows a law:

- **An un-awaited failure no longer fails the whole run.** The returned value is kept, and the failure is listed next to it.
- **`Promise.all` rejects at the first failure in time**, not at the first failure by index. A script waiting on a slow call learns at once that a fast one failed.
- **A rejected `Promise.all` does not interrupt its other members.** A half-done write is never cut off because a sibling failed.
- **A race loser that is still queued never starts.**
- **After the script returns, the run waits** for every queued or running call to finish.
- **After a timeout, nothing is accepted.**

## The `async` keyword nobody reads

While I was mapping the seam, one finding did not fit. The parser records whether a function is `async`, but nothing ever reads that flag. Calling an `async` function evaluates its body right there, including every `await` inside it, and the caller gets the value, not a promise.

So in opencode's codemode:

```js
items.forEach(async x => { await tools.post({ x }) })
```

runs the posts one after another. And

```js
await Promise.all(items.map(async x => {
  const page = await tools.fetch({ x })
  return await tools.summarize({ page })
}))
```

processes the items one at a time. `map` gets back values, not promises, and `Promise.all` over plain values works, so the result is correct. It is only serial.

At first I took this for an unfinished feature. Three things in the source changed my mind:

1. **A comment states where the parallelism lives.** The `Promise.*` code says that tool calls already run eagerly on their own fibers, and the combinators only observe settlements. So joining is "sequential (no extra fibers) without costing parallelism". The concurrency cap "stays where the work is". The design puts parallelism in tool calls, not in functions.
2. **A test pins a behaviour that is not JavaScript.** It asserts that
   ```js
   "a1b22".replace(/\d+/g, async m => await tools.decorate(m))
   ```
   returns `"a[1]b[22]"`. In real JavaScript an async replacer returns a promise, and the result is `"a[object Promise]b[object Promise]"`. The same test then asserts that a replacer which returns a tool-call promise without `await` is an error. The two cases sit side by side. Whoever wrote that test knew this differs from JavaScript and wanted it.
3. **Elsewhere the code cares about JavaScript fidelity.** Returning a promise from the script resolves it "exactly as in JS", says another comment. A team that writes that is not careless about semantics. This difference was chosen.

## Why opencode's choice makes sense

The scripts are written by a model, and models make the same async mistakes people do. To see what the inline design buys, I ran a few such mistakes on my evaluator after I had made `async` real:

| script | inline (opencode) | real async (mine, today) |
|---|---|---|
| `[1,2,3,4].filter(async x => x % 2 === 0)` | `[2,4]` | `[1,2,3,4]` |
| `[3,1,2].sort(async (a, b) => a - b)` | `[1,2,3]` | `[3,1,2]` |
| `[1,2,3].find(async x => x === 2)` | `2` | `1` |
| `[1,2,3].some(async x => x > 5)` | `false` | `true` |

The right column is exactly what JavaScript gives: a promise is always truthy, and a promise turned into a number is `NaN`. It is also always a bug, and the program reports nothing. The model gets a wrong answer and has no reason to doubt it.

Under the inline design, all four are right. `await` behaves like a blocking call, so any callback can be `async` and still return a usable value. Add that tool-to-tool parallelism is still available through `Promise.all` over direct tool calls, and the design is coherent. It gives up some speed to make a whole class of mistakes harmless. The implementation is simpler too: there is one execution, one scope stack, and no interleaving between functions.

## Why I made `async` real anyway

The case where the inline design loses is the most common parallel pattern a model writes:

```js
await Promise.all(items.map(async x => { /* several dependent tool calls */ }))
```

With inline async, N items of k steps each take about N × k tool round trips. With real async and a concurrency limit of 8, they take about ⌈N/8⌉ × k. This is an estimate from the scheduling rules, not a measurement. But codemode exists to save round trips, and this is its main path. A model could restructure the work into stages of `Promise.all` over direct tool calls, but it has no reason to know it should.

There are smaller reasons too:

- **Race works.** With inline async, an async function passed to `Promise.race` has already finished before the race begins, so it always wins.
- **Errors arrive where JavaScript sends them.** An `async` function that throws gives a rejected promise, not a synchronous throw that a surrounding `try` catches.
- **The laws were already written for it.** Fn executions, Draining, and the rule that a Fn race loser runs on are all in the core. A JavaScript function cannot be stopped from outside.

So in my evaluator, calling an `async` function now sends `EvAsync`. The core answers `Spawned(id)`, the body runs up to its first suspension, and the caller gets a promise and continues. That is JavaScript's order. One detail: each async execution evaluates on its own interpreter instance, because the evaluator keeps its scope stack on the interpreter object, and two bodies paused at their awaits must not share one. A test pins the order: an async function pushes before and after an `await`, and the caller pushes after the call. The result is `["body before await", "caller after call", "body after await"]`.

That leaves the table above, which is a real regression.

## The mitigation: make the silent cases loud

All four bad cases share one cause. A promise is used as a boolean or as a number, and in JavaScript that is always a mistake. So the rule is: **when the evaluator converts a promise to a boolean or a number, it throws an "un-awaited Promise" error** the script can catch, and the message tells the model to resolve the values with `Promise.all(items.map(...))` first and then filter or sort on the results.

The check sits in the two conversion helpers, so every place that reads a value as a condition or a number goes through it: `if`/`while`/`for` tests, `?:`, `!`, the deciding side of `&&` and `||`, arithmetic and ordering operators, the callbacks of `filter`, `find`, `some`, `every` and their relatives, and sort comparators. All four cases in the table above now raise instead of answering wrongly, and none of the existing tests had to change.

Three properties make it attractive:

- **It is one rule at the conversion points, not a check per method.** It covers `filter`, `find`, `some`, `every` and `sort`, and also the model's own `if (check(x))`, `!p`, `p && …` and `p > 0`.
- **It cannot break a correct script.** A correct script never converts a promise to a boolean or a number, so only an already-broken script sees the error.
- **It fits what opencode already does.** opencode already raises an "un-awaited Promise" error when a promise reaches the data boundary (a tool's input, the script's result, a `replace` result) or when the script reads a property of one. This extends the same idea to the other places where a promise is certainly a mistake.

It does differ from JavaScript, which would silently continue. Here, failing loudly beats matching JavaScript exactly. The model can fix an error it sees, and it cannot fix a wrong answer it trusts.

## What the error does not catch

One pitfall survives:

```js
let total = 0
await Promise.all(items.map(async x => { total += await tools.count({ x }) }))
```

`total += await f()` reads `total` before the `await` and writes it after. With real concurrency, the executions read the same old value, and some additions are lost. Inline async gets the right sum, while real async gets the JavaScript answer, which is wrong. No conversion happens here, so the error rule cannot see it. The evaluator cannot tell this mistake apart from intended code. I accept this risk because I expect it to be rarer than `filter(async …)`. That is a guess.

## What would change my mind

The choice rests on two claims I have not measured:

1. Models write multi-step `map(async …)` pipelines often enough that serial execution costs real time.
2. The `total += await` pattern is rare.

Once codemode runs inside the agent, the scripts models actually write will be in the session logs. If pipelines are rare and read-modify-write across `await` is common, inline async is the better design, and going back is cheap. The core would stay as it is; the evaluator would simply stop sending `EvAsync`.

Until then I keep real async with loud errors. The opencode team made a careful choice for its context, and I only noticed it was a choice after I had made the opposite one. Thanks to them for the evaluator, and for a design that was worth understanding before I departed from it.
