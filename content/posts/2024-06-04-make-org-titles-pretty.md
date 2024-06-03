---
title: Make Emacs Org titles pretty
tags: [elisp, headings, org]
date: 2024-06-03T17:24:44+0800
---
# different height for Org mode headings
modify only the height of headings in Org mode without affecting other attributes like color

Instead of using **custom-theme-set-faces** which replaces the whole face definition (and could unintentionally override theme-specific settings like color), use **set-face-attribute**

**doom-emacs** config example
```elisp
(after! org
  ;; Adjust the height of org headings upon org-mode startup
  (add-hook 'org-mode-hook (lambda ()
    (dolist (face '((org-level-1 . 1.75)
                    (org-level-2 . 1.5)
                    (org-level-3 . 1.25)
                    (org-level-4 . 1.1)
                    (org-level-5 . 1.05)
                    (org-level-6 . 1.0)
                    (org-level-7 . 0.95)
                    (org-level-8 . 0.9)))
      (set-face-attribute (car face) nil :height (cdr face)))))
```