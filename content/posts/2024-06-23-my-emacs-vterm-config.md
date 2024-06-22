---
title: my emacs vterm config
post: 2024-06-23-my-emacs-vterm-config.md
date: 2024-06-22T21:04:30+0800
tags: [emacs, fish, vterm]
---
Here is the most valuable part of my emacs [vTerm](https://github.com/akermu/emacs-libvterm) config with **fish shell**.

add `source vterm.fish` to your fish shell configuration file

use `edit <file>` in **vTerm** buffer will open file at the new window above vTerm buffer, similar to using `code <file>` in VSCode embedded terminal.

`vterm.fish`

```shell
# https://github.com/akermu/emacs-libvterm
function vterm_printf
    if begin
            [ -n "$TMUX" ]; and string match -q -r "screen|tmux" "$TERM"
        end
        # tell tmux to pass the escape sequences through
        printf "\ePtmux;\e\e]%s\007\e\\" "$argv"
    else if string match -q -- "screen*" "$TERM"
        # GNU screen (screen, screen-256color, screen-256color-bce)
        printf "\eP\e]%s\007\e\\" "$argv"
    else
        printf "\e]%s\e\\" "$argv"
    end
end

function vterm_cmd --description 'Run an Emacs command among the ones been defined in vterm-eval-cmds.'
    set -l vterm_elisp ()
    for arg in $argv
        set -a vterm_elisp (printf '"%s" ' (string replace -a -r '([\\\\"])' '\\\\\\\\$1' $arg))
    end
    vterm_printf '51;E'(string join '' $vterm_elisp)
end

if [ "$INSIDE_EMACS" = vterm ]
    set -gx EDITOR code

    function clear
        vterm_printf "51;Evterm-clear-scrollback"
        tput clear
    end
    # used by vterm buffer name
    function fish_title
        hostname
        echo ":"
        prompt_pwd
    end

    function vterm_prompt_end --on-variable PWD
        vterm_printf '51;A'(whoami)'@'(hostname)':'(pwd)
    end

    function edit
        set -q argv[1]; or set argv[1] "."
        vterm_cmd vterm-edit-file (realpath "$argv")
    end
end
```

doom emacs config

`config.el`

```lisp
(after! vterm
	(defun vterm-edit-file (file)
	    "Open a file from vterm in another window, keeping only the vterm window and the new file window."
	    (interactive)
	    (let ((current-vterm-window (catch 'found
	                                  (dolist (win (window-list))
	                                    (when (and (window-live-p win)
	                                               (eq 'vterm-mode (buffer-local-value 'major-mode (window-buffer win))))
	                                      (throw 'found win)))))
	          new-file-window)
	      (when current-vterm-window
	        ;; Open file in a new window from current VTerm window
	        (select-window current-vterm-window)
	        (setq new-file-window (split-window-below)) ; Adjust split direction to preference
	        (set-window-buffer new-file-window (find-file-noselect file))
	        ;; Delete all other windows except for VTerm and the new file window
	        (mapc (lambda (win)
	                (unless (or (eq win current-vterm-window)
	                            (eq win new-file-window))
	                  (delete-window win)))
	              (window-list))
	        (select-window new-file-window))))
	
	  (add-to-list 'vterm-eval-cmds '("vterm-edit-file" vterm-edit-file)))
```