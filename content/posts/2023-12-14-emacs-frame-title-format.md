---
date: '2023-12-14T18:13:14+08:00'
title: 'Emacs Frame Title Format to shorten file path'
tags: [emacs]
---

I use Emacs `--with-no-title-bar` and use [**yabai**](https://github.com/koekeishiya/yabai) to auto layout window, [**sketchybar**](https://github.com/FelixKratz/SketchyBar) to display current window title at the menu bar.

Due to the limited screen size on a laptop, it can be challenging to view the entire file path. Therefore, I created a function that shows a shortened version of the file path.

If you are editing a file, the function will display the file path. Otherwise, it will display the buffer name.

for example, `~/projects/blog/content/posts/emacs-frame-title-format.md` will be display as `~/p/b/c/posts/emacs-frame-title-format.md`


```lisp

(defun shorten-path-for-title (path)
  "Shorten a file PATH to be displayed in the frame title.
Only the last directory's name is fully displayed; upper-layer directories are represented by their first letters."
  (let* ((components (split-string (or path "") "/" t))
         (filename (or (car (last components)) ""))
         (lastdir (if (> (length components) 1) (nth (- (length components) 2) components) ""))
         (dirs (butlast components 2))
         (shortened-dirs (mapcar (lambda (dir) (substring dir 0 1)) dirs)))
    (concat (string-join shortened-dirs "/")
            (if shortened-dirs "/")
            lastdir
            "/"
            filename)))

(setq frame-title-format
      '((:eval (if (buffer-file-name)
                   (shorten-path-for-title (abbreviate-file-name (buffer-file-name)))))
        (:eval (if (not (buffer-file-name)) (buffer-name)))))
```
