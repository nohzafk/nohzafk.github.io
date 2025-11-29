---
title: Integration Obsidian with Emacs
tags: [emacs, note-taking]
date: 2024-05-31T21:12:02+0800
---
## [Emacs-obsidian](https://github.com/licht1stein/obsidian.el)
might be too overkill for me , just opening note in Emacs for intensive editing is enough. 
## from [[Emacs]]: quickly open Obsidian note

use [Deft Mode](https://youtu.be/mldoUx_wi10?si=e3avbZIKtAkOWHNz)

## from [[Obsidian]]: open current file in Emacs

[open file and go to line](https://stackoverflow.com/questions/3139970/open-a-file-at-line-with-filenameline-syntax)
command for **emacsclient** to open a.txt at line 4 column 3

```shell
emacsclient +4:3 a.txt
```

use [obsidian open current file in emacs](https://publish.obsidian.md/shellcommands/Example+shell+commands/Open+the+current+file+in+vscode+and+jump+to+the+current+position)

```shell
emacsclient -c -s work +{{caret_position}} {{file_path:absolute}}
```

Use [shell-command](obsidian://show-plugin?id=obsidian-shellcommands) plugin to create a obsidian command to run the shell command