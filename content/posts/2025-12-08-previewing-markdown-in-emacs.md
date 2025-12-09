---
title: "Previewing Markdown in Emacs with grip-mode"
post: 2025-12-08-previewing-markdown-in-emacs.md
date: 2025-12-09T22:24:07+0800
tags: [emacs, tools]
---
Emacs's markdown-mode offers several preview options, but finding one that "just works" took some exploration.

## The xwidget-webkit Approach

My first attempt used `markdown-live-preview-window-function` with xwidget-webkit—Emacs's embedded WebKit browser. The idea: render markdown to HTML and display it in a split window.

```elisp
(defun my/markdown-live-preview-window-xwidget (file)
  (xwidget-webkit-browse-url (concat "file://" file))
  (xwidget-webkit-buffer))
```

Four problems killed this approach:

1. **External dependency** — HTML generation requires `markdown` (default) or `pandoc` binary
2. **Emacs build requirement** — xwidget support must be compiled in (`--with-xwidgets`), which isn't universal
3. **Temp file pollution** — Live preview generates HTML files that require cleanup
4. **Complexity** — Managing the xwidget buffer lifecycle adds code I'd rather not maintain

## The grip-mode Solution

[grip-mode](https://github.com/seagle0128/grip-mode) provides GitHub-flavored markdown preview using a local server. The key insight: use [go-grip](https://github.com/chrishrb/go-grip) instead of Python's grip to avoid GitHub API rate limits and work fully offline.

### Setup

Install go-grip:

```bash
go install github.com/chrishrb/go-grip@latest
```

Configure Emacs:

```elisp
(use-package grip-mode
  :config
  (setopt grip-command 'go-grip)
  (setopt grip-preview-use-webkit nil)
  (setopt grip-update-after-change nil)
  :bind (:map markdown-mode-map
         ("C-c C-c p" . grip-mode)))
```

Now `C-c C-c p` launches a local server and opens the preview in your default browser. The preview updates on save.

## Why go-grip Over Python grip

The original Python [grip](https://github.com/joeyespo/grip) uses GitHub's Markdown API, which has rate limits (60 requests/hour unauthenticated). You can add a GitHub token, but that's extra configuration.

go-grip renders locally using a Go markdown library—no network requests, no rate limits, no authentication.

## Comparison

| Concern         | xwidget-webkit           | grip-mode + go-grip     |
| --------------- | ------------------------ | ----------------------- |
| External binary | Requires pandoc          | go-grip (single binary) |
| Emacs build     | Requires --with-xwidgets | Any build               |
| Temp files      | Generates HTML           | None                    |
| Rendering       | Basic HTML               | Full GFM                |
| Offline         | Yes                      | Yes                     |

Sometimes the best solution is a small, focused tool that does exactly one thing well.