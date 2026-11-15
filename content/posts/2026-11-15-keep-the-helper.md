---
title: "Keep the Helper, Not the Language: A Prelude for Codemode"
post: 2026-11-15-keep-the-helper.md
date: 2026-11-15T17:00:00+0100
tags: [ai-agents, codemode, lisp, bend, typescript, programming]
series: ["Building My Own Harness"]
series_weight: 60
---

In [the codemode posts](/posts/2026-10-10-codemode-without-a-sandbox/) of this series, my agent acts by writing short JavaScript programs that call its tools. Each program runs in a fresh child process, and nothing it defines reaches the next one. In [the fold posts](/posts/2026-09-28-fold-dont-compress/), old work leaves the model's context as one line per finished unit.

Put those two facts side by side and a long session has an obvious waste. The model writes the same small function in script after script: run bash in this worktree, run the proof checker and keep the last 60 lines. After a fold, it does not even remember that it wrote one.

I wanted to fix that with Common Lisp. This post is about why I didn't. I built a much smaller thing, a *prelude*, and measured what the model did with it. The answer was clear, and it was not the one I had hoped for.

## The idea: a Lisp that grows with the session

I have wanted a real use for Common Lisp for a long time, and this looked like one. Lisp has a tradition of growing the language toward the problem. You write functions and macros until the program reads like a description of the domain. A long agent session seemed to fit that well. Give the model a persistent Lisp image instead of a fresh process per script. Let it keep what it writes. Over a session of weeks it would grow a small language for the project. When that language got big enough, the agent could promote it into a plugin, which my agent can load and reload while it runs.

The safety story looked sound too. The image would run in its own process under macOS's `sandbox-exec`, with no file or network access of its own. It would reach the world only by calling tools back through the daemon, as codemode scripts do now.

## Counting before building

Before building anything, I gave the idea to a stronger model that I consult for verdicts on hard design questions, and asked for objections and the cheapest experiment that would settle it. It came back with two measurements made on my machine.

**The sandbox works.** SBCL 2.6.8 ran under a deny-by-default profile. It compiled code, ran threads and collected garbage normally, while reading `~/.ssh`, starting a process, writing to `/tmp` and opening a socket were all refused. It started in 0.02 s at 122 MB. It also found one trap: a profile written as a *deny list* can fail open without any error. A path rule with a lookahead in its regular expression silently matched nothing, and the write it should have stopped went through. Only a deny-by-default profile is trustworthy.

**There is nothing to accumulate.** It counted every codemode script in my session files: 9,614 scripts in 381 sessions.

- 96% of scripts define no named function at all.
- 1.2% repeat a helper that an earlier script of the same session defined.
- What repeats is one-line wrappers around `bash`.

That count has a limit, and it matters. It was taken from sessions in which a helper *could not* be kept. A model that knows its function will vanish after the script has little reason to write one. So the count says nothing about what the model would do if it could keep code. It only says there is no hidden reuse waiting to be collected.

## The objection that is not about Lisp

The strongest objection was not about Lisp at all. My verdict model called it *DSL amnesia*.

Growing a language toward the problem assumes the author remembers the language. A Lisp programmer at the REPL knows what `find-failing` does because they wrote it an hour ago. My agent forgets by design. Every fold replaces finished work with one line, and the function definitions go with it. The image would keep the language and the author would lose it. A note such as `[lisp: +find-failing]` brings back a name, not a language. A few folds later, the model would be calling functions it no longer knows the shape of, in a language that is foreign to its own author.

This applies to any code a session keeps, in any language. So it had to be solved first, and Lisp could wait.

## The cheapest test

The experiment that followed holds the language fixed. Keep JavaScript and the existing codemode, add one tool for keeping helpers, and see what the model keeps. If helpers pile up over long sessions, and some of them generate code, then a language the model can extend has a case, and the Lisp sandbox is ready. If nothing piles up even when it can, a Lisp image has nothing to grow from.

I fixed the thresholds before switching it on, so that I could not read whatever happened as success:

- fewer than about 5 helpers, called about 20 times in a week: keeping helpers does not pay;
- many helpers, including some that build code as text: a language has a case.

