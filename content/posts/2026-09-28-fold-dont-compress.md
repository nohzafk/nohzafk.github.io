---
title: "Fold, Don't Compress: Let the Agent Close Its Own Parentheses"
post: 2026-09-28-fold-dont-compress.md
date: 2026-09-28T02:40:00+0200
tags: [ai-agents, llm, programming]
---

Every coding agent I use handles a long conversation the same way. It lets the context grow until it gets close to the window, sends the whole thing back to the model with "summarize this", and carries on from the summary. Claude Code calls it auto-compact. Codex does it. My own agent, a small harness written in Rust, did it too.

For a while now my agent has worked another way. I think it is the better default, and I have not seen anyone else talk about it. I call it a **context fold**.

The short version: don't wait for the window to fill. Ask the model, again and again, one small question: *is anything behind you finished?* It is a hard question to answer about the future and an easy one to answer about the past.

## What is the model actually reading?

I measured my own sessions: 221 of them, 853 user turns, 12,268 tool calls. For every request I split the context into three parts:

- the work in progress,
- the conclusions of finished work,
- the *steps* of finished work: the tool calls, their outputs, the dead ends.

With no processing at all, the third part is **two thirds** of what the model reads. The conclusions of that same finished work are about **1%**.

That is not mostly a cost problem. Prompt caching makes old tokens cheap. It is an attention problem. On every turn, the model reads through a long record of how the login test got fixed, only to find out what to do about the build.

## Compression waits for the wrong signal

Compaction fires on the water level. That has three consequences:

1. **The timing has nothing to do with the content.** It fires in the middle of a task, when the context is most useful. The trigger is "the window is full", not "this part is done".
2. **The replacement is a paraphrase, and the original is gone.** The harness may keep a backup file, but the model cannot read it back. Whatever the summary left out does not exist any more.
3. **It costs a model call.** The whole context goes in and a summary comes out, and output tokens are the most expensive kind and cannot be cached.

Here is the same session under both rules. On the left, compaction. On the right, folding.

{{< cf "compare" >}}
Rows are messages. **you ▸** is a user turn, indented rows are tool calls, **◆** is the model's closing message for a piece of work. The fold card thresholds are shrunk to fit the demo. In the real harness the host asks after about 20 tool calls, not after every turn.
{{< /cf >}}

Look at turn 4, "ok, turn it off". It is short and it reads like a new instruction, but it continues the build question. The model sees that and folds nothing. The last unit is still open, so it stays word for word.

## Boundaries are easy in hindsight

The obvious fix is to cut the conversation into tasks and drop the finished ones. The hard part is *where a task starts*.

I tried a lexical rule first and checked its output by hand:

| The rule says | It is right |
|---|---|
| "a new task starts here" | 20–33% of the time |
| "this continues the last one" | 97.4% of the time |

Half of all user messages are 60 characters or less. "all of them need to be improved" and "you decide, it's fine, go ahead" look like new instructions. They are not. And work gets tangled: a new task often starts as a side remark and turns into a task three turns later. Looking forward, you cannot tell.

**Looking back, you can.** When a piece of work is done, the model has just written its conclusion: *fixed, the race was in session setup*. From that end, the start is plain to see. It is like parentheses. When you open one, you do not know how deep you will go. When you close one, you always know which one you are closing.

So the host does not try to find the boundaries. It does what it is good at, which is counting, and filtering out the 97% of turns that are plainly continuations. The model does the one thing only it can do: it judges the content.

## How a fold works

**The card.** When enough work has built up since the last fold (about 20 tool calls, or about 100k tokens), the host attaches a short card to the user's next message. The card lists the turns since the last fold, their sizes and the paths they touched, and each user message word for word. Then it asks one question. The host numbers the turns, so the model picks from a printed menu and never has to count. "Ignore this" is a valid answer. When nothing is closed, the card cost about 250 tokens and that is all.

