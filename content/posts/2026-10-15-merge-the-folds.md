---
title: "Merge the Folds: A Binary Counter Over the Title List"
post: 2026-10-15-merge-the-folds.md
date: 2026-10-15T12:00:00+0200
tags: [ai-agents, llm, bend, programming]
series: ["Building My Own Harness"]
math: true
---

[Last time](/posts/2026-09-28-fold-dont-compress/) I argued that an agent should not wait for the context window to fill. When a unit of work closes, the model says so, and the host replaces that unit's turns with a short result and archives the originals to disk. I called it a fold, and I left compaction in place as the emergency path.

This post is about what the prompt looks like after a few hundred folds. Each closed unit now stands in the prompt as one **title**: a single line, about 60 tokens, saying what the unit was and how it ended. The rest of the fold result from the last post, the user's words and the model's closing message, stays with the archive on disk. So after enough folds the prompt has three parts: the standing part (system prompt and tool list), a flat list of titles, one per closed unit, oldest first, and the open tail where the work is happening.

The list grows by one line per unit and never shrinks. My longest session so far has 455 closed units. Its title list is 82 KB, about 23k tokens, and it sits in front of every request. That is still under the cap I give it, a tenth of the context window, so no real session has yet needed what this post describes. But a session that runs for long enough will, and the mechanism has to be right before that happens, because the cost of getting it wrong is paid on every request.

The only move that shortens the list is a **merge**: replace a few adjacent titles with one line that stands for them. Everything that follows is about three questions that one move raises. *When* do you merge, *which* lines, and *into what shape*. The answers come from the prompt-cache cost model, from two measurements on real sessions, and from a piece of structure that makes the whole thing cheap. The rule that comes out is small enough that I wrote it in Bend, a language whose checker verifies proofs, and proved its promises.

I will call the title list the **cover** from here on. It is the one page you read before opening the book.

## What a change to the prompt costs

The cover sits in front of the open tail, so any edit to it is an edit in the middle of the prompt. The price of that is set by prefix caching: the provider bills the part of the prompt that matches the previous request at about a tenth, and everything after the first changed byte at full price. On my sessions, about 60% of input tokens land in the cached part.

{{< fc "cache" >}}
The same prompt, edited in two places. An edit at the tail re-bills a few cells. An edit at the front re-bills the whole prompt.
{{< /fc >}}

The cost model for one request is one line. With $|P|$ tokens in the prompt and $c$ of them shared with the previous request:

$$\text{cost} = 0.1 \cdot c + (|P| - c)$$

Changing a byte at position $p$ re-bills everything after $p$ once. A fold edits the tail, so it is nearly free. A merge edits the cover, which is before the tail, so it re-bills the rest of the cover and the whole tail.

In the last post I simulated the timing of folds on one session and found that the totals came out within about a fifth of each other. I have since replayed 168 sessions, every one with at least 20 model calls, under four schedules and a no-fold baseline, with a 100k-token window. The cost counts a cached token as a tenth of a full one, and I give it relative to compaction. A *prefix rewrite* is a request whose prompt changed somewhere before the tail, so the cache missed from that point on.

| schedule | cost (compaction = 1) | prefix rewrites |
|---|---|---|
| compaction: one summary when the window is nearly full | 1.00 | 215 |
| fold at close | 0.82 | 1,301 |
| fold at close, and merge titles in batches of four | 0.81 | 1,301 |
| fold from the oldest end, only when forced | 1.31 | 607 |
| no fold at all, ignoring the window | 2.09 | |

Two things in that table decided the *when*.

Folding at close is the cheapest schedule, by 18% over compaction, and folding from the front when forced is the most expensive by far. Position is everything, exactly as the cost model says. More rewrites, each at the tail, beat fewer rewrites at the front.

The third row is the one I had been afraid of. Merging titles changed the bill by under 1% and added **zero** rewrites. The reason is that a merge was scheduled on the same event as a close. A close already rewrites the tail of the prompt, and the cover is right in front of the tail. So a merge that rides on a close pays only for the rest of the cover, which is capped at a tenth of the window. A merge on a turn of its own would pay for the tail again.

So: **merge only when a unit closes.** Never on a turn of its own.

