---
date: '2023-12-10T01:23:54+08:00'
title: 'Nix Use Git Submodule'
tags: [git, nix]
---

## Issue

When I decided to manage my sketchybar configuration as a git submodule within my Nix Flakes setup, I encountered an unexpected obstacle. Attempting to run ****darwin-rebuild**** was met with failure as the system couldn’t locate the source of the local directory. It’s a known issue as discussed in the [Submodules of flakes are not working](http://github.com/NixOS/nix/issues/6633) thread.


## Overcoming the Submodule Challenge

I devised a workaround that resolved the problem and ensured proper file execution permissions. Before diving into the implementation details, I must emphasize the necessity of updating the flake.lock file. This is a critical step to ensure submodule is recognized by nix:

```shell
nix flake lock --update-input config-sketchybar-src
```

## Solution

In `flake.nix` define the submodule directory as input

```nix
{
    inputs = {
      # submodule directory
      config-sketchybar-src = {
        url = "git+file:./config-sketchybar";
        flake = false;
      };
    };

    outputs = inputs@{ self, nixpkgs, darwin, home-manager, ... }:
    let username = "nohzafk";
    in {
      darwinConfigurations."MacBook-Pro" = darwin.lib.darwinSystem {
        system = "aarch64-darwin";
        specialArgs = { inherit inputs username; };
        modules = [
          ./configuration.nix
          ./system-preferences.nix
          {
            users.users."${username}" = {
              name = "${username}";
              home = "/Users/${username}";
            };
          }
          home-manager.darwinModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users."${username}".imports = [ ./home.nix ];
            home-manager.extraSpecialArgs = { inherit inputs username; };
          }
        ];
      };
    };
}
```

in `home.nix`

```nix
{ inputs, username, config, pkgs, ... }: {
    imports = [
       ./config-window-manager.nix
    ];
}
```

in `config-window-manager.nix`

```nix
{ inputs, lib, pkgs, ... }: {
let
  sketchybar-config =
    pkgs.callPackage ./pkg-sketchybar-config.nix { inherit inputs pkgs; };
in {
  home.packages =
    lib.mkBefore = [ sketchybar-config ];

  home.file.".config/sketchybar".source = sketchybar-config;

}
```

finally in `pkg-sketchybar-config.nix`

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

In the end, the satisfaction of having your local directory seamlessly integrated as a git submodule and functioning perfectly within the Nix ecosystem is well worth the effort.
