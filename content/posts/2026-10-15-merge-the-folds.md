---
title: "Merge the Folds: A Binary Counter Over the Title List"
post: 2026-10-15-merge-the-folds.md
date: 2026-10-15T12:00:00+0200
tags: [ai-agents, llm, bend, programming]
series: ["Building My Own Harness"]
math: true
---

[Last time](/posts/2026-09-28-fold-dont-compress/) I argued that an agent should not wait for the context window to fill. When a unit of work closes, the model says so, and the host replaces that unit's turns with one title line and archives the originals to disk. I called it a fold, and I left compaction in place as the emergency path.

Folding solved the problem I had. It created a smaller one, and this post is about that one. After enough folds the prompt has three parts: the standing part (system prompt and tool list), a flat list of titles, one per closed unit, oldest first, and the open tail where the work is happening. The list grows by one line per unit and never shrinks. My longest session so far has 455 closed units. Its title list is 82 KB, about 23k tokens, and it sits in front of every request.

So the title list needs its own fold. The only move that shortens it is a **merge**: replace a few adjacent titles with one line that stands for them. Everything in this post is about three questions that one move raises. *When* do you merge, *which* lines, and *into what shape*. The answers come from three measurements on real sessions, and the rule they produce is small enough that I wrote it in Bend and proved it.

I will call the title list the **cover** from here on. It is the one page you read before opening the book.

## What a change to the prompt costs

The cover sits in front of the open tail, so any edit to it is an edit in the middle of the prompt. The price of that is set by prefix caching: the provider bills the part of the prompt that matches the previous request at about a tenth, and everything after the first changed byte at full price. On my sessions, about 60% of input tokens land in the cached part.

{{< fc "cache" >}}
The same prompt, edited in two places. An edit at the tail re-bills a few cells. An edit at the front re-bills the whole prompt.
{{< /fc >}}

The cost model for one request is one line. With $|P|$ tokens in the prompt and $c$ of them shared with the previous request:

$$\text{cost} = 0.1 \cdot c + (|P| - c)$$

Changing a byte at position $p$ buys back everything after $p$ once. A fold edits the tail, so it is nearly free. A merge edits the cover, which is before the tail, so it buys back the rest of the cover and the whole tail.

In the last post I simulated the timing of folds on one session and found that the totals came out within about a fifth of each other. I have since replayed 168 sessions, every one with at least 20 model calls, under four schedules and a 100k-token budget. Cost is in token-equivalents: a cached token counts as a tenth.

| schedule | cost | prefix rewrites |
|---|---|---|
| compaction: one summary when the window is nearly full | 123.8 M | 215 |
| fold at close | 101.2 M | 1,301 |
| fold at close, and merge titles in batches of four | 100.8 M | 1,301 |
| fold from the oldest end, only when forced | 162.3 M | 607 |
| no fold at all, ignoring the budget | 258.7 M | |

Two things in that table decided the *when*.

Folding at close is the cheapest schedule, by 18% over compaction, and folding from the front when forced is the most expensive by far. Position is everything, exactly as the cost model says. More rewrites, each at the tail, beat fewer rewrites at the front.

The third row is the one I had been afraid of. Merging titles changed the bill by 0.4% and added **zero** rewrites. The reason is that a merge was scheduled on the same event as a close. A close already rewrites the tail of the prompt, and the cover is right in front of the tail. So a merge that rides on a close pays only for the rest of the cover, which is at most a tenth of the window. A merge on its own turn would pay for the tail again.

So: **merge only when a unit closes.** Never on a turn of its own.

## What a merged line costs the reader

Money says when. It says nothing about which lines to merge, because the cost of a merge does not depend on which lines it touches. What does depend on that is what the model can still find afterwards.

First, how often does the model need a folded unit back at all? In the last post this was my biggest unknown. I now have the count. In the five long-lived sessions, 671 folds led to 6 episodes where the model went back into an archive, which is 0.9%. Four of the six were a literal: a command line, a hash, a host name. One or two greps, under 3 KB appended at the tail. The other two were the same mistake twice: the first turns of a session were a design discussion, folded one turn at a time before anything was built on them, and the title said *that* a structure was settled and not *what* was settled. That is the "folds too early" case from the last post, and it has a rule now: a turn that settles a design is not closed until its decisions are in a file or in the title.

