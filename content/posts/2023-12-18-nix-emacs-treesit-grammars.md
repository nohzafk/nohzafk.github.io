---
date: '2023-12-18T00:48:57+08:00'
title: 'Integrating Tree-Sitter with Emacs29 in nix-darwin'
tags: [emacs, nix, nix-darwin, tree-sitter]
---

I've been searching for a good solution to use Emacs29 with tree-sitter config in `nix-darwin` for quite some time.

Emacs29 comes with built-in support for **Tree-Sitter**, a parser generator tool and an incremental parsing library, the only requirement is the grammar files, detail in this [masteringemacs article](https://www.masteringemacs.org/article/how-to-get-started-tree-sitter).

While there are some proposed solutions out there, such as the one found on the [nixos discourse](https://discourse.nixos.org/t/packages-required-to-get-emacs-typescript-ts-mode-to-work/31225/9), they didn’t quite hit the mark for me. The issue was that I’m using an overridden package definition of pkgs.emacs29-macport, which complicated things a bit.

```nix
let
    myEmacs = (emacsPackagesFor emacs).emacsWithPackages (epkgs: with epkgs; [
        vterm
        treesit-grammars.with-all-grammars
    ];)
in
```

The above `treesit-grammars.with-all-grammars` definition only installs the dynamic libraries. However, Emacs was still unable to find the files. The crux of the problem was that I needed to link the directory to a location that Tree-Sitter could locate.

After many trials and tribulations, I finally managed to come up with a functional solution.

## Solution

`pkg-emacs29-macport.nix`: package definition of emacs

```nix
{ pkgs ? (import <nixpkgs> { }) }:
let
  # https://github.com/railwaycat/homebrew-emacsmacport/blob/master/Formula/emacs-mac.rb
  emacs29-macport = (pkgs.emacs29-macport.overrideAttrs (prevAttrs: {
    patches = (prevAttrs.patches) ++ [
      # patch for multi-tty support, see the following links for details
      # https://bitbucket.org/mituharu/emacs-mac/pull-requests/2/add-multi-tty-support-to-be-on-par-with/diff
      # https://ylluminarious.github.io/2019/05/23/how-to-fix-the-emacs-mac-port-for-multi-tty-access/
      (pkgs.fetchpatch {
        url =
          "https://raw.githubusercontent.com/railwaycat/homebrew-emacsmacport/8b06f75ea28a68f9a490d9001ce33fd1b0d426aa/patches/emacs-mac-29-multi-tty.diff";
        sha256 = "sha256-OpSYG5ew8A1IL5rW/wPwmG2bzZa8iFF+xTYQGiWjzKg=";
      })
      # no-title-bars
      (pkgs.fetchpatch {
        url =
          "https://raw.githubusercontent.com/railwaycat/homebrew-emacsmacport/667f0efc08506facfc6963ac1fd1d5b9b777e094/patches/emacs-26.2-rc1-mac-7.5-no-title-bar.patch";
        sha256 = "sha256-f2DRcUZq8Y18n6MJ6vtChN5hLGERduMB8B1mrrds6Ns=";
      })
    ];
  })).override {
    # not necessary, but enforce these options to be true
    withNativeCompilation = true;
    withTreeSitter = true;
  };
  buildEmacs = (pkgs.emacsPackagesFor emacs29-macport).emacsWithPackages;
  treesitGrammars =
    (pkgs.emacsPackagesFor emacs29-macport).treesit-grammars.with-all-grammars;
in {
  emacs = buildEmacs (epkgs: with epkgs; [ vterm treesitGrammars ]);
  treesitGrammars = treesitGrammars;
}

```

`config-emacs.nix`: configuraiton of emacs

```nix
{ pkgs, config, lib, ... }:
let
  emacs29 = (pkgs.callPackage ./pkg-emacs29-macport.nix { });
in {
  home.packages = lib.mkBefore ([ emacs29.emacs ]);

  home.file = {
    # tree-sitter subdirectory of the directory specified by user-emacs-directory
    ".config/emacs/.local/cache/tree-sitter".source =
      "${emacs29.treesitGrammars}/lib";
  };
}
```

> Tree-sitter language grammars are distributed as dynamic libraries. In order to use a language grammar in Emacs, you need to make sure that the dynamic library is installed on the system. Emacs looks for language grammars in several places, in the following order:
  first, in the list of directories specified by the variable treesit-extra-load-path;
  then, in the **tree-sitter subdirectory of the directory specified by user-emacs-directory** (see The Init File);
  and finally, in the system’s default locations for dynamic libraries. {=[Tree-sitter Language Grammar](https://www.gnu.org/software/emacs/manual/html_node/elisp/Language-Grammar.html)}

Finally use this `config-emacs.nix` in your `home.nix` using `home-manager`

```nix
imports = [
  ./config-emacs.nix
]
```