## What a prelude is

A session's prelude is a short list of named helpers, functions and constants, that the model chose to keep. Every later codemode script of that session runs with them in scope, as if they were written above it.

Here is a real one, from a subagent that was proving laws about a Bend unit (its long paths replaced by `TREE` and `PROOF`):

```js
async function sh(cmd, intention) {
  const r = await tools.host.bash({ command: `cd ${TREE} && ${cmd}`, intention: intention || "run in tree unit" })
  return r.output
}
async function chk() {
  const r = await tools.host.bash({ command: `cd ${TREE} && bend-check PROOF.bend --verdict 2>&1`, intention: "check PROOF.bend" })
  return r.output.split("\n").slice(-60).join("\n")
}
async function ins(chunk) {
  await tools.host.edit({ path: PROOF, old_string: "# ---- tr_init ----", new_string: chunk + "# ---- tr_init ----", intention: "insert proof chunk" })
  return await chk()
}
```

Each was kept with one call such as `prelude({action: "define", source: "async function chk() {…}", doc: "chk(): run bend-check PROOF.bend --verdict; return last 60 lines"})`. After that, a script that tries the next proof step is one line: `return await ins(chunk)`.

The decisions that shape it:

- **A helper is kept only when the model asks.** Keeping every named function automatically would fill the list with throwaway code, since most functions are written for one script.
- **A helper is a function or a JSON constant, and nothing else.** No state survives a script. A cache or a cursor that persists would need replaying after a daemon restart, and a replayed state can differ from the one the transcript describes. A constant is copied into each script afresh.
- **Defining a name that exists replaces it.** Otherwise a helper with a bug could only be shadowed by a second name.
- **A definition is checked when it is made, never when it is loaded.** The source must parse as exactly one function declaration, in the subset codemode runs, and its name must not shadow anything a script already has. A bad helper fails the one call that defined it instead of every later script.
- **The helpers are bound in a scope, not pasted above the script.** The scope sits between the built-ins and the script. Pasting the text would shift every error position in the script by the prelude's length. An error inside a helper names the helper.
- **A helper gives a script no new authority.** It reaches the world only through the `tools` object of the script it runs in, and every inner call goes through the same permission check as before.
- **A prelude belongs to one session.** A subagent starts with an empty one. A helper the child needs goes into its brief as source, so the child is never told about helpers its brief does not explain.
- **At most 30 helpers.** A new name at the cap is refused with "remove one, or propose a plugin for the set". Reaching the cap is the sign that the set has earned a plugin of its own. That keeps the promotion path from the Lisp idea.

## The lexicon: what survives a fold

The answer to DSL amnesia is the *lexicon*: one line per helper, always in front of the model.

```text
sh(cmd, intention) — sh(cmd): run bash in the tree unit dir, return output
chk() — chk(): run bend-check PROOF.bend --verdict; return last 60 lines
ins(chunk) — ins(chunk): insert text right before '# ---- tr_init ----' in PROOF.bend via edit; returns chk() output
```

Two choices make it work. First, the doc line is required, at most 160 characters, and written at define time. That is the one moment the model is sure to know what the function means. A note written in a rush before a fold is exactly the kind that comes out thin. Second, the line is generated from the stored helpers, not from the model's memory, so it cannot drift away from what the scripts actually get.

The harder question was where the lexicon lives in the request. There were three candidates.

- **The tool result only.** The `define` call answers `kept: <line>`. That is free, but the result sits in the conversation, and a fold takes it away with everything else. That is the failure the lexicon exists to prevent.
- **A system-prompt section.** It survives folds, but the system prompt is near the front of the cached prefix. Every define would change it, and everything after it would be written to the cache again.
- **A host hint.** My agent already has a way to keep a changing list in front of the model, the same one its agenda uses. The list is written into the system prompt when the prompt is sealed, which happens only when the cache has gone cold anyway. Each change in between is said once, as a short note at the tail of the conversation: `Prelude changed since the system prompt:` followed by `+ <line>`. A define then costs a few tokens and no rewrite.