## Aligned blocks: a line is written once

"Replace adjacent titles with one line" allows any run of lines. Before measuring what a merge costs, I need to say which runs are allowed, because the answer is what keeps merging cheap.

Think of a ruler whose marks double: 1, 2, 4, 8. A mark of size 2 appears only at even positions, a mark of size 4 only at multiples of 4. Cut blocks only along the marks: a block's size is a power of two, and its start is a multiple of its size. Call such a block **aligned**. Number the closed units in order, 0 to $n-1$. A block of size $2^j$ is at **level** $j$; a unit on its own is a block at level 0.

Alignment buys one thing: every block is exactly two blocks of the level below, its **halves**. `[0–7]` is `[0–3]` and `[4–7]`. There is never a `[0–5]` or a `[3–6]`. So the aligned blocks over $n$ units form a forest of binary trees, and any two of them are either disjoint or nested.

A **view** is a set of blocks that partitions $0..n-1$ with no overlaps, where every block has a line. The prompt renders a view as one line per block, oldest first. That rendering is the cover.

{{< fc "forest" >}}
Thirteen units. Top: every aligned block that exists, one row per level. A block is drawn only when all its units have closed, so `[12]` has no sibling and `[8–11]` has no parent yet. Below: three legal views over the same units, and the cover each one renders to.
{{< /fc >}}

Alignment is what makes a merged line **written once**. A line for a block comes from two possible inputs: the titles of its units if the block is small, at most $R = 16$ units, which is about 1,000 tokens of titles and what a cheap model reads in one go; or the lines of its two halves if it is bigger. Both inputs are immutable. Titles are fixed when the unit folds. A half's line, once written, is never rewritten, because its own inputs never change. So each block gets its line at most once in the life of the session, and with $n$ units there are at most $n - 1$ merges, which bounds the number of lines ever written.

Without alignment that falls apart. Write a line for `[0–5]`, then decide later you want `[2–9]`. They overlap, the first line is useless as an input, and you read eight titles again.

A merge is now precise: two adjacent blocks in the view that are the two halves of one parent are replaced by the parent. `[4–7]` and `[8–11]` are adjacent but `[4–11]` is not aligned, so they can never merge.

### The coarsest view is the binary expansion of n

How short can a view get? Thirteen units, merged as far as possible: the biggest aligned block from 0 is 8, then from 8 the biggest that fits is 4, then 1. So $13 = 8 + 4 + 1$ and the coarsest view has three lines. That is $13 = 1101_2$: one line per one-bit of $n$. No view can have fewer lines, because every view writes $n$ as a sum of powers of two and the binary expansion is the shortest such sum.

This number is tiny. For $n < 16$ it is at most 4 lines, for $n < 4096$ at most 12. Whatever the session's length, the cover can be squeezed to about a dozen lines.

And closing a unit is a binary increment. The new unit is a level-0 block at the end of the view. If its left neighbour is also at level 0 and they are halves of one parent, merging them makes a level-1 block, like a carry. The host keeps the forest as a list of trees newest first, and a close is a push with a carry. Alignment is the shape of the data, not an arithmetic check.

## What a merged line costs the reader

Money says when. It says nothing about which lines to merge, because the cost of a merge does not depend on which lines it touches. What does depend on that is what the model can still find afterwards.

First, how often does the model need a folded unit back at all? In the last post this was my biggest unknown. I now have the count. In the five longest sessions, about 670 folds between them, the model went back into an archive 6 times, which is 0.9%. Four of the six were a literal: a command line, a hash, a host name. The other two were the same mistake twice: the first turns of a session were a design discussion, folded one turn at a time before anything was built on them, and the title said *that* a structure was decided and not *what* was decided. That is the "folds too early" case from the last post, and it has a rule now: a turn that decides a design is not closed until its decisions are in a file or in the title.

Also worth saying: the model never found anything by reading the cover. Every genuine re-open was a grep on the archive path that the fold result names. The cover is for orientation, what happened in this session and in what order. Finding a detail is grep's job.

