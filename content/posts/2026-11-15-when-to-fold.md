---
title: "When to Fold: The Model Says Done, the Cache Says When"
post: 2026-11-15-when-to-fold.md
date: 2026-11-15T15:30:00+0100
tags: [ai-agents, llm, bend, programming]
series: ["Building My Own Harness"]
series_weight: 30
math: true
---

In [the first post](/posts/2026-09-28-fold-dont-compress/) of this series the model folds a unit of work when it closes: the host replaces the unit's turns with a short result and keeps the originals on disk. In [the second](/posts/2026-10-15-merge-the-folds/) the folded units become one title each, and the title list is merged as a binary counter so that it stays short.

Both posts treated the moment of a fold as settled. The model calls `fold_unit`, and the fold takes effect. I had simulated the timing once and found that it moved the total cost by about a fifth at most. So I left it alone.

Then I looked at the cache-hit ratio of one long session, request by request, and it read *low, high, low, high*. This post is about that pattern, and about the rule that replaced it. The short version: the model still decides *that* a unit is closed. The host now decides *when* the fold is applied, and it decides with a few arithmetic operations that, on the recorded sessions, cost within 2% of a schedule that knows the future.

## The symptom

The session ran on `claude-opus-5-5` through Anthropic, with 1-hour cache marks. The host offers the fold card every 20k tokens of growth, and the model folded at nearly every card. Every fold took effect at once.

Each request that carried a fold read about 30–43k tokens from the cache: the tools, the system prompt and the title list. It *wrote* 68–87k: everything after the fold point. Every other request in the session read 94–99% from the cache. So the hit ratio did not follow the provider or the work. It followed the folds, and the folds followed the card. The user saw one miss per turn.

{{< ft "pulse" >}}
A made-up session, not a recorded one, run twice. Every request adds 4k tokens; every fifth request the card comes and the model queues a 20k fold. Top: each fold is applied when the model asks, and each one is a red spike. Bottom: the rule below batches the folds and applies them when that pays, or during a break, when the cache was cold anyway. Point at a request to see what it sent. Press play, then try $h = 5$ and $h = 80$.
{{< /ft >}}

## What a miss costs

A fold edits the middle of the prompt. Everything after the first changed byte misses the cache and is written again. Two prices matter, both in units of the model's input price:

- $r$, a token read from the cache. For `claude-opus-5-5` it is 0.05.
- $w$, a token written to the cache. A 1-hour mark costs 2.

A written token costs forty times a read one. That ratio is what my earlier simulations left out: they counted a cached token at a tenth and a missed one at full price, with no premium for the write.

Take a fold that removes 20k tokens. Every later request is 20k tokens shorter, and those tokens would have been cache reads, so it saves $0.05 \times 20\text{k} = 1\text{k}$ input-price tokens per request. The request that applies it rewrites about 70k tokens at twice the input price, about 140k. On its own the fold repays itself after about 140 warm requests.

That does not mean folds are a bad idea. Never folding is far worse: in the replay below it costs 4.5 times as much as applying every fold at once, because the finished work is read again on every request, and a session is long. The question is not *whether* to fold. It is *when*.

## Two questions, two owners

The first post argued that the model is the right judge of closure, because closure is easy to see in hindsight and the model has just written its conclusion. That still holds. But the model cannot see the cache. It does not know when the last request went out, what the marks' TTL is, or what the provider charges for a write. The host knows all of that and nothing about the work.

So the two questions are split:

- **The model decides closure.** When it calls `fold_unit`, the call is checked as before and the fold, with its title, goes into a **queue**. The result tells the model that the fold is queued and when it will be applied.
- **The host decides timing.** Before every main-loop request with at least one fold queued, it decides whether to apply the whole queue, in order, before it builds the request. If not, the request goes out unchanged and reads the cache in full.

The card keeps its own rhythm. Its 20k of growth counts from the model's last judgement, a card or an accepted call, and not from the moment a fold is applied. A queue that is waiting does not hold the card back. The model is asked about closure while the work is fresh, whatever the moment the fold takes effect.

## The cost model

Here is the request about to be sent, with the queue not yet applied:

{{< ft "layout" >}}{{< /ft >}}

- $L$ is the length of the request in tokens.
- $S$ is the stable prefix: everything before the first byte a fold changes. A fold appends a title to the cover and does not change the lines before it, so $S$ ends at the cover.
- $D$ is the **debt**: the tokens the queued folds would remove.

