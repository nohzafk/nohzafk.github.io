{
  description = "afk-blog: Hugo at the version the GitHub Pages workflow uses";

  # nixpkgs at the commit that packaged Hugo 0.161.1, the HUGO_VERSION in
  # .github/workflows/hugo.yml. Move the two together.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/1fe26c67674e03db6b7371a3e0e34779b870d168";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in {
      devShells = forAll (pkgs: {
        # go fetches the Hugo modules listed in go.mod
        default = pkgs.mkShell { packages = [ pkgs.hugo pkgs.go ]; };
      });
    };
}