Also worth saying: the model never found anything by reading the cover. Every genuine re-open was a grep on the archive path named in the fold message. The cover is for orientation, what happened in this session and in what order. Finding a detail is grep's job.

Then, what does a merged line hide? I took the same five sessions, 672 folds, and had a small model write a merged line for every possible block of adjacent titles: a block of up to 16 from the titles themselves, a larger block from the lines of its two halves. Then I wrote 184 questions, each asking for one concrete detail from one fold, and had another small model pick the line to open while looking only at the cover.

| units under the line | 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128+ |
|---|---|---|---|---|---|---|---|---|
| target found | 71% | 67% | 62% | 40% | 26% | 26% | 13% | 0% |

Three findings from this, and they set the other two answers.

**The cost is the block's size, and nothing else.** With no merging at all, the found rate is flat across age: between 57% and 82% in nine age bins, with no trend in either direction, 80% for the oldest and 71% for the newest. Once lines are merged, the misses sit exactly where the blocks are. The schedule chooses *which* units pay the price, not how big it is. Past 64 units a line is a label with nothing behind it. And the loss is convex: pairing two single titles costs 0.07 found-folds per line saved, going from 8 to 16 costs 2.2, from 64 to 128 costs 16. One big block loses more than many small ones put together.

**A bigger budget is better, and cheap.** Found rate rose from 29% at a 1 KB cover to 69% at 128 KB with no plateau. The cover's share of the session's prompt spend was under 1% at every budget from 8 KB up, because the cover is almost always a cache hit. Money does not decide the budget. But there is a floor: at 2 KB the 455-unit session rewrote its cover 94 times, once every five closes. Why there is a floor is in the next section.

**The order does not measurably matter.** I compared two orders, oldest-and-smallest first against smallest-block-first. 43.7% against 46.8% found, which is inside the small model's own run-to-run noise. The order is a parameter, and I pick it by reasoning, not by data.

## Aligned blocks: a line is written once

Here is the question I had skipped. "Replace adjacent titles with one line" allows any run of lines. Which runs should be allowed?

Think of a ruler whose marks double: 1, 2, 4, 8. A mark of size 2 appears only at even positions, a mark of size 4 only at multiples of 4. Cut blocks only along the marks: a block's size is a power of two, and its start is a multiple of its size. Call such a block **aligned**. Number the closed units in order, 0 to $n-1$. A block of size $2^j$ is at **level** $j$; a unit on its own is a block at level 0.

{{< fc "forest" >}}
Thirteen units. Top: every aligned block that exists, one row per level. A block is drawn only when all its units have closed, so `[12]` has no partner and `[8–11]` has no parent yet. Below: three legal views over the same units, and the cover each one renders to.
{{< /fc >}}

Alignment buys one thing: every block is exactly two blocks of the level below. `[0–7]` is `[0–3]` and `[4–7]`. There is never a `[0–5]` or a `[3–6]`. So the aligned blocks over $n$ units form a forest of binary trees, and any two of them are either disjoint or nested.

That is what makes a merged line **written once**. A line for a block comes from two possible inputs: the titles of its units if the block is small (at most $R = 16$ units, about 1,000 tokens of titles, which a cheap model reads in one go), or the lines of its two children if it is bigger. Both inputs are immutable. Titles are fixed when the unit folds. A child's line, once written, is never rewritten, because its own inputs never change. So each block gets its line at most once in the life of the session, and with $n$ units there are at most $n - 1$ merges, which bounds the number of lines ever written.

Without alignment that falls apart. Write a line for `[0–5]`, then decide later you want `[2–9]`. They overlap, the first line is useless as an input, and you read eight titles again.

