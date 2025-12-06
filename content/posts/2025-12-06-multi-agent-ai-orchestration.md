---
title: "Multi-Agent AI Orchestration  When It's Worth It (And When It Isn't)"
post: 2025-12-06-multi-agent-ai-orchestration.md
date: 2025-12-06T01:39:26+0800
tags: [claude, llm, tools]
---
I recently explored an interesting architecture pattern: using Claude Code to invoke Gemini CLI for large codebase analysis. The idea was compelling—combine Claude's superior instruction-following with Gemini's massive context window. Gemini reads everything, Claude thinks and acts. [reddit post](https://www.reddit.com/r/ChatGPTCoding/comments/1lm3fxq/gemini_cli_is_awesome_but_only_when_you_make/?share_id=2sIyE4xIk-zG0v3T85Q0K&utm_content=1&utm_medium=ios_app&utm_name=ioscss&utm_source=share&utm_term=1&sort=new)

After building it out, I deleted it. Here's what I learned.

## The Pitch

The setup is straightforward. Gemini CLI supports a non-interactive mode (gemini -p) that accepts a prompt and returns a response. You can include files with @ syntax:

```bash
gemini -p "@src/ @lib/ Find all authentication patterns. Return file:line for each."
```

The theory: Claude's context fills up fast when exploring large codebases. Gemini can ingest everything at once. Let Gemini do the bulk reading, get structured results back, then let Claude reason about what to do.

## The Critical Design Insight

If you're orchestrating one AI to call another, output format is everything.

Gemini's natural response looks like this:

> The authentication system appears to be implemented across several files,
> primarily in the src directory, where we can observe patterns suggesting
> a JWT-based approach combined with session management…

Useless. You need this:

> src/middleware/auth.ts:15 - JWT validation middleware
> src/services/user.ts:42 - user lookup by token
> src/db/sessions.ts:8 - session storage interface

The fix is explicit format instructions in every query:

```bash
gemini -p "@src/ @lib/ <QUESTION>

Return findings as:
- file:line - description
- Include relevant code snippets (brief)
- Direct answers, no preamble"
```

This transforms vague prose into actionable data Claude can immediately use with its Read tool.

## Why I Killed It

For my actual workflow, the gains didn't materialize. Here's the honest breakdown:

| Task                                      | Native approach   | Does Gemini help?          |
|-------------------------------------------|-------------------|----------------------------|
| Find specific pattern                     | ast-grep or Grep  | No—these are precise       |
| Read known files                          | Read tool         | No                         |
| Trace end-to-end flow                     | Explore agent     | Marginal at best           |
| "Does X exist anywhere?"                  | Grep              | Maybe, if pattern is fuzzy |
| First pass on unfamiliar massive codebase | Multiple searches | Yes—genuine win            |

The problem: my codebase is well-structured and familiar. Targeted search followed by reading specific files already works well. The Explore agent (a subagent that investigates across files and reports back) already handles the "understand how X works" case.

The deeper issue: Gemini "seeing everything at once" sounds powerful, but understanding code flow is inherently sequential. A request hits middleware, then a handler, then a service, then a database. I need to trace that chain. Dumping all files into context doesn't shortcut the reasoning.

And there's the output problem—even with structured results, I still need to Read the files Gemini identified before I can act. I've added a step, not removed one.

## When It Actually Helps

The pattern works when:

- The subordinate has a capability the primary lacks (Gemini's context window genuinely is larger)
- The task requires bulk access (onboarding to a 500-file unfamiliar codebase)
- You've solved the output problem with structured format enforcement

If you build it, bake format instructions into every query template and always verify by reading the files the subordinate identifies before acting.

## The Takeaway

Before adding orchestration complexity, ask: "What's actually the bottleneck?"  If it's reasoning, more data access won't help. For most daily work on a familiar codebase, targeted search plus following the import graph wins.