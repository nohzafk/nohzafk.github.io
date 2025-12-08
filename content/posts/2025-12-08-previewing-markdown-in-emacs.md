---
title: "Previewing Markdown in Emacs  From xwidget-webkit to Obsidian"
post: 2025-12-08-previewing-markdown-in-emacs.md
date: 2025-12-08T17:19:11+0800
tags: [emacs, macos, note-taking]
---
# Previewing Markdown in Emacs: From xwidget-webkit to Obsidian

Emacs's markdown-mode offers several preview options, but finding one that "just works" took some exploration.

## The xwidget-webkit Approach

My first attempt used markdown-live-preview-window-function with xwidget-webkit—Emacs's embedded WebKit browser. The idea: render markdown to HTML and display it in a split window.

```lisp
(defun my/markdown-live-preview-window-xwidget (file)
  (xwidget-webkit-browse-url (concat "file://" file))
  (xwidget-webkit-buffer))
```

Four problems killed this approach:

1. External dependency — HTML generation requires markdown (default) or pandoc binary
2. Emacs build requirement — xwidget support must be compiled in (--with-xwidgets), which isn't universal
3. Temp file pollution — Live preview generates HTML files that require cleanup
4. Complexity — Managing the xwidget buffer lifecycle adds code I'd rather not maintain

## The Obsidian Solution

Obsidian is primarily a note-taking app, but it's also an excellent free markdown renderer with real-time preview. Using it as an external viewer sidesteps all the complexity.

The key discovery: Use custom URI scheme to open a file directly in Obsidian:

```text
obsidian://open?path=/path/to/file.md
```

## Final Configuration

```lisp
(setopt markdown-open-command
        (lambda ()
          (let ((uri (concat "obsidian://open?path="
                             (url-hexify-string (buffer-file-name)))))
            (start-process "obsidian" nil "open" uri))))
```

Now `C-c C-c o` opens the current markdown file in Obsidian instantly.

Implementation Notes

- markdown-open-command accepts either an executable path (string) or a function
- When using a function, it receives no arguments—access the file via (buffer-file-name)
- url-hexify-string handles paths with spaces or special characters
- macOS open command launches URI schemes directly

Why This Works

| Concern           | xwidget-webkit                   | Obsidian             |
|-------------------|----------------------------------|----------------------|
| External binary   | Requires markdown or pandoc      | None                 |
| Emacs build       | Requires --with-xwidgets         | Works with any build |
| Temp files        | Generates HTML requiring cleanup | None                 |
| Setup complexity  | Custom buffer management         | Single variable      |
| Rendering quality | Basic HTML                       | Full GFM support     |

Sometimes the best solution is delegating to a tool that already does the job well.