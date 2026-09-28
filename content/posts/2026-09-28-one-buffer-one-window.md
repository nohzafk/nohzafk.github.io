---
title: "One Buffer, One Window: Putting the Input Area Inside the Output"
post: 2026-09-28-one-buffer-one-window.md
date: 2026-09-28T21:05:00+0200
tags: [emacs, elisp, programming]
---

For a long time I talked to coding agents in Emacs through [agent-shell](https://github.com/xenodium/agent-shell). It worked well, except for one thing, and that one thing was the biggest problem: I could not type while the agent was writing its output. I would read the first lines of an answer, know what I wanted to say next, and then wait for the agent to finish before I could start. Every turn broke my train of thought.

So when I wrote an Emacs client for my own agent, the first requirement was an input area that is always available. My first version had two buffers. The conversation was a read-only buffer in one window. The place where I typed was a second buffer, with its own major mode, in a side window under it. I could type at any time — but the split cost me something small every few minutes. Closing a session meant closing twice, once per window. Getting back to the input meant finding out which window had focus, or typing a buffer name like `*agent-input: work*`.

So I moved the input area into the output buffer. It is now a few lines of ordinary text at the end of the conversation. This post explains how that works, and then how I made it stay on the bottom row of the window, down to the pixel. The first part took an afternoon. The second part took a day.

The figures are small models you can operate. Press the buttons: each one computes its answer the way Emacs does.

## Part 1: an input area inside a read-only buffer

The output buffer must stay read-only: the agent writes there, and I must not change its words by accident. The input area must accept typing, at any time, even while the agent writes. This part shows how one buffer does both.

The whole session is one buffer, shown in one window. Read it top to bottom:

{{< obw "layout" >}}
The output fills the window from the top. Right after its last character is the anchor, and after the anchor, on the last rows of the window, is the input area.
{{< /obw >}}

The part after the anchor is the *input area*: a configuration line (model, strategy, effort, context use, queued messages), the prompt `> `, and the draft I am typing. It is plain buffer text. There is no widget and no overlay.

### One position, two jobs

The client already kept a marker for "where does the next piece of output go" (`cordis--insert-marker`). The input area needs a marker for "where does the input area begin" (`cordis--region-start`). These are the same position, so I made them one marker. Two markers that must always be equal stop being equal the first time someone updates one and forgets the other.

So new output is inserted *at the anchor*, and everything after the anchor — configuration line, prompt, draft, cursor — moves forward as one piece.

### Three text properties make the draft writable

The buffer is read-only; only the draft must accept typing. Emacs can do this with text properties alone, because of one rule: **a character you type copies the text properties of the character before it**, except the ones that character lists in `rear-nonsticky`.

The client sets three things:

| property | set on | effect |
|---|---|---|
| `read-only`, with `front-sticky` | the output and the configuration line | nothing can be typed into it, or in front of it |
| `rear-nonsticky (read-only face cordis-prompt)` | the last character of the prompt | a typed character does *not* copy read-only or the prompt's face, so the draft is writable and looks like a draft |
| `keymap` (the input keymap), *not* in the list above | the prompt | every typed character copies the input keymap: `RET` inserts a newline, `C-RET` sends, `M-p`/`M-n` walk history |

Try it. Type into the draft, then let some output arrive:

{{< obw "tape" >}}
Each cell is one character; the bars under it are its text properties. The red wall after the prompt is `rear-nonsticky`: read-only and the prompt's face stop there, the keymap goes through.
{{< /obw >}}

The third row of the table is the one I did not expect to work. `keymap` is a text property that Emacs checks when it looks up a key. So the input keymap needs no minor mode, no overlay, no toggle. It arrives with the prompt, and each character I type passes it on to the next one.

This removes a whole category of state. There is no "input is active" flag to keep in step with focus, because there is nothing to activate. The draft is text in a read-only buffer, and the only thing that makes it writable is that the read-only property stops at the last character of the prompt.

### Taking the keyboard back from `special-mode`

The output buffer's major mode derives from `special-mode`. That mode is for buffers you read, not buffers you type in, so it binds printable keys to commands: `q` closes the window, `SPC` and `DEL` scroll, and `0`–`9` and `-` are prefix arguments. In the input area I could not type `q` — and, worse, I could not type a digit.

A text-property keymap is checked before the major mode's map. That order is what lets one buffer have two keyboards. The fix is two forms in the input keymap:

```elisp
(map-keymap (lambda (key _binding)
              (when (and (integerp key) (<= 32 key 126))
                (define-key map (vector key) #'self-insert-command)))
            special-mode-map)
(define-key map [remap self-insert-command] #'self-insert-command)
```

The first form is a sweep, not a list. It walks `special-mode-map` and takes back every printable key it binds. If a later `special-mode` binds a new key, the sweep takes that one back too — and the test walks the same map, so it notices.

The second form looks redundant. It is not. `special-mode-map` contains `(remap keymap (self-insert-command . undefined))`, and Emacs applies remaps *after* it finds a binding. With the sweep alone, every key finds `self-insert-command`, and then the remap turns it into `undefined`. Switch the two forms off and on:

{{< obw "keys" >}}
Lookup goes top to bottom and stops at the first map with a binding; then the remap pass runs. Try **a** in the input area with only the sweep on.
{{< /obw >}}

In the output, above the anchor, nothing changed: `SPC` still scrolls and `q` still closes the window.

### Scrolling that nobody has to write

The old client had a mechanism to keep the output scrolled to the bottom, and it had grown large: a `cordis-follow` window parameter, a `window-scroll-functions` observer, an initializer on `window-buffer-change`, a `resume-following` command, and a `set-window-point` after every write.

It had a reason to exist. A fully read-only buffer has no natural home for the cursor, so the code could not tell "the user watches the bottom" from "the user scrolled up to read". It guessed from the geometry and moved the window.

With the input area in the buffer, that mechanism became a bug. The cursor now lives in the draft, and every write moved it. If I corrected a word in the middle of my draft and a line of output arrived, the cursor jumped to the end of the draft — 37 characters, in the case I measured.

I deleted all of it, and nothing replaced it. The cursor is in the input area, and Emacs always keeps the cursor's line visible. So new output appears above the input area, older text scrolls up and away, and the input area stays where it is. A terminal gets this effect from a scroll region; here it falls out of where the cursor is.

Twelve tests went away with the mechanism. Two new tests replaced them, and both assert something that must *not* happen: arriving output must not move `window-point`, whether the cursor is in the draft or up in the output.

## Part 2: keeping the input area on the bottom row

That is enough while the buffer is taller than the window. It fails at the start of a session, and it is not quite right later either. The two cases need different fixes.

### A short buffer: pad the top

A terminal owns a screen of fixed height and reserves the bottom rows for the input (I compared how agents do it in [How Coding Agents Draw Their Input Box](/posts/2026-09-28-how-coding-agents-draw-the-input-box/)). The input's position is fixed by construction.

An Emacs window has no such thing. It shows a buffer from some start position downward. A short buffer is shown from its first line, so the input area sits right after the last line of text — in the middle of the window, with empty rows below it. Every new line of output pushed it down one row. In a fast stream it slid down the window until the text filled it.

The fix makes Emacs look like the terminal, out of text: **insert blank lines before the output**, so the buffer is exactly as tall as the window.

```elisp
(max 0 (+ have (- height lines)))
```

`height` is the window's height in lines, `lines` the buffer's height in display lines, and `have` the pad already there. As the output grows, the pad shrinks — measured 44 → 20 → 0. At 0 the text fills the window, normal scrolling takes over, and the client stops computing the pad. That also saves time: `count-screen-lines` walks the whole buffer, and a long session would pay for it on every line of output for nothing.

Drag the slider, and turn the pad off to see the old behaviour:

{{< obw "window" >}}
Hatched rows are the pad; amber rows are the input area (configuration line, then draft). Without the pad, the input area floats in the middle of the window until the output fills it.
{{< /obw >}}

Two details matter later. The end of the pad is a *marker*, not a count: when the output is cleared, the marker falls back to `point-min` and the pad is zero by construction — nothing has to remember to reset it. And the pad is real newline characters with the output's read-only properties, not a display trick. That matters for the pixels.

### A long buffer: pin the window start

When the text is taller than the window, the bottom row still belongs to nobody. Emacs only promises that the cursor's line is visible. The cursor is on the draft, the *second* line of the input area, so the configuration line above it may be cut off. The window start jumped between two positions one row apart: origin rows 64/66 alternating with 65/67, and the cursor at `y` 1354, then 1334.

So the client sets the window start itself. The output gets `h - K` rows, where `h` is the window height and `K` the input area's height. `K` is measured with `count-screen-lines`, not assumed to be 2, because a long draft wraps. It is capped at half the window, the same limit the terminal version uses.

One detail cost me a few pixels of draft. The input area usually begins at the newline that ends the last line of output — and that newline belongs to the output's display line. Counting `h - K` lines up from it starts one line too high, and pushes the draft below the window's bottom edge.

### The last few pixels

`vertical-motion` moves by whole lines, but the lines in this buffer do not all have the same height:

- body text is 20px;
- Markdown headings are 22px, because the heading face is `:height 1.1`;
- a line with an emoji or a fallback glyph is 27px.

In a 266-line session, 24 lines were not 20px. So whole lines almost never add up to the window height exactly: a gap of 0 to 19 pixels is left at the bottom, and its size depends on which lines happen to be on screen. I kept the tall headings. They are a big part of why this reads better than the terminal, and I would rather pay for them here than flatten the type. The terminal pays nothing, because every cell there is the same size.

Emacs has one setting for a partial line, `window-vscroll`, and it does not hold here:

- it works for one redisplay and is reset to 0 as soon as `window-start` changes (set 13, read back 0);
- set from `window-scroll-functions`, it sees the *old* window start and corrects too much.

What holds is a real character: one space at the end of the configuration line, with a `display` property of `(space :height X)`. It is text, so redisplay has to lay it out; it cannot decide to ignore it. Add lines of different heights, then turn the spacer on:

{{< obw "pixels" >}}
The bottom 200px of a window, drawn at 1:1. The window start can only move by whole lines, so a remainder is left under the draft. The spacer makes the configuration line exactly that much taller.
{{< /obw >}}

Two facts about the spacer I had to measure, not reason out:

1. `(space :height N)` **ignores integers.** `27` still gives a 20px line. The value must be a multiple of the base line height: `1.35` gives 27px on a 20px base.
2. The order must be *set it to zero, measure, fill once*. If the old height stays in while I measure, the measurement includes it, the next pass drops a line, and the two corrections fight. Measured, that fight settled at a 10px gap with the spacer at its maximum.

## Why it still flickered

After all that, it was almost right: now and then the input area jumped up or down by one line. Finding out why took longer than building the feature. There were three causes, unrelated to each other.

**1. The pad was recomputed on the wrong event.** I recomputed the pad when *output* was written. But the input area changes height on its own — that is what an input area does. Write a five-line draft while the agent works, send it, and the draft is cleared: the buffer is four rows shorter, and nothing recomputes the pad until the next line of output. For that stretch the input area floats up.

The fix is `post-command-hook`. It runs after each command and *before* redisplay, which is exactly the deadline. A timer with zero delay is not the same: it runs after the frame is drawn. My earlier timer-based attempt was one frame late every time, and one wrong frame is what a flicker is.

{{< obw "loop" >}}
One turn of the command loop. The hook is the last chance to change the buffer before the frame is drawn. Measured: without the hook, a 4-row gap after sending; with it, the pad goes 61 → 65 and the gap is 0.
{{< /obw >}}

**2. The hook that did nothing.** For a while the hook was installed and had no effect, with no error in sight. Two things stacked up:

- Emacs silently removes a function from `post-command-hook` when it signals an error. The symptom is "installed, does nothing", and `*Messages*` is empty.
- The error was mine. The function's docstring was in Chinese, and I had put an ASCII `"` inside a quoted phrase. The string ended there, the rest of the sentence became code, and that code failed with `void-variable` when the command finished. The syntax check passed, because the file was balanced and parsed. A stray quote in a docstring is legal code.

And `define-derived-mode` does not run its body again for a buffer that is already in that mode. Reloading the file gave the hook to the *next* session, not to the one I was testing in. There is now a re-arm path, and it installs the hook too.

**3. Someone else's global hook.** The last flicker was not about geometry at all. `beacon-mode` flashes the cursor line whenever a window scrolls. This buffer scrolls once per line of output, so beacon flashed on every line. Beacon lives on the global `window-scroll-functions` hook, so the client now removes it from that hook in this buffer only. The cost: toggling beacon later has no effect here until the mode is entered again.

One suspect was cleared, and it was the first thing both the agent and I guessed. `scroll-preserve-screen-position` is `t` in my configuration, and "keep the cursor's screen row" sounds exactly like something that could oscillate. Turning it off locally gave the same frames, one for one. Not guilty.

## What it costs

| cost | detail |
|---|---|
| blank space at the top of a new session | the pad. The terminal version shows blank lines in the same place |
| the draft moves when the configuration line changes width | `ctx 12%` → `ctx 9%` shifts the draft a character or two; the terminal's prompt line does the same |
| the input area is redrawn on every status change | the configuration line is text, so it is rewritten, and the rewrite must put the anchor back, or the next output lands between the configuration line and the draft |
| one buffer-local defence | a third-party scroll hook is removed for this buffer |
| `auto-window-vscroll` off | the last line is computed at 1360/67 ≈ 20.3px and loses about 3px — every time, instead of sometimes. Tall inline images in the output would want it back |

## Traps, in one table

| trap | what you see | why |
|---|---|---|
| `rear-nonsticky` must list every property that must not be copied | the first key typed in the draft signals `text-read-only`, and the draft has the prompt's face | typed characters copy text properties by default |
| a macro that splices its body into a `let` | a progress line that overwrote itself started to append instead | the macro's `beg` shadowed the body's `beg`; no error anywhere, only the existing behaviour tests caught it |
| an error inside `post-command-hook` | the hook is installed and does nothing | Emacs removes a function from the hook when it signals |
| an ASCII `"` inside a docstring | the syntax check passes; at runtime, `void-variable` | the string ends early and the rest is code |
| `define-derived-mode` on a buffer already in that mode | reloaded code never reaches the live session | the mode body does not run again |
| `(space :height N)` with an integer | the spacer seems to do nothing | integers are ignored; the value is a multiple of the base line height |
| reading `pos-visible-in-window-p` while writing output | the pin is skipped at random and the window start alternates | it answers about the frame *before* redisplay |
| `window-vscroll` | works for one redisplay, then reads 0 | a new `window-start` resets it |

## If you want this in your own client

Without the war stories:

1. **One anchor.** The place where output is inserted and the place where the input area begins are the same marker.
2. **Put the input keymap on the prompt as a text property**, and use `rear-nonsticky` to choose what a typed character copies.
3. **Take the keyboard back from `special-mode`** with a sweep over its map, plus a remap of `self-insert-command` back to itself.
4. **Pad before the output** while it is shorter than the window. After that, set the window start yourself.
5. **Fill the last pixels with a real character** that has a `display` height, not with `window-vscroll`.
6. **Recompute on `post-command-hook`**, not on a timer: the input area changes height without any output.
7. **Never read window state while writing output.** What you can read there describes the previous frame.

If I could keep only one of these, it would be the keymap that travels with the prompt. It is why there is no input mode, no "active" flag and no second buffer. The input area is not a widget that the output buffer hosts. It is text at the end of the buffer that happens to be writable.
