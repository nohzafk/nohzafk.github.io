---
title: use Obsidian on iOS
date: 2024-04-28T14:00:59+0800
tags: [ios, obisidian]
---
Obsidian works amazingly well on iOS, it is really satisfying to write notes on mobile with it. Along with iOS shortcuts and automation, using Obsidian streamlines your mobile note-taking experience like never before.

# Font Atkinson Hyperlegible
[Download the Atkinson Hyperlegible Font | Braille Institute](https://brailleinstitute.org/freefont) load it with [Custom Font Loader](obsidian://show-plugin?id=custom-font-loader) plugin.

Use this excellent font for low vision reading , perfect for using with Obsidian on iPhone!

# use iOS shortcuts to automate tasks

[Obsidian Advanced URI | Obsidian Advanced URI](https://vinzent03.github.io/obsidian-advanced-uri/)

this plugin exposes api to Obsidian via schema URL, combing it with iOS shortcuts make it possible to perform complex automation, like creating note, appending note and reordering list (via Sort & Permutation plugin).

there is a Call Command parameter for calling command from other plugins, which is the key component to automate with iOS shortcuts.

## example: add to list and reorder list alphabetically

select some text and use share menu, select the shortcut.

add to the heading TIL on daily note

![](/images/20240428_ac7c82.jpg)

use commands from various plugin to do following steps:
- open the note and place cursor at specific heading
- set mark, via [mark and select](obsidian://show-plugin?id=obsidian-mark-and-select)
- go to next heading, via [Code Editor shortcuts](obsidian://show-plugin?id=obsidian-editor-shortcuts)
- trim white space, via [trim whitespace](obsidian://show-plugin?id=obsidian-trim-whitespace)
- reorder list, via [Sort & Permute lines](obsidian://show-plugin?id=obsidian-sort-and-permute-lines)

![](/images/20240428_b6688d.jpg)
## obtain the command id
command id can be obtain by using Advanced URI: copy URI for command on the Command Palette