A **view** is a set of blocks that partitions $0..n-1$ with no overlaps, where every block has a line. The prompt renders a view as one line per block, oldest first. A merge is now precise: two adjacent blocks in the view that are the two halves of one parent are replaced by the parent. `[4–7]` and `[8–11]` are adjacent but `[4–11]` is not aligned, so they can never merge.

### The coarsest view is the binary expansion of n

How short can a view get? Thirteen units, merged as far as possible: the biggest aligned block from 0 is 8, then from 8 the biggest that fits is 4, then 1. So $13 = 8 + 4 + 1$ and the coarsest view has three lines. That is $13 = 1101_2$: one line per one-bit of $n$. No view can have fewer lines, because every view writes $n$ as a sum of powers of two and the binary expansion is the shortest such sum.

This number is tiny. For $n < 16$ it is at most 4 lines, for $n < 4096$ at most 12. Whatever the session's length, the cover can be squeezed to about a dozen lines.

And closing a unit is a binary increment. The new unit is a level-0 block at the end of the view. If its left neighbour is also at level 0 and they are partners, merging them makes a level-1 block, like a carry. The host keeps the forest as a list of trees newest first, and a close is a push with a carry. Alignment is the shape of the data, not an arithmetic check.

## The rule

The host holds one thing, the **view**: a list of blocks, oldest first, each with a line, that together cover units $0$ to $n - 1$. Two events change it, and one reads it.

```
close(title):                       # the model folded a unit
    append block [n] at level 0, with `title` as its line
    n += 1
    settle()

settle():
    if lines(view) <= B: return                   # within budget, do nothing
    while lines(view) > L:                        # L = B/2
        pairs = adjacent blocks in view that are the two halves of one parent
        if pairs is empty:                        # the view is at its floor
            report it; return                     # never drop a unit
        (a, b) = the top pair by rank
        if parent(a, b) has no line:
            write(parent(a, b))                   # a cheap model; its whole prompt is the inputs
        replace a, b in view by parent(a, b)

write(block):
    inputs = titles of its units        if the block has at most R units
           = lines of its two children  otherwise
    one line, at most t tokens, written once and never again

zoom(block):                        # read-only, outside the prompt
    a block  -> the titles of its units, in order
    a unit   -> its archive
```

Four things to notice.

**Close is the only event that touches the cover.** A close has already rewritten the tail, and the cover sits right in front of it, so a merge made during the same settle costs only the rest of the cover. A merge on any other turn would pay for the tail again.

**A line is written only when settle is about to merge the block.** No measured session ever needed a merge at the budget below, so a line written early would usually never be shown, and it costs real output tokens. Lazy writing means every line that exists is a line that was displayed.

**Settle never invents and never drops.** A pair whose parent has no line yet is written first, then merged. If no pair can be merged, the view is reported as stuck, and every unit stays.

**Finding a detail is grep, not zoom.** Zoom shows what is under a line, in order. Every genuine re-open in the measured sessions was a text search on the archive path, so the view is for orientation only, and a line is written as a summary rather than an index.

### Where the shape comes from

The shape of this rule is not mine. It is Victor Taelin's, from [OptMem](https://github.com/VictorTaelin/OptMem) and [OptChat](https://gist.github.com/VictorTaelin/91837951a5ce5b38f341ec1ba1df6449): a log that is only appended to, a binary tree of one-line summaries over it where each node is built once from its two halves, a view that is a list of tree nodes covering the whole log with recent lines fine and old lines coarse, and a zoom that opens a line into the two it was made from. The merge order in OptChat comes from his rollback-netcode push, which is the same binary counter as the carry in the last section. The three differ in what a leaf is:

| | a leaf is | who decides a leaf exists |
|---|---|---|
| OptMem | one durable note, a line the agent chose to remember | the agent, with `memo note` |
| OptChat | every message in the chat, compressed to one line | the host, for every message |
| fold cover | one closed unit, with its title as the line | the model, when it judges the work done |