Then, what does a merged line hide? I took the same five sessions and had a small model write a line for every aligned block in them: from the titles for blocks of up to 16 units, from the two halves' lines above that. Then I wrote 184 questions, each asking for one concrete detail from one unit, and had another small model answer each one while looking only at a cover, by picking the line to open and, if that line was a merged block, zooming down through its halves. A question counts as **found** when the model reaches the unit that holds the answer.

| units under the line | 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128+ |
|---|---|---|---|---|---|---|---|---|
| target found | 71% | 67% | 62% | 40% | 26% | 26% | 13% | 0% |

Three findings, and they set the other two answers.

**The cost is the block's size, and nothing else.** With no merging at all, the found rate is flat across age: no trend over nine age bins, from the newest units to the oldest. Once lines are merged, the misses sit exactly where the blocks are. The schedule chooses *which* units pay the price, not how big it is. Past 64 units a line is a label with nothing behind it. And the loss grows steeply with size: going from 1 to 2 units costs four points, from 8 to 16 costs fourteen, from 64 to 128 costs everything. One big block loses more than many small ones put together.

**A bigger budget is better, and cheap.** Capping the cover at a size and merging down to fit, the found rate rose from 29% at a 1 KB cap to 69% at 128 KB with no plateau. The cover's share of the session's prompt spend was under 1% at every cap from 8 KB up, because the cover is almost always a cache hit. Money does not decide the budget. But there is a floor: at a 2 KB cap the 455-unit session rewrote its cover 94 times, once every five closes. Why is in the section on the floor below.

**The order does not measurably matter.** Two orders for choosing which pair to merge first, *age over size* and *smallest first*, both defined under the rule below, came out at 43.7% and 46.8% found, which is inside the small model's own run-to-run noise. The order is a parameter, and I pick it by reasoning, not by data.

## The rule

The host holds one thing, the **view**: a list of blocks, oldest first, each with a line, that together cover units $0$ to $n - 1$. Two events change it, and one reads it.

```
close(title):                       # the model folded a unit
    append block [n] at level 0, with `title` as its line
    n += 1
    settle()

settle():
    if tokens(view) <= B: return                  # within budget, do nothing
    while tokens(view) > L:
        pairs = adjacent blocks in view that are the two halves of one parent
        if pairs is empty:                        # the view is at its floor
            report it; return                     # never drop a unit
        (a, b) = the first pair by rank
        if parent(a, b) has no line:
            write(parent(a, b))                   # a cheap model; its whole prompt is the inputs
        replace a, b in view by parent(a, b)

write(block):
    inputs = titles of its units        if the block has at most R units
           = lines of its two halves    otherwise
    one line, at most t tokens, written once and never again

zoom(block):                        # read-only, outside the prompt
    a block  -> the titles of its units, in order
    a unit   -> its archive
```

The names:

| | |
|---|---|
| $W$ | the context window, in tokens |
| $t$ | the most a line may be, about 60 tokens |
| $B$ | the budget: the most the rendered view may occupy, in tokens. $B/t$ lines |
| $L$ | the low-water mark settle merges down to, $B/2$ |
| $R$ | the largest block whose line is written from its titles, 16 |
| rank | a strict order on mergeable pairs, saying which merges first. A policy, chosen below |

Four things to notice.

**Close is the only event that touches the cover.** A close has already rewritten the tail, and the cover sits right in front of it, so a merge made during the same settle costs only the rest of the cover.

**A line is written only when settle is about to merge the block.** No measured session has needed a merge at the budget below, so a line written early would usually never be shown, and it costs real output tokens. Lazy writing means every line that exists is a line that was displayed.

**Settle never invents and never drops.** A pair whose parent has no line yet is written first, then merged. If no pair can be merged, the view is reported as stuck, and every unit stays.

**Zoom is for reading in order, not for finding.** A line is written, for now, as a summary of what has lasting effect. Whether it should be an index instead is an open question at the end.

### Why settle to half the budget

The obvious stopping point is "just under $B$". It is wrong. One close later the view is over $B$ again, and the cover is edited on every close, which means the tail is re-billed on every request.

{{< fc "saw" >}}
Lines in the view against closes, with a budget of 8 lines. Top: settle to just under $B$, and the view moves on every close. Bottom: settle to $L = B/2$, and the next $B/(2t)$ closes touch nothing. Each dot is one edit to the cover.
{{< /fc >}}

