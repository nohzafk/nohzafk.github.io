---
title: teaching claude code to use ast-grep
post: 2025-11-08-teaching-claude-code-to-use-ast-grep.md
date: 2025-11-08T22:32:42+0800
tags: [ast-grep, mcp, ripgrep]
---
# **Teaching Claude Code to Use ast-grep**

I wanted Claude Code to understand the difference between **searching for code structure** and **searching for plain text**. That meant teaching it when to reach for **ast-grep** instead of **ripgrep**—and to make that decision automatically.

This is how I taught it to do that.
## **Figuring Out the Right Tools**

Claude Code can be extended in several ways—skills, commands, hooks, sub-agents, MCP servers, and plugins.

Each serves a different purpose, but in this case, I needed **two working together**:
- **MCP (Model Context Protocol)** to connect the actual ast-grep binary as an external tool.
- **Skill** to teach Claude _when and why_ to use that tool.

Think of it like this:
- MCP gives Claude new **abilities**.
- Skills give it **judgment**.

I didn't want to type /ast-grep every time. I wanted Claude to _decide_ on its own.

## **Step 1: Adding the ast-grep MCP Server**

The first step was to register the **ast-grep MCP server** with Claude Code.

Once connected, it exposes several tools that Claude can call directly:
- mcp__ast-grep__find_code — search code using structural patterns
- mcp__ast-grep__find_code_by_rule — advanced YAML-based rule matching
- mcp__ast-grep__dump_syntax_tree — inspect syntax trees
- mcp__ast-grep__test_match_code_rule — test custom rule

After this, Claude had full access to ast-grep—but it still didn't know when to use it.

That's where the **Skill** came in.

## **Step 2: Teaching Strategy with a Skill**

I created a new skill file at:

```
~/.claude/skills/ast-grep/SKILL.md
```

The goal was simple: teach Claude _how to decide_ when to use ast-grep versus ripgrep.

Here's the essence of what I wrote:

```