Everything about the tree carries over unchanged. Moving the leaf up to a closed unit changes two things, and both are about cost. A unit is already a summary of its turns, written by the model that did the work, so the tree starts one level higher and no cheap model ever reads a raw transcript. And a unit closes only at the tail, so every event that reaches the tree is already a tail rewrite. That is why the two timing choices above go the other way from OptChat: OptChat merges when the view passes a size and builds every node in the background as soon as its halves exist, which is right when every message is a leaf and nodes are cheap to build; here a merge waits for a close, and a line waits for the merge that will show it.

### Why settle to half the budget

The obvious stopping point is "just under $B$". It is wrong. One close later the view is over $B$ again, and the cover is edited on every close, which means the tail is re-billed on every request.

{{< fc "saw" >}}
Lines in the view against closes, with $B = 8$. Top: settle to just under $B$, and the view moves on every close. Bottom: settle to $L = B/2$, and the next $B/(2t)$ closes touch nothing. Each dot is one edit to the cover.
{{< /fc >}}

Settling to $L = B/2$ leaves half the budget free, so the next settle is at least $B/(2t)$ closes away, where $t$ is the size of one line. Over $n$ closes the cover is edited at most $2nt/B$ times. With my numbers, a 27k-token budget and $t \approx 60$, that is about 225 closes between edits. The two thresholds are different on purpose. It is hysteresis.

### The floor

A view cannot have fewer lines than the one-bits of $n$, and in the worst case, $n = 2^d - 1$, that is $d = \lfloor \log_2 n \rfloor + 1$ lines. If $L$ is below that, settle merges everything it can and still stops above $L$, a few lines under $B$. Then the next few closes push it over again. That is the 94 rewrites at a 2 KB budget: $455 = 111000111_2$ needs six lines just for its trees, and a 2 KB budget held about ten. The condition is

$$B \geq 2\,(\lfloor \log_2 n \rfloor + 1)\, t$$

which is about 1,400 tokens for $n < 4096$. A budget of a tenth of the window is twenty times that, so the floor never binds. It says what a budget must not be.

### The constants

| constant | value | why |
|---|---|---|
| $B$ | $0.1 \cdot W$ | under 1% of the session's spend at that size, and every measured session fits in it unmerged. A fraction scales with the window; a byte count does not |
| $L$ | $B/2$ | hysteresis: at most $2nt/B$ edits over $n$ closes |
| floor | $B \geq 2(\lfloor \log_2 n \rfloor + 1)\,t$ | below it the cover is rewritten every few closes |
| $R$ | 16 | the largest block whose line is written from titles rather than from its children. It only bounds the writer's prompt |

### Rank

Settle may face several mergeable pairs, and a strict order decides which goes first. The proofs below hold for any order, so this is a policy, not part of the rule. Two orders have names.

- **Smallest first**, oldest among equals. A bigger block is formed only when no smaller pair is left, so the deepest block in the view is as shallow as the line count allows. The view holds at most two block sizes at a time. This is the default, because the measured cost is the block's size.
- **Age over size**, OptChat's order: for the pair's parent, its age divided by its size, largest first. OptChat calls this *due*, how long ago the pair ended measured in its own line size, and it reproduces the rollback push exactly when the budget is the push's own length. The oldest lines come to stand for the most units, and the cover settles into geometric rings, the same number of lines per doubling of age.

The data separates them by 3 points, in favour of smallest first, within noise. Of the six real re-opens, four went to the oldest tenth of the session, the early design decisions. Nothing I have says old units are asked for less.

{{< fc "sim" >}}
The rule, one close at a time. Guess what the next close does, then press. Filled blocks are the view, the red pair just merged, dashed blocks exist but are not shown. "View moved" counts settles that merged at least one pair. Try $B = 3$ and keep closing to see the floor.
{{< /fc >}}

With $B = 8$, smallest first, and eight single lines in the view, the ninth close goes over budget and settle aims for 4. It pairs `[0]+[1]`, `[2]+[3]`, `[4]+[5]`, `[6]+[7]` down to five lines, then `[0–1]+[2–3]` down to four: `[0–3] [4–5] [6–7] [8]`. Five lines written, one edit to the cover. Drop $B$ to 3 and the floor shows up at $n = 7$: the view is `[0–3] [4–5] [6]`, three lines, nothing left to merge, and $L = 1$ is out of reach. At $n = 15$ the coarsest view itself has four lines, more than $B$.