Applying the queue now costs a write of what is left after the fold point, less the read the unchanged request would have paid for the same stretch:

$$E = w\,(L - D - S) - r\,(L - S)$$

After that, every request that still finds the cache warm is $D$ tokens shorter and saves $r \cdot D$.

Two facts follow from this, and the rule is built on them.

1. **Folds share a rewrite.** Three queued folds applied together cost one $E$, computed with the sum of their debts. Applied one at a time they cost three.
2. **A cold cache makes a fold free.** If the request will miss before the cover anyway, the rewrite is already paid for. Applying the queue then only makes the rewrite shorter.

## The rule

At each main-loop request with a fold queued, the host applies the whole queue when any of these holds:

1. **Cold.** The request will miss before the cover whatever happens: more time has passed since the last request than the marks' TTL, the model or route changed, or the tools or system prompt changed.
2. **Pressure.** The request, unfolded, would reach compaction's trigger. The queue goes first; compaction runs only if the request is still over.
3. **Pays.** $r \cdot D \cdot h \geq E$: the reads saved over the next $h$ warm requests at least repay the rewrite. $h = 20$.

Otherwise the folds stay queued.

Rule 3 rearranges to a ratio between two parts of the request:

$$\frac{D}{L - S} \;\geq\; \frac{w - r}{r\,h + w}$$

$L - S$ is everything a fold would rewrite. $D$ is the part of it the fold removes. Apply when the removed part is a large enough share of the rewritten part. The threshold depends only on the prices and $h$:

| binding | $r$ | $w$ | apply when $D \geq$ |
|---|---|---|---|
| `claude-opus-5-5`, 1-hour marks | 0.05 | 2 | $0.65\,(L - S)$ |
| an Anthropic model with $r = 0.1$ | 0.1 | 2 | $0.48\,(L - S)$ |
| DeepSeek, no write charge | 0.02 | 1 | $0.70\,(L - S)$ |

{{< ft "rule" >}}
One request, one decision, computed as the Bend core computes it. Drag the debt past the dashed line and the verdict flips. Then change the prices, or tick *cold*.
{{< /ft >}}

This is also why no fixed fraction of the context window can stand in for the rule. "Fold at 50%" measures how full the window is. The decision depends on how the request is split into $S$, $D$ and the rest, and on whether the cache is warm. A fixed fraction folds too late when the debt is large and the cache is warm, and it pays for a rewrite at the threshold even when the cache went cold one request earlier.

## Rent or buy

The rule is a known kind of decision. Keeping a fold queued is *renting*: each request pays $r \cdot D$ to read the debt again. Applying it is *buying*: one payment of $E$, after which the rent stops. It is the ski-rental problem with a prompt cache in place of skis.

The textbook answer, with no prediction, is to rent until the rent you have paid equals the price, then buy. That never costs more than twice the optimum, whatever the future. The guarantee is against an adversary who ends the session right after each purchase. Sessions are not adversaries. Their warm runs are long and their debts are large, a median of 40k tokens per fold, so buying early is usually right. The textbook rule pays for its guarantee on every fold.

{{< ft "rent" >}}
One queued fold, with `claude-opus-5-5`'s prices. Waiting costs $r \cdot D$ per request until the cache goes cold, after which the fold is free. Applying costs $E$ once. The rule looks only as far as $h = 20$. Move the cold point: the rule cannot see it, and sometimes it guesses wrong. A single fold is the rule at its weakest. In a real session it decides again at every request, while the debt grows.
{{< /ft >}}

The rule above predicts instead. $h$ is an estimate of how many warm requests are left, and the rule buys as soon as the rent over that horizon covers the price. Because $E$ is paid once for the whole queue, small folds wait and batch until together they are worth one rewrite. Because a cold cache drops the price to zero, every fold is applied at the moment it becomes free.

I replayed the policies on 22 recorded sessions with folds in them: 5,131 main-loop requests and 207 folds, each request with the usage the provider reported and its time, priced from the models.dev catalog. The replay moves folds later: a queued fold's debt is added to every request until it is applied, a request that missed only because of a fold becomes a hit, and an apply costs a read of $S$ and a write of the rest. Replaying "apply at once" this way gives 286.85 dollars against 287 recorded, which checks the model.

| policy | total cost, USD | vs. optimum |
|---|---|---|
| never fold | 1304 | +407% |
| apply every fold at once | 287 | +12% |
| rent-or-buy without prediction | 279 | +9% |
| **this rule, $h = 20$** | **261** | **+1.6%** |
| offline optimum | 257 | |

