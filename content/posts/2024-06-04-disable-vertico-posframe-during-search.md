---
title: disable vertico-posframe during search
post: 2024-06-04-disable-vertico-posframe-during-search.md
date: 2024-06-04T09:50:06+0800
tags: [emacs, lisp, vertico-posframe]
---
I use [vertico-postframe](https://github.com/tumashu/vertico-posframe) to place my completion window at the center of screen, however when doing incremental search like doom-emacs `SPC s s`, it will block the man window.

Here is how to temporarily disable **vertico-posframe-mode** in Emacs before executing a function, like an incremental search, and then re-enable it afterward.

```lisp
(defun my-search-without-posframe ()
  "Perform a search without `vertico-posframe-mode' temporarily."
  (interactive)
  ;; Disable vertico-posframe-mode if it's enabled
  (when (bound-and-true-p vertico-posframe-mode)
    (vertico-posframe-mode -1)
    (unwind-protect
        ;; Perform the search
        (call-interactively '+default/search-buffer)
      ;; Re-enable vertico-posframe-mode
      (vertico-posframe-mode 1))))
```

in `config.el`

```lisp
(map! :leader
      :desc "Search without posframe"
      "s s" #'my-search-without-posframe)
```