Settling to $L = B/2$ leaves half the budget free, so the next settle is at least $B/(2t)$ closes away. Over $n$ closes the cover is edited at most $2nt/B$ times. With a 270k-token window, a budget of a tenth of it, and $t \approx 60$, that is about 225 closes between edits. The two thresholds are different on purpose. It is hysteresis.

### The floor

A view cannot have fewer lines than the one-bits of $n$, and in the worst case, $n = 2^d - 1$, that is $d = \lfloor \log_2 n \rfloor + 1$ lines. If $L$ is below that, settle merges everything it can and still stops above $L$, a few lines under $B$. Then the next few closes push it over again. That is where the 94 rewrites at a 2 KB cap came from: $455 = 111000111_2$ needs six lines just for its trees, and a 2 KB cap held about ten. The condition is

$$B \geq 2\,(\lfloor \log_2 n \rfloor + 1)\, t$$

which is about 1,400 tokens for $n < 4096$. A budget of a tenth of the window is twenty times that, so the floor never binds. It says what a budget must not be.

### The constants

| constant | value | why |
|---|---|---|
| $B$ | $0.1 \cdot W$ | under 1% of the session's spend at that size, and every measured session fits in it unmerged. A fraction scales with the window; a byte count does not |
| $L$ | $B/2$ | hysteresis: at most $2nt/B$ edits over $n$ closes |
| floor | $B \geq 2(\lfloor \log_2 n \rfloor + 1)\,t$ | below it the cover is rewritten every few closes |
| $R$ | 16 | it only bounds the writer's prompt; no other value was tried |

### Rank

Settle may face several mergeable pairs, and the rank decides which goes first. The proofs below hold for any strict order, so this is a policy, not part of the rule. Two orders have names.

- **Smallest first**, oldest among equals. A bigger block is formed only when no smaller pair is left, so the largest block in the view is as small as the line count allows. This is the default, because the measured cost is the block's size.
- **Age over size**: for the pair's parent, its age divided by its size, largest first. A pair of single titles that ended three units ago is as ready to merge as a pair of 8-unit blocks that ended 24 units ago. The oldest lines come to stand for the most units, so the view keeps about the same number of lines per doubling of age.

The data separates them by 3 points, in favour of smallest first, within noise. Of the six real re-opens, four went to the oldest tenth of the session, the early design decisions. Nothing I have says old units are asked for less.

{{< fc "sim" >}}
The rule, one close at a time, with the budget in lines rather than tokens. Guess what the next close does, then press. Filled blocks are the view, the red pair just merged, dashed blocks exist but are not shown. "View moved" counts settles that merged at least one pair. Try a budget of 3 and keep closing to see the floor.
{{< /fc >}}

With a budget of 8 lines, smallest first, and eight single lines in the view, the ninth close goes over budget and settle aims for 4. It pairs `[0]+[1]`, `[2]+[3]`, `[4]+[5]`, `[6]+[7]` down to five lines, then `[0–1]+[2–3]` down to four: `[0–3] [4–5] [6–7] [8]`. Five lines written, one edit to the cover. Drop the budget to 3 and the floor shows up at $n = 7$: the view is `[0–3] [4–5] [6]`, three lines, nothing left to merge, and $L = 1$ is out of reach. At $n = 15$ the coarsest view itself has four lines, more than the budget.

### Where the shape comes from

The shape of this rule is not mine. It is Victor Taelin's, from [OptMem](https://github.com/VictorTaelin/OptMem) and [OptChat](https://gist.github.com/VictorTaelin/91837951a5ce5b38f341ec1ba1df6449): a log that is only appended to, a binary tree of one-line summaries over it where each node is built once from its two halves, a view that is a list of tree nodes covering the whole log with recent lines fine and old lines coarse, and a zoom that opens a line into the two it was made from. The age-over-size order is his too. It comes from a trick in his rollback netcode, where the saved game states are kept as a binary counter, dense near now and sparse in the past, so that the list stays about $\log_2$ of the ticks long. The three designs differ in what a leaf is:

| | a leaf is | who decides a leaf exists |
|---|---|---|
| OptMem | one durable note, a line the agent chose to remember | the agent, when it learns something |
| OptChat | every message in the chat, compressed to one line | the host, for every message |
| fold cover | one closed unit, with its title as the line | the model, when it judges the work done |

