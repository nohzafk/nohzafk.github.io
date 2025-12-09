---
title: "How I Use CLI2ELI to Streamline Text Transformation in Emacs"
post: 2025-12-09-cli2eli-stdin-workflow.md
date: 2025-12-09T20:09:33+0800
tags: [automation, emacs, tools]
---
I frequently work with escaped SQL strings from API logs and debugging sessions. The typical workflow involved copying the string, finding an online unescaper, pasting, copying the result, then finding a SQL formatter, pasting again… you get the idea. Too many context switches.

I wanted something like `M-|` (shell-command-on-region) but with predefined commands I could invoke by name. CLI2ELI made this trivial.

## The Problem

When debugging data pipelines, I often encounter JSON-escaped SQL like this:

```
"SELECT date_trunc('month', at_timezone(kpis.\"time\",'UTC')) AS time\nFROM \"prod_analytics\".\"public\".\"machines_kpis_30_min\" kpis\nWHERE kpis.\"machine_id\" IN (UUID '3ee28f49-6792-48f9-9ca9-ba6f86d73753')"
```

I need to:
1. Unescape the JSON string
2. Format the SQL for readability

With `M-|`, I'd have to type `jq -r '.' | sqlfmt -` every time. Not hard, but tedious when you do it dozens of times a day.

## The Solution: CLI2ELI with stdin Support

CLI2ELI wraps CLI tools as named Emacs commands. With the new `stdin` property, I can pipe buffer or region content directly to commands.

Here's my configuration in `cli-transform.json`:

```json
{
  "tool": "cli-transform",
  "cwd": "default",
  "commands": [
    {
      "name": "unescape SQL",
      "description": "Unescape JSON-escaped SQL string",
      "command": "jq -r '.'",
      "stdin": "region"
    },
    {
      "name": "format SQL",
      "description": "Format SQL using sqlfmt",
      "command": "sqlfmt -",
      "stdin": "region"
    },
    {
      "name": "unescape and format SQL",
      "description": "Unescape and format in one step",
      "command": "jq -r '.' | sqlfmt -",
      "stdin": "region"
    }
  ]
}
```

That's it. Three lines per command.

## Usage

1. Select the escaped SQL string
2. `M-x cli-transform-unescape-and-format-sql`
3. Formatted SQL appears in the output buffer

The output buffer shows the command in the header line, making it clear what ran. Copy the result and move on.

## The stdin Property

The `stdin` field accepts two values:
- `"region"`: Selected text, or entire buffer if no selection
- `"buffer"`: Always uses entire buffer content

This covers most text transformation use cases.

## More Examples

Once you have the pattern, adding more transforms is trivial:

```json
{
  "name": "format JSON",
  "command": "jq '.'",
  "stdin": "region"
},
{
  "name": "minify JSON",
  "command": "jq -c '.'",
  "stdin": "region"
},
{
  "name": "base64 decode",
  "command": "base64 -d",
  "stdin": "region"
},
{
  "name": "url decode",
  "command": "python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read()))'",
  "stdin": "region"
}
```

Any CLI tool that reads from stdin works.

## Why CLI2ELI?

**Named commands**: `M-x cli-transform-format-json` is discoverable and memorable. No need to recall exact command syntax.

**JSON configuration**: No Elisp required. Adding a new transform takes 30 seconds. More importantly, JSON is trivial for AI coding agents to generate. Ask Claude or Copilot to "add a command that converts CSV to JSON" and it can produce the correct JSON config immediately. Try asking it to write the equivalent Elisp—much harder to get right.

**Composable**: Pipe multiple tools together in the `command` field. Unix philosophy meets Emacs.

**Consistent interface**: All transforms work the same way—select text, run command, get output.

## Getting Started

1. Install CLI2ELI from [GitHub](https://github.com/nohzafk/cli2eli)
2. Create a JSON config file with your transforms
3. Load it: `(cli2eli-load-tool "~/path/to/config.json")`
4. Start transforming

The barrier to entry is low. Define a command in JSON, reload, use it. When you find yourself typing the same shell pipeline repeatedly, wrap it in CLI2ELI.