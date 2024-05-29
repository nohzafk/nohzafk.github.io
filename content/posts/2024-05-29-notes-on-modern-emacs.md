---
title: Notes on Modern Emacs
tags: [emacs, native_compilation, tree-sitter]
date: 2024-05-29T16:02:48+0800
---
[Modern Emacs: all those new tools that make Emacs better and faster - YouTube](https://youtu.be/SOxlQ7ogplA?si=BgBfvShIFLtuqt0H)

## Optimization
- **Lexical Binding**: Before Emacs 24 emacs-lisp is dynamic binding. lexical binding is introduced in Emacs 24, enabling compile-time optimizations.
- **Native Compilation**: Introduced in Emacs 28, native compilation used the **GCC JIT** compile to convert Emacs Lisp code to native machine code, dramatically improving execution speed.

## Package Management
- Lazy loading with **use-package**: use-package is now build into Emacs 29
- **[Straight Package Manager](https://github.com/radian-software/straight.el)**: works with `use-package` to handle package installations and version control.

## Syntax Highlighting and Parsing
- **Tree-sitter Integration**: Emacs 29 includes support for Tree-sitter, a parser generator that improves syntax highlighting and code navigation by using precise parse trees instead of regular expressions. This results in more accurate and faster syntax highlighting.
- **tree-sitter mode**:  new major modes that utilize `tree-sitter` for enhanced code parsing and highlighting, for example, use `python-ts-mode` to replace traditional `python-mode`.

## Completion Frameworks
- **Historical Context**: Initially, Emacs used ido for interactive file and buffer navigation, followed by heavier frameworks like helm and ivy for more advanced completions.
- **Modern Solutions**:  `vertico` `consult` `orderless` `marginalia` `embark`

## Language Server Protocol (LSP)
- **eglot**: Emacs' build-in LSP client

I personally use  [lsp-bridge](https://github.com/manateelazycat/lsp-bridge) for completion and LSP
