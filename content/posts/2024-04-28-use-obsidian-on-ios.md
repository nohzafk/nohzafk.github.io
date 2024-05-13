---
title: use Obsidian on iOS
date: 2024-05-13T01:31:21+0800
tags: [ios, obisidian]
---
[[Obsidian]] works amazingly well on iOS, it is really satisfying to write notes on mobile with it. Along with iOS shortcuts and automation, using Obsidian streamlines your mobile note-taking experience like never before.

# Use [[iOS shortcut]] to automate tasks

[Obsidian Advanced URI | Obsidian Advanced URI](https://vinzent03.github.io/obsidian-advanced-uri/)

This plugin exposes api to Obsidian via schema URL, combing it with iOS shortcuts make it possible to perform complex automation, like creating note, appending note and reordering list (via Sort & Permutation plugin).

There is a Call Command parameter for calling command from other plugins, which is the key component to automate with iOS shortcuts.

## example: add to list and reorder list alphabetically

select some text and use share menu, select the shortcut.

add to the heading TIL on daily note

![](/images/20240428_ac7c82.jpg)

use commands from various plugin to do following steps:
- open the note and place cursor at specific heading
- set mark, via [mark and select](obsidian://show-plugin?id=obsidian-mark-and-select)
- go to next heading, via [Code Editor shortcuts](obsidian://show-plugin?id=obsidian-editor-shortcuts)
- go to previous line
- go to end of line
- trim white space, via [trim whitespace](obsidian://show-plugin?id=obsidian-trim-whitespace)
- reorder list, via [Sort & Permute lines](obsidian://show-plugin?id=obsidian-sort-and-permute-lines)

![](/images/20240428_b6688d.jpg)

## obtain the command id
command id can be obtain by using Advanced URI: copy URI for command on the Command Palette

## Actions URL
Also look at the [Actions URL](https://zottmann.dev/obsidian-actions-uri/) I find it works more reliably and has the ability to run [dataview query](https://blacksmithgu.github.io/obsidian-dataview/)

## same workflow on macOS
The same shortcut workflow used on iOS can be reused on macOS via services, amazing cutting the boilerplate of manually copy & pasting note taking process.

# CSS for multiple fonts
## Font Atkinson Hyperlegible

[Download the Atkinson Hyperlegible Font | Braille Institute](https://brailleinstitute.org/freefont)

Use this excellent font for low vision reading , perfect for using with Obsidian on iPhone!

## Custom Font Loader
Enable [Custom Font Loader](obsidian://show-plugin?id=custom-font-loader) plugin, enable multiple fonts.

Custom CSS of using different fonts for default and code block.
:root * {
  --font-default: Atkinson-Hyperlegible-Regular-102a;
  --default-font: Atkinson-Hyperlegible-Regular-102a;
  --font-family-editor: Atkinson-Hyperlegible-Regular-102a;
  --font-monospace-default: Atkinson-Hyperlegible-Regular-102a,
  --font-interface-override: Atkinson-Hyperlegible-Regular-102a,
  --font-text-override: Atkinson-Hyperlegible-Regular-102a,
  --font-monospace-override: Atkinson-Hyperlegible-Regular-102a, 
 }

.reading * {
font-size: 20pt !important;
}
/* reading view code */
.markdown-preview-view code {
font-family: 'Iosevka';
}
/* live preview code */
.cm-s-obsidian .HyperMD-codeblock {
font-family: 'Iosevka';
}
/* inline code */
.cm-s-obsidian span.cm-inline-code {
font-family: 'Iosevka';
}

## references
[How to increase Code block font?! - #2 by ariehen - Custom CSS & Theme Design - Obsidian Forum](https://forum.obsidian.md/t/how-to-increase-code-block-font/70013/2)

[How to update your plugins and CSS for live preview - Obsidian Hub - Obsidian Publish](https://publish.obsidian.md/hub/04+-+Guides%2C+Workflows%2C+%26+Courses/Guides/How+to+update+your+plugins+and+CSS+for+live+preview)