---
title: use gleam-ts-mode in doom-emacs
post: 2024-06-21-use-gleam-ts-mode-in-doom-emacs.md
date: 2024-06-21T19:19:10+0800
tags: [emacs, gleam, tree-sitter]
---
Recently discovered [Gleam](https://gleam.run) language, and totally fell in love with it shortly!

Here is how you can setup Gleam in **doom-emacs**

## packages.el

We just need the `gleam-ts-mode.el`, do not download `gleam-mode.el` as when it gets compiled it requires `tree-sitter` which causes problem.

```lisp
(package! gleam-ts-mode
  :recipe (:host github
           :repo "gleam-lang/gleam-mode"
           :branch "main"

           :files ("gleam-ts-*.el")))
```

## config.el

```lisp
(use-package! gleam-ts-mode
  :config
  ;; setup formatter to be used by `SPC c f`
  (after! apheleia
    (setf (alist-get 'gleam-ts-mode apheleia-mode-alist) 'gleam)
    (setf (alist-get 'gleam apheleia-formatters) '("gleam" "format" "--stdin"))))

(after! treesit
  (add-to-list 'auto-mode-alist '("\\.gleam$" . gleam-ts-mode)))

(after! gleam-ts-mode
  (unless (treesit-language-available-p 'gleam)
    ;; compile the treesit grammar file the first time
    (gleam-ts-install-grammar)))
```

## hack
If you, like me, use Treesitter grammar files from Nix, the `tree-sitter` subdirectory within the directory specified by `user-emacs-directory` is linked to Nix's read-only filesystem, meaning `gleam-ts-install-grammar` is unable to install grammar files there.

Here's how you can adjust `treesit-extra-load-path` and install the grammar file.

```lisp
(after! gleam-ts-mode
  (setq treesit-extra-load-path (list (expand-file-name "~/.local/tree-sitter/")))
  (unless (treesit-language-available-p 'gleam)
    ;; hack: change `out-dir' when install language-grammar'
    (let ((orig-treesit--install-language-grammar-1 (symbol-function 'treesit--install-language-grammar-1)))
      (cl-letf (((symbol-function 'treesit--install-language-grammar-1)
                 (lambda (out-dir lang url)
                   (funcall orig-treesit--install-language-grammar-1
                            "~/.local/tree-sitter/" lang url))))
        (gleam-ts-install-grammar)))))
```