Everything about the tree carries over unchanged. Moving the leaf up to a closed unit changes two things, and both are about cost. A unit is already a summary of its turns, written by the model that did the work, so the tree starts one level higher and no cheap model ever reads a raw transcript. And a unit closes only at the tail, so every event that reaches the tree is already a tail rewrite. That is why the two timing choices above go the other way from OptChat. OptChat merges when the view passes a size and builds every node in the background as soon as its halves exist, which is right when every message is a leaf and nodes are cheap to build. Here a merge waits for a close, and a line waits for the merge that will show it.

## What Bend proves

The rule is small, and its promises are the kind that a test can only sample. So the core is written in Bend as a total function, and the promises are laws, theorems that Bend's checker verifies for every input. The rank is not in the proof. It is a parameter, and the laws hold for any strict order.

The core keeps the forest, newest tree first, so that "aligned" is the shape of the data rather than an arithmetic claim. Each block records whether its line has been written, and a block whose line is missing can never be merged: the rule invents nothing. Thirteen laws, in seven groups:

| group | says |
|---|---|
| covers | a close adds exactly one unit; settle and write add or drop none |
| aligned | every tree stays complete and the tree levels strictly increase from the head, so every block holds $2^{\text{level}}$ units and starts at a multiple of that, inside $0..n-1$ |
| written | settle never merges a block whose line is missing |
| budget | after settle the view fits in $B$, or no pair was mergeable. The stuck case is reported, never papered over |
| fit_stable | a view within budget is returned unchanged |
| coarsen_only | settle never adds a line; a close adds exactly one; a write adds none |
| quiet | once the view has room for $k$ more lines, the next $k$ closes merge nothing. With $L = B/2$ that is the $B/(2t)$ closes of silence after every settle |

Every law is also run at concrete inputs before its proof is trusted, and each law has a mutant, a deliberate break of the rule, that must falsify it. What the proof buys is portability. Any host that drives the core gets the same rule with the same guarantee: its cover cannot drop a unit, fold an open one, invent a line, or exceed the budget while a merge is still possible.

## Compaction is still there, for one case

The cover now has a bound. The open tail does not. Between closes it grows with the work, and the host's fold card only asks the model whether something behind it is finished. A unit that will not close, a long debugging session with nothing settled yet, can grow toward the window on its own.

That is what compaction is for now. It fires on the water level, as it always did, but its reach has shrunk to the tail: the standing part and the cover stay in place, byte for byte, so the cache prefix survives, and the summary replaces only the part that has no title yet. In a session that folds as it goes, that part is the current unit, not the whole conversation.

The three mechanisms stack, and each is cheaper than the next because it fires later:

| | fires when | edits | who writes the replacement |
|---|---|---|---|
| fold | a unit closes | the tail | the host, from counts and the model's own closing message, zero model calls |
| merge | a close pushes the cover over $B$ | the cover, down to $B/2$ | a cheap model, from inputs that never change, once per block |
| compaction | the tail alone nears the window | the tail | the main model, from the tail, one call |

An ultra-long session is one where the third row never fires. In the 455-unit session neither the second nor the third did: its 82 KB of titles fit under the budget without a single merge, and no unit grew to the window on its own.

## What I don't know yet

- **The attention cost of a long cover.** It is the reason $B$ is a fraction and not "everything". The found-rate experiment does not measure it. The test I need is the same open-tail question answered with a 1k cover and a 23k cover in front.
- **What is asked for, by age.** Six real re-opens is a small count, and four went to the oldest tenth. The rank waits on this. Smallest first is the default meanwhile.
- **The writing recipe.** Counting only whether the model's first pick was the right line, before any zooming: 71% for a line written from one or two titles, 60% from 8 to 16 titles, 40% from two halves' lines, and 0% two levels further. The writer is asked for a summary, what has lasting effect. The reader needs an index, what is in here. That is a different line, not a different schedule, and it is probably the bigger lever.
- **Where the standing part ends.** The tool list is prefix too, and a tool list that changes mid-session is the most expensive rewrite there is. Same cost model, next post.
