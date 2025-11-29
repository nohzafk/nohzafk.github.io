---
title: easy config for org-mode preview latex
post: 2024-08-26-easy-config-for-org-mode-preview-latex.md
date: 2024-08-26T09:19:35+0800
tags: [emacs, tex, nix]
---
It's so pleasant to use [[nix]] to install and config complex software packages.

Here is how to make emacs org work with **latex**

`config-latex.nix`

```nix
# https://nixos.wiki/wiki/TexLive
# For a minimal set of packages needed for Emacs Orgmode
{ pkgs, lib, ... }:
let
  tex = (pkgs.texlive.combine {
    inherit (pkgs.texlive)
      scheme-basic dvisvgm dvipng # for preview and export as html
      wrapfig amsmath ulem hyperref capt-of fontspec;
  });
in { home.packages = lib.mkBefore [ tex ]; }
```

doom-emacs `packages.el`

```lisp
(package! org-fragtog)
```

doom-emacs `config.el`

```lisp
(use-package! org-fragtog
  :config
  (add-hook 'org-mode-hook 'org-fragtog-mode))

(after! org
  (setq org-preview-latex-default-process 'dvisvgm)
  (setq org-startup-with-latex-preview t))
```