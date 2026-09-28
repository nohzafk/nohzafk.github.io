---
title: "How Coding Agents Draw Their Input Box"
post: 2026-09-28-how-coding-agents-draw-the-input-box.md
date: 2026-09-28T00:00:00+0800
tags: [ai-agents, tools, programming, llm]
---

I maintain a small coding agent written in Rust. Its input area is home-grown: a bottom region fenced off with a terminal scroll margin, a half-cooked termios mode, and a line editor I wrote myself. It works, but it does not look or feel as good as the agents I use every day. Before I rewrite it, I wanted to know what the others do.

I had one hard constraint: **no full-screen TUI**. The conversation must go into the terminal's own scrollback, so that I can scroll up, search with the terminal's find, and select text with the mouse as usual. Only the bottom part of the screen, the prompt and a status line, should be "live".

This post is what I found.

## The two ways to draw an interactive terminal app

A terminal has two screen buffers. The **main screen** is where your shell lives; lines that scroll off the top go into scrollback. The **alternate screen** (`ESC[?1049h`) is what `vim` and `htop` use: a fixed grid with no scrollback, restored to the previous content on exit.

An agent CLI has to pick one:

1. **Alternate screen.** The app owns every cell. Redraws are easy and flicker-free, but scrolling, find, and selection are gone and have to be reimplemented inside the app.
2. **Main screen.** Finished output is printed once and left to the terminal. The app redraws only a small region at the bottom. Scrollback, find, and selection keep working, but every redraw has to be careful, or the screen flickers and history gets corrupted.

Peter Steinberger's post [The Signature Flicker](https://steipete.me/posts/2025/signature-flicker) describes this trade-off well, and it is the best single source I found. Mario Zechner's [write-up on building pi](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) goes deeper into option 2.

## Who does what

| Agent | Renderer | Screen | Scrollback kept? |
|---|---|---|---|
| Claude Code | React, first on Ink, then a custom differential renderer | main | yes |
| Gemini CLI | Ink | main (alt-screen tried, rolled back) | yes |
| Command Code | Ink + React (closed source) | main | yes |
| Codex CLI | Rust: ratatui + crossterm | main, with a scroll region | yes |
| pi | own library, `pi-tui` | main | yes |
| opencode | OpenTUI (Zig core, TypeScript/Solid) | alternate | no |
| Amp | own renderer, replaced Ink | alternate | no |

Some notes on the rows:

