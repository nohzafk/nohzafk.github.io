---
title: nix use local submodule as package source
date: 2024-05-29T09:04:20+0800
---
Found a hacked way to use local submodule directory as nix package source, so that I might separate different configuration using different git repos.

in `flake.nix` add local submodule as input
```nix
inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    darwin.url = "github:lnl7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    # submodule directory
    config-sketchybar-src = {
      url = "git+file:./config-sketchybar";
      flake = false;
    };
};
```

`config-sketchybar` is a local git submodule, we can define a package using it as source.

`pkg-sketchybar-config.nix`

```nix
{ inputs, pkgs, ... }:

pkgs.stdenv.mkDerivation {
  name = "sketchybar-config";

  dontConfigure = true;
  dontUnpack = true;
  src = inputs.config-sketchybar-src;

  installPhase = ''
    mkdir -p $out
    cp -r $src/config/sketchybar/* $out

    # Find all .sh files and substitute 'jq' with the full path to the jq binary
    find $out -type f -name "*.sh" | while read script; do
      substituteInPlace "$script" \
        --replace 'jq' '${pkgs.jq}/bin/jq'
    done

    chmod -R +x $out
  '';
}
```

and `pkg-sketchybar-config` can be included in home.nix as regular package.