{{< pl "lexicon" >}}
A made-up session, one request per step. Choose where the lexicon line is kept and step through it. As a system-prompt section, the define at step 3 makes every block after the prompt be written again at step 4. As the call's result only, the line is folded away at step 6, although `sh()` is still in scope in every script. As a hint, the define costs one short note, and a fold while the cache is warm costs a second one. Tick the box to apply the fold after a break, when the cache is cold anyway.
{{< /pl >}}

Drawing this figure showed me a hole in the hint, and I fixed it before publishing. The note that said `+ sh` sits in the conversation, so a fold can take it away. A fold applied while the cache is warm does not reseal the system prompt, and the prompt was sealed before the define, so it does not have the line either. The host remembered that it had already told the session and did not say it again. Until the next cold boundary, nothing in the request named `sh()`. The rule from [the previous post](/posts/2026-11-15-when-to-fold/) applies most folds when the cache is cold, and the reseal there puts the line back. But a fold that pays while the cache is warm opened the window, and my agent's agenda, delivered the same way, had the same hole. The design document had listed this path as an assumption, not as something checked.

The fix makes a fold forget what it told. The host keeps two lists: what the sealed system prompt carries, and what the model has been told since. A fold resets the second list to the first, so the next check says again every change the prompt does not have. Choose the hint, leave the box unticked, and step to request 6: the note `+ sh` comes back after the fold. The fix is coarse on purpose. A note that was still in the unfolded tail is said twice; knowing which notes a fold took would mean storing the turn of every note, to save a few tokens. Inside one turn, the repeat can arrive one request late, because the check runs before a fold that is applied just before the request is sent.

## A Bend unit for thirty lines

Everything about the prelude's content is decided by a small core written in [Bend](https://bend-lang.com), as every decision in my agent is. The plugin parses the source with the same parser codemode uses and hands the core what it found. The core decides the action, every refusal and its order, the cap, the lexicon lines, and whether a prelude file read back at start is valid. The laws are what you would expect, but they are proved for every input:

- a refused call leaves the prelude as it was;
- after any accepted call the prelude is within every limit, its names distinct;
- `define` of an existing name replaces exactly that entry, in its place; `define` of a new name appends it and keeps the others in order;
- `remove` takes out exactly the named helper; `show` and `list` change nothing;
- a define is refused at the cap exactly when its name is new;
- the lexicon has one line per helper, in order.

It is small, but a refusal that half-applies, or a replace that moves a helper to the end, would make the lexicon lie, and the lexicon is the only thing the model has after a fold.

## Nobody used it

It took two tries before the model used it at all.

The first version was a plugin I loaded myself. In my agent, a plugin's tool is asked about until the user allows it, so every define put a question in front of me. A test that measures whether the model keeps helpers should not also measure whether I click "allow". So the prelude became a default plugin, whose tool is built in and never asked about.

It was still reachable only from inside a codemode script, as `tools.host.prelude`. For the rest of that day, about 14 hours, no session defined a helper, except the one in which I was building the prelude. About 20 sessions were active, and the tool was in each one's list of codemode tools.

This was the same finding as the first codemode experiment, where a model offered a script tool next to plain tools chose it in 3 of 16 runs. A model reaches for the tools it is shown, and a tool listed only inside another tool's description is barely shown.

I had argued against making it a direct tool. Defining from a script seemed natural, I said, because the function was already written there, and a direct call would mean pasting its source as a JSON string. That was wrong: `define` takes the source as a string either way, so a script passes a string literal too. A direct call costs no more and skips starting a script process. The real cost is the tool's schema, about 1.3 KB, sent on every request.

So `prelude` became a direct tool. I deliberately left the rule of use looking backward: "When you write the same thing in a second codemode script, keep it as a helper here, with a one-line doc." I could have asked the model to plan its helpers before a task, but then the week would have measured instructions being followed, not whether a model keeps code on its own. And a helper defined in advance has never run. Writing code in a script, seeing it work and then keeping it means only tested code gets kept.

The comparison is weak, and I want to say so plainly. Fourteen hours is short, and the days before and after held different work. The one firm fact is that every define after the change was a direct call.