The optimum is a dynamic program over the same requests. It knows every future request and picks the cheapest set of apply points, so no online rule can beat it. On the longest session, 1,163 requests and 65 folds, the figures are 83 dollars at once, 72 for rent-or-buy and 67 for the optimum.

The dollars are catalog API prices. These sessions ran on a subscription, so they stand in for the subscription's usage, and I assume the two are proportional.

## Where h = 20 comes from

$h$ is how many more requests a saving lasts: how long until the cache goes cold, from a gap longer than the TTL or from a change before the cover. I measured it.

In the replayed sessions, a run of requests between two cold points has a median length of 40 (quartiles 12 and 78, over 96 runs). A fold becomes ready somewhere inside a run, on average half-way, so about 20 requests are left to benefit from it.

The sweep agrees:

| $h$ | 5 | 10 | 20 | 40 | 80 | 160 | ∞ |
|---|---|---|---|---|---|---|---|
| cost, USD | 287 | 271 | **261** | 263 | 271 | 277 | 287 |

The two ends are the two naive policies. $h = \infty$ applies every fold as soon as it is queued. $h$ near 0 waits for a cold cache, which approaches never folding. The minimum is flat: every $h$ from 10 to 40 is within 4% of the best, so an estimate that is wrong by a factor of two costs little.

$h$ is one constant for every session and every model. Twenty-two sessions are too few to fit a per-session estimate without fitting noise, and the flat minimum leaves little to gain.

## The merge rides on the apply

The second post said that the title list is merged only when a unit closes, because a close already rewrites the tail and the list sits right in front of it. With the queue, "a close" is now the moment a fold is *applied*, not the moment the model calls `fold_unit`. Nothing else changes: the titles of an applied batch are appended to the cover one by one, and the settle runs on the same request.

So the merge still never pays for a rewrite of its own. It pays only for the part of the cover after the first changed line, on a request that is already rewriting everything behind it.

## The queue is state, not history

A queued fold has not happened yet, so it is not in the session file. It lives in a sidecar file beside the session, next to the cache fingerprint. A restart reads the queue back, and the session format did not change.

The order of writes is chosen for the crash. Applying a fold first writes the shortened queue to the sidecar, then the fold record to the session file. A crash between the two loses a title, and never applies a fold twice. A lost title costs little: the span stays unfolded, and the next card offers it again.

A restored queue is checked the way fold records are. Each queued fold must start where the one before it ends, and end at a position the session file holds. A queue that does not check out is dropped as a whole.

Folds are applied one at a time, first to last. One that fails to apply stays queued with every fold after it and is tried again at the next request; the ones before it stay applied.

## What Bend proves

The decision is a pure function of a handful of numbers. So it is a Bend unit, `foldtime`, and the shell only measures. It renders the request to get $L$, $S$ and $D$, compares timestamps and hashes for coldness, and looks up the prices. Then it asks the core one question: apply or not.

The prices enter as integers in one unit, with $r$ and $w$ multiplied through by the input price, so the rule is integer arithmetic. Subtraction stops at zero. If an estimate puts $D + S$ past $L$, nothing is left to rewrite that the fold does not remove, and the fold pays.

Seven laws. Each was falsified on random instances before it was proved, and the two whose emptiness is not plain from the statement also have a mutant, a deliberately broken core, that must fail them:

| law | says |
|---|---|
| ft_empty | an empty queue is never applied |
| ft_cold | a queued fold is applied on a cold request |
| ft_over | a queued fold is applied at compaction's trigger |
| ft_unpriced | a queued fold is applied when the binding has no known price |
| ft_pays | otherwise, it is applied exactly when $r \cdot D \cdot h \geq E$ |
| ft_debt_monotone | more debt never turns an apply into a wait |
| ft_horizon | with $h$ at least $w \cdot L$, a fold that removes anything is applied, if reads cost anything |

Two of them deserve a word. `ft_debt_monotone` rules out a rule that waits longer the more it would save, which would keep the largest debts in the prompt longest. `ft_horizon` ties the rule to the end of the sweep: an unbounded horizon must mean "apply every fold as soon as it is queued", or the rule in the code is not the rule the sweep measured. It needs the premise "if reads cost anything": with a free read, $r \cdot D \cdot h$ is zero however large $h$ is, and the saving never pays for anything.

`ft_unpriced` is the fallback. A model with no known price gets the old behaviour: every fold is applied as soon as it is queued.
