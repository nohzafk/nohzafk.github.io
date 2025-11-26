---
title: teaching claude code to use ast-grep
post: 2025-11-08-teaching-claude-code-to-use-ast-grep.md
date: 2025-11-26T15:34:00+0800
tags: [ast-grep, claude_code, mcp, ripgrep]
---
# Teaching Claude Code to Use ast-grep

I wanted Claude Code to understand the difference between **searching for code structure** and **searching for plain text**. That meant teaching it when to reach for **ast-grep** instead of **ripgrep**—and to make that decision automatically.

This is how I taught it to do that.
## Figuring Out the Right Tools

Claude Code can be extended in several ways—skills, commands, hooks, sub-agents, MCP servers, and plugins.

Each serves a different purpose, but in this case, I needed **two working together**:
- **MCP (Model Context Protocol)** to connect the actual ast-grep binary as an external tool.
- **Skill** to teach Claude _when and why_ to use that tool.

Think of it like this:
- MCP gives Claude new **abilities**.
- Skills give it **judgment**.

I didn't want to type /ast-grep every time. I wanted Claude to _decide_ on its own.

## Step 1: Adding the ast-grep MCP Server

The first step was to register the **ast-grep MCP server** with Claude Code.

Once connected, it exposes several tools that Claude can call directly:
- mcp__ast-grep__find_code — search code using structural patterns
- mcp__ast-grep__find_code_by_rule — advanced YAML-based rule matching
- mcp__ast-grep__dump_syntax_tree — inspect syntax trees
- mcp__ast-grep__test_match_code_rule — test custom rule

After this, Claude had full access to ast-grep—but it still didn't know when to use it.

That's where the **Skill** came in.

## Step 2: Teaching Strategy with a Skill

I created a new skill file at:

```
~/.claude/skills/ast-grep/SKILL.md
```

The goal was simple: teach Claude _how to decide_ when to use ast-grep versus ripgrep.

Here's the essence of what I wrote:

```
---
name: ast-grep
description: Use ast-grep for structural code search. Fall back to ripgrep for plain-text searches.
---

# ast-grep: Strategic Code Search Guidance

## Core Principle

**ast-grep = Code structure** (syntax-aware, AST-based)  
**ripgrep = Plain text** (fast, content-based)

## Decision Tree

Is this about CODE STRUCTURE?
├─ YES → Use ast-grep MCP tools
│   Examples:
│   ✓ Find function or method definitions
│   ✓ Locate class declarations
│   ✓ Search for loops or conditional patterns
│   ✓ Refactor code using syntax patterns
└─ NO → Use ripgrep
    Examples:
    ✓ Search comments or docs
    ✓ Find TODO or FIXME markers
    ✓ Scan config files or logs
```

This gave Claude a clear rule of thumb:

- **ast-grep** for anything syntax-aware
- **ripgrep** for everything else

I also added a few **anti-patterns**—things Claude should avoid:
- ❌ Don't use ast-grep for plain text
- ❌ Don't use ripgrep for structured code
- ✅ Use the right tool based on intent, not habit

That's it. The skill didn't try to re-document every ast-grep parameter.

It just provided **strategic guidance**—the kind of context a human developer would know instinctively.

## Step 3: Telling Claude Code to Use the Skill

Add this line to your project's `CLAUDE.md`:

```
Prefer ast-grep over Grep for structural code searches.
```

Or use the quick memory shortcut—type `# Prefer ast-grep over Grep for structural code searches.` and Claude Code will prompt you to save it.

## What I Learned

The key takeaway was **separation of responsibility**:
- **MCP** handles _what_ tools exist and _how_ they work.
- **Skills** handle _when_ and _why_ to use them.

Keeping those layers distinct made everything easier to maintain:
- MCP updates don't break the skill.
- Skill logic evolves independently.
- Claude only loads the skill when it's relevant.

It also keeps context light—since Skills use progressive disclosure, they load only when Claude detects the topic applies.

## Final Thoughts

Teaching Claude to use ast-grep wasn't just about wiring up another tool.

It was about teaching **judgment**.

By combining an MCP server (for capability) with a Skill (for reasoning), I gave Claude the intuition to pick the right search tool for the job—without me telling it what to do.

That's the essence of extending Claude Code effectively:

**tools give power, skills give intelligence.**

### References

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [ast-grep](https://ast-grep.github.io/)
- [ast-grep MCP Server](https://github.com/ast-grep/ast-grep-mcp)