## What the model kept

Four days after the change, I counted from one machine's session files, with no model calls: regular expressions over the calls' arguments and the scripts' text, so a few helper calls may be miscounted.

- **25 sessions** defined helpers: 21 subagents and 4 main sessions.
- **37 helpers** were held. No session held more than 5, so none came near the cap.
- **367 of 2,258 scripts** in those sessions call a helper. In a subagent most scripts do: 36 of 47, 40 of 52, 30 of 41.
- **Six helpers were replaced after use.** `insertAndCheck` was redefined three times. Fixing a helper in place gets used.

{{< pl "kept" >}}
One machine, four days after `prelude` became a direct tool. Top: every helper held at the time, by what it does; point at a bar for examples. Bottom: the scripts that call a helper, in the three subagents that used them most, and across all 25 sessions that defined one (those totals include scripts written before the prelude existed).
{{< /pl >}}

The kinds are what tell the story. Almost every helper fixes the *setting* of the task in hand: the worktree it runs in, the pinned toolchain on `PATH`, the proof file it edits, how much output to keep. These are the same one-line `bash` wrappers that the old corpus found repeated, now kept instead of retyped. Retyping costs tokens, and it costs mistakes too: the worktree path gets one directory wrong, or the pinned toolchain drops off `PATH`.

A subagent shows the pattern most clearly. It gets one task, defines one or two helpers in its first few scripts, calls them until the task is done, and ends. The helpers end with it.

The long main sessions are where a language would grow, and none did. In one session of 582 scripts, a helper that evaluates elisp in my running Emacs was called 37 times. Another session of 496 scripts kept one helper and called it once. A third kept only a constant, which no script ever used. I come back to that constant below.

One helper builds code as text. A subagent writing proofs kept this:

```js
function mac() {
  const LS = "List<&2, C.Sess>", LN = "List<&2, Nat>"
  return { LS, LN,
    INV: (nx, n, ss, ar, l) => `Laws.inv(C.State{${nx}, ${n}, ${ss}, ${ar}, ${l}}) == True{}: Bool`,
    fields: "+i: Nat, +k: C.SKind, +p: Nat, +st: C.Status, +a: Bool, +r: Bool, +t: Nat, +q: " + LN, … }
}
```

It returns Bend type strings and a template for a law line, and five scripts called it. This is the macro-shaped use the experiment was looking for. It is also one case.

## The verdict

Against the thresholds I set beforehand, keeping helpers clearly pays: far more than five helpers, called far more than twenty times. So the prelude stays as a standing tool. When a session has no use for it, the cost is the schema in each request and an empty lexicon.

But what pays is a helper for the task, not a vocabulary for the session. Nothing grew. The persistent Lisp image would add two things the JavaScript prelude does not have, macros and a long-lived process, and nothing observed needed either. One code generator shows the need exists, not that it is common. So I am not building the image. Two things would reopen the question: a session whose helpers keep growing toward the cap, or code generators in several sessions. The counting script is kept, so I can check for both again.

One thing is not measured: whether one line per helper is enough for the model to call a helper it wrote before a fold, without reading its source first. Most sessions that kept helpers were too short to fold.

## The constant that had nowhere to go

The constant from the third long session showed a gap.

That session kept `UNIT_PREAMBLE`, a 4,119-character shared opening for subagent briefs: the context, the reading map and the rules that five sibling tasks had in common. Then it sent twelve briefs, and every one started with that opening, typed out in full. At one point it called `show` to read the constant back, and then typed it out again anyway.

It could not do anything else. A prelude constant is in scope only inside a codemode script, and the tool that starts a subagent was offered only as a direct call. No route led from the constant into a brief. So the model wrote the same 4 KB of output twelve times.

The fix was not a new mechanism, such as expanding constant names inside every tool's arguments. That would make the transcript show something different from what the tool received, and there was one case. A script can now call the subagent tool. Then sending several similar tasks is one script: the shared part kept once as a constant, each task's own part beside it, all sent together. My agent's instructions now say exactly that.

I started out wanting the model to grow a language. What it actually needed to keep was a paragraph it could say once.