- **Claude Code** had the famous flicker, caused by Ink's full redraws. Anthropic [rewrote the renderer](https://github.com/anthropics/claude-code/issues/769#issuecomment-3667315590) and kept React as the component model. The fix shipped in 2.0.72. Their stated reason for staying on the main screen: an app that draws its own selection and scrolling "would not feel like your browser".
- **Gemini CLI** announced an alt-screen TUI and [rolled it back](https://github.com/google-gemini/gemini-cli/discussions/13633) within a week. Users disliked having to press Ctrl-S before they could select text.
- **Command Code** is not open source. Its npm package is bundled and obfuscated, but its changelog shows that it runs on Ink and pins `ink` to 6.6.0 to fix Shift+Enter in the VS Code terminal.
- **Amp** [moved to alt mode](https://ampcode.com/news/look-ma-no-flicker) to kill flicker. Now the terminal's find only matches text that is on the screen.
- **opencode** built [OpenTUI](https://github.com/sst/opentui), which diffs individual cells and never sends an erase sequence. It is very well engineered, but it has [known problems](https://github.com/sst/opencode/issues/4043#issuecomment-3519627447) in older macOS Terminal and GNOME Terminal.

The pattern: the agents that most care about feeling like a terminal stayed on the main screen. The ones that went full-screen got smoother redraws and paid for them with scrolling and selection.

## Three ways to stay on the main screen

Among the main-screen agents, I found three designs.

**Ink-style React rendering.** A component tree is re-rendered into a string, and the string is repainted over the previous frame. It is easy to write. The flicker comes from repainting too much, too often.

**Line-level differential rendering (pi-tui, Claude Code's new renderer).** The renderer keeps the lines it drew last time, compares them with the new frame, and rewrites only the lines that changed. It wraps each frame in synchronized output (DEC mode 2026) so the terminal shows the frame all at once. Limits: the cursor cannot reach lines that have already scrolled into history. So when something above the viewport changes, for example a Markdown block that reflows, the renderer has to clear and redraw everything. Clearing lines also cancels any mouse selection that is in progress.

**Scroll region plus insert-above (Codex CLI).** Codex keeps its composer, status line, and popups in a ratatui viewport at the bottom. When a history cell is finished, it queues the rendered lines and `insert_history` pushes them *above* the viewport. It does this by setting a scroll region (DECSTBM, `ESC[top;bottom r`) and scrolling it, so the lines flow into real scrollback. The live area never touches history. Its issue tracker lists the costs:

- In **Zellij**, a partial scroll region combined with clear-to-end-of-line can be read as an in-place wipe, and history lines are lost.
- In Windows Terminal (**ConPTY**), lines scrolled out of a partial region often do not reach scrollback.
- Terminals without mode 2026 (Tabby, Wave) show the cursor jumping between the status line and the composer.
- **Resize** is the hard one. Committed scrollback cannot be reflowed by the app, so Codex re-renders the transcript from memory after a resize. Depending on the terminal, that means a flash, a jump to the top, or duplicated lines. Codex also has a full-screen pager (Ctrl+T) as an escape hatch.

Steinberger also [notes](https://github.com/openai/codex/blob/main/codex-rs/tui2/docs/tui_viewport_and_history.md) that Codex has been moving toward an alt-screen TUI. Even the Rust team that got this design to work was tempted to give it up.

## The Rust toolbox

My agent is in Rust, so this is the part that decides what I build. The candidates for an inline, multi-line input area:

| Library | Multi-line editing | Print above the prompt | Notes |
|---|---|---|---|
| [ratatui](https://ratatui.rs) `Viewport::Inline` | via a widget | `Terminal::insert_before` | the officially supported form of Codex's design |
| [tui-textarea](https://github.com/rhysd/tui-textarea) | yes, 2-D cursor, undo | host's job | an editor widget for ratatui |
| [reedline](https://github.com/nushell/reedline) | yes | `ExternalPrinter` | Nushell's line editor, designed for a shell prompt |
| rustyline | weak (continuation lines) | no | readline clone |
| termwiz `LineEditor` | single-line | no | |
| crossterm | build it yourself | build it yourself | the primitives everything above uses |

I used a fork of reedline before I wrote my own editor. It is good at being a shell prompt. A pinned composer with a status line and a completion popup is not what it was designed for.

## What I take from this

- **Staying on the main screen is the right call** for an agent that mostly prints text. Claude Code and Gemini tested the alternative in public, and both came back.
- **The editor and the renderer are separate problems.** Most of what "feels better" in these agents (multi-line editing, paste, completion popups) is the editor. Most of what "looks broken" (flicker, lost history, resize artifacts) is the renderer. I can swap one without the other.
- **Synchronized output (mode 2026) is table stakes.** Every serious renderer uses it.
- **Resize has no clean answer on the main screen.** Nobody I surveyed has solved it. Everyone either replays the transcript or accepts some artifacts. I should decide which one I want before I start, not discover it later.

For my own agent I see two paths. The small one: keep my scroll-region input area and replace only the editing core with tui-textarea. The large one: move to a ratatui inline viewport, as Codex does, and draw the composer, the status line, and the popups as widgets. Codex's `insert_history.rs` and `textarea.rs` are Apache-2.0 and worth reading either way.

*A note on method: I collected this survey with an AI agent doing web searches. I checked the main claims against Steinberger's post and the linked sources. I did not re-verify every issue in each project's tracker, so treat the specific bug descriptions as pointers, not as a changelog.*
