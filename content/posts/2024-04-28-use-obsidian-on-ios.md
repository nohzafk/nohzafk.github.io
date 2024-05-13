---
title: use Obsidian on iOS
date: 2024-05-13T01:27:55+0800
tags: [ios, obisidian]
---
[[Obsidian]] works amazingly well on iOS, it is really satisfying to write notes on mobile with it. Along with iOS shortcuts and automation, using Obsidian streamlines your mobile note-taking experience like never before.

# Use [[iOS shortcut]] to automate tasks

[Obsidian Advanced URI | Obsidian Advanced URI](https://vinzent03.github.io/obsidian-advanced-uri/)

This plugin exposes api to Obsidian via schema URL, combing it with iOS shortcuts make it possible to perform complex automation, like creating note, appending note and reordering list (via Sort & Permutation plugin).

There is a **Call Command** parameter for calling command from other plugins, which is the key component to automate with iOS shortcuts.

## example: add to list and reorder list alphabetically

select some text and use `share` menu, select the shortcut.

add to the heading `TIL` on daily note

![](/images/20240428_ac7c82.jpg)
“/images/20240428_ac7c82.jpg” could not be found.

use commands from various plugin to do following steps:
- open the note and place cursor at specific heading
- set mark, via [mark and select](obsidian://show-plugin?id=obsidian-mark-and-select)
- go to next heading, via [Code Editor shortcuts](obsidian://show-plugin?id=obsidian-editor-shortcuts)