**The answer.** The model calls `fold_unit(from, to)`. The host checks only that the call is legal: the turns exist, the range is not reversed, there is no earlier fold inside it (folds do not nest, because each level loses a little more), and the turn in progress is not part of it. The unit the model is working in is never foldable.

**The splice.** After the turn ends, the host first writes the original messages to an archive file with a sha256, and only then replaces the range with a single *result* message. That order matters: a result must never point at an archive that does not exist.

**The result.** The host builds the result itself, with **zero model calls**, from three parts:

- a mechanical index: tool calls counted by name, the paths they touched, the number of shell commands. The host counts these, so they cannot be wrong;
- every user turn in the range, **word for word**. The user's decisions are the one thing no tool can find again;
- the model's own closing message for that unit, which it already wrote.

{{< cf "card" >}}
A mock-up. The card's wording is shortened and its turn texts and sizes are made up. The outcome is from a real resumed session: turns 1–4 offered, 1–2 chosen, 337 messages down to 69. The result carried 146 tool calls (116 of them shell commands), 7 paths, both user turns and a 1.7 KB closing message.
{{< /cf >}}

**Reading it back.** The archive is an ordinary file. If the result turns out not to be enough, the model reads the file with `read` or `grep`, the tools it already has. There is no special "unfold" tool and no undo command. An undo would push the wrong way: if a fold can always be undone, nobody has to make the result good enough to stand on its own.

### Why not just trim old tool output?

Some agents cut old tool results on every request. I decided against it, for one rule:

> Anything you drop must have an archive, an address and an index. If it does not, don't drop it.

Trimming has none of the three. It even removes the record that a file was ever read, so the model has to rebuild its state from nothing. I ran a small A/B test: a two-turn task, three runs per arm, with trimming the only difference. Both arms got the right answer. But in turn 2 the trimming arm re-ran every tool call from turn 1: 4, 4 and 4 calls against 0, 1 and 1.

### What it buys

On that resumed session, replaying its real fold points against the same session without folds: the median request was **0.2×** the size, about a fifth. By the end of the session it was a sixth. That is one session. The ratio is solid; I would not generalize from it.

Prompt caching is what worried me. A fold edits the middle of the conversation, so everything after the fold point misses the cache once. I simulated the options. Fold as soon as a unit closes: 217 folds, a median of 17k tokens rewritten each. Wait for pressure and fold then: about 30 folds, a median of 200k each. The **totals came out within 21% of each other**. When you fold does not change how much you rewrite. It only changes whether you pay in many small pieces or a few big ones.

Compaction is still there, as the emergency path:

| | Compaction | Fold |
|---|---|---|
| Fires when | the window hits a trigger line | a unit of work closes |
| Who decides | the host | the model, with one tool call |
| Replacement | a summary, written by the model | a result, put together by the host |
| Model calls | one, over the whole context | zero |
| The original | cannot be read by the model | on disk, with an address |
| Runs | in an emergency | all the time |

## Strategies: the context as a call stack

A fold draws the parentheses after the fact. Sometimes you know in advance. "Go find out why CI is flaky" is a detour, and you know before you start that it will open and close.

For that, my agent has **strategies**. A strategy is a mode: a set of standing instructions, an explicit way in and out, and a label on the status line so the user always knows they are in one. Mechanically, it is a stack frame:

- **Enter** (`strategy_request`, or the user types `/strategy`). The host appends one message at the *tail* of the conversation, with the rules of the mode. It does not change the system prompt or the tool list. Those always stay the same. So the whole prefix is byte for byte what it was, and the next request hits the cache.
- **Inside**, the model works in the same context. It sees everything the main loop saw, so nothing needs to be explained again.
- **`strategy_report`** is the return value. The model rewrites it as the work goes along.
- **Exit** (`strategy_yield`, or the user types `/back`). The whole branch folds away. The main conversation keeps exactly one thing: the latest report.

That is a function call. Push a frame that shares the caller's environment, do the work, return a value, pop. The general-purpose one is **errand**, whose rules are three lines: do only this task, keep the report current, yield when you are done. The others follow the same shape: *triage* works through a queue with the user deciding each item, *intent* is a read-only mode for agreeing on what to build, and *counsel* hands a hard problem to a stronger model.

### The return value is written, not scraped

This is the point I most want to get across. **You cannot get the result of a piece of work out of its transcript afterwards.**

The obvious way to build a strategy is: when the mode ends, read the branch and summarize it. That is compaction again, in a smaller box, and it is lossy for the same reason. The transcript records what happened, not what mattered. Take forty tool calls. Which grep answered the question? Which idea was dropped, and why? Of three edits, which one is the fix and which two were experiments? The model knew each of these *at the moment it happened*: when the log line matched, when the test went green. Afterwards, that knowledge is spread over forty outputs that all look equally important, and whoever writes the summary has to guess it back. That is true even for the same model reading its own transcript. It is reconstructing, not remembering.

So the result is written as the work goes along:

- **`strategy_report` is a slot, not a log.** Each call replaces the previous one, so the report always holds the current state of the work, not its history. The model calls it when it learns something: "3 failures, all EADDRINUSE" at the moment it sees the log, "tests share port 8080; fix: bind :0" at the moment the test passes.
- **`strategy_yield` is an explicit end.** The model says the work is done and gives a reason. The host then takes the last report exactly as it is. Nothing is inferred on the way out, and there is no extra model call to write a summary.

A side effect: if the user leaves in the middle with `/back`, the report is still current. It holds everything learned up to that point, because it was never waiting for the end.

It is the same principle as the fold. A fold result is made of counts and the user's own words, plus the closing message the model wrote when it finished. Neither mechanism summarizes after the fact. **The only accurate record of what mattered is the one written at the moment it mattered.**

## Subagents: a tool that thinks

A strategy is a call on the same machine. A **subagent** is a call to another process. A fresh child sees only the brief it is given. It runs in the background, does its own searching, and hands back a receipt: the conclusion, not the search. From the main loop's side it is just a tool that happens to think. A goal goes in, an answer comes out, and every file it read stays in its own transcript.

The two differ in who is in the loop. Inside an errand, the user can still talk to the model. A subagent runs alone and comes back. And because a fresh child never saw my guess, it cannot hand my guess back to me. That makes it the cheap way to get a second opinion.

{{< cf "stack" >}}
Left: the one conversation the user sees. Middle: an errand pushed on top of it. Its prefix is the main loop's, so entering costs one message, not a rebuilt cache. Watch its report box: it is rewritten while the work happens, and on yield that box, not a summary of the branch, is what goes back. Right: a subagent that starts from its brief alone and runs while the main loop keeps working.
{{< /cf >}}

I measured whether delegating saves money. In my sessions it does not: the main loop already runs on a cheap model most of the time. What it buys is parallel work and room in the context window.

## One shape, three times

In Lisp, once a form has been evaluated, what remains is its value. That is the picture I keep coming back to.

{{< cf "sexp" >}}
The last form is still open, so there is nothing to fold yet. The closing parenthesis is the boundary, and you only get to see it once it is there.
{{< /cf >}}

- A **fold** draws the parentheses after the fact, once the model can see where the work closed.
- A **strategy** opens them on purpose, when you know a detour is a detour.
- A **subagent** evaluates the form somewhere else and sends back the value.

Compaction is what you do when you run out of memory. Folding is what you do when a function returns. A conversation where finished work has been replaced by its value is shorter, cheaper, and, which is the part I care about most, easier for the model to pay attention to.

## What I don't know yet

- **How often the next turn needs something that was folded.** This is the biggest unknown. Two numbers will tell: how often the model reads an archive back, and how often it re-runs a tool it already ran before the fold. A zero on the first is good news: it means the result stood on its own. I have the counters; I do not have enough folds yet to read them.
- **Whether the model folds too early.** It could fold a unit the user is not done with. The damage is limited, since the user's words are in the result and the original is in a file, but I have not measured how often it happens.
- **The boundary numbers.** The 20–33% and 97.4% come from one reader, me, checking once. I trust the direction more than the digits.