## What Bend proves

The rule is small, and its promises are the kind that a test can only sample. So the core is written in Bend as a total function, and the promises are laws with proofs that the kernel checks. The rank is not in the proof. It is a parameter, and the laws hold for any strict order.

The core keeps the forest, newest tree first. A node is what the prompt shows for a block: a `Leaf` is a unit with its own title; `Merged` is a block shown as one line; `Split` is a block shown as its two children, with a flag saying whether the host has written this block's line yet. Lines in the view are the nodes shown. Merging a `Split` whose line is written and whose children are both shown turns it into a `Merged`, and two lines become one. A `Split` whose line is unwritten is never merged: the rule invents nothing. Thirteen laws, in seven groups:

| group | says |
|---|---|
| covers | a close adds exactly one unit; settle and write add or drop none |
| aligned | every tree stays complete and the tree levels strictly increase from the head, so every block holds $2^{\text{level}}$ units and starts at a multiple of that, inside $0..n-1$ |
| written | settle never merges a block whose line is missing |
| budget | after settle the view has at most $b$ lines, or no pair was mergeable. The stuck case is reported, never papered over |
| fit_stable | a view within budget is returned unchanged |
| coarsen_only | settle never adds a line; a close adds exactly one; a write adds none |
| quiet | once $\text{lines} + k \leq b$, the next $k$ closes merge nothing. With $L = B/2$ that is the $B/(2t)$ closes of silence after every settle |

Before any proof is trusted, every law runs at literals: 40 closes under three write policies at eleven budgets, plus a few hand-made malformed views. After the proofs, each law gets one mutant, a deliberate break of the rule, which has to falsify the law and break exactly that law's proof. Both gates pass.

What the proof buys is portability. Any host that drives the core gets the same rule with the same guarantee: its cover cannot drop a unit, fold an open one, invent a line, or exceed the budget while a merge is still possible.

## Compaction is still there, for one case

The cover now has a bound. The open tail does not. Between closes it grows with the work, and the host's fold card only asks the model whether something behind it is finished. A unit that will not close, a long debugging session with nothing settled yet, can grow toward the window on its own.

That is what compaction is for now. It fires on the water level, as it always did, but its reach has shrunk to the tail: the standing part and the cover stay in place, byte for byte, so the cache prefix survives, and the summary replaces only the part that has no title yet. In a session that folds as it goes, that part is the current unit, not the whole conversation.

The three mechanisms stack, and each is cheaper than the next because it fires later:

| | fires when | edits | who writes the replacement |
|---|---|---|---|
| fold | a unit closes | the tail | the host, from counts and the model's own closing message, zero model calls |
| merge | a close pushes the cover over $B$ | the cover, down to $B/2$ | a cheap model, from inputs that never change, once per block |
| compaction | the tail alone nears the window | the tail | the main model, from the tail, one call |

An ultra-long session is one where the third row never fires. In the 455-unit session it did not have to: 82 KB of titles fit under the budget without a single merge.

## What I don't know yet

- **The attention cost of a long cover.** It is the reason $B$ is a fraction and not "everything". The found-rate experiment does not measure it. The test I need is the same open-tail question answered with a 1k cover and a 23k cover in front.
- **What is asked for, by age.** Six real re-opens is a small count, and four went to the oldest tenth. The rank waits on this. Smallest first is the default meanwhile.
- **The writing recipe.** The found rate was 71% for a line written from one or two titles, 60% from 8 to 16, 40% from two halves, and 0% two levels further. The writer is asked for a summary, what has lasting effect. The reader needs an index, what is in here. That is a different line, not a different schedule, and it is probably the bigger lever.
- **Where the standing part ends.** The tool list is prefix too, and a tool list that changes mid-session is the most expensive rewrite there is. Same cost model, next post.
