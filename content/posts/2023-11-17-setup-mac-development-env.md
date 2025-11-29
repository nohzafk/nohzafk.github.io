---
date: '2023-11-17T23:04:59+08:00'
title: 'Setup Development Environment for Macbook'
tags: [macos, tools, python]
---
## display

System Settings > Accessibility > Display > Turn On Reduce Motion

## modifier key
* `⌘` change to `^`
* `caps lock` change to `⌘`

## finder
```shell
# show hidden files
defaults write com.apple.finder AppleShowAllFiles YES

# show path bar
defaults write com.apple.finder ShowPathbar -bool true

killall Finder;
```

## brew

[install brew](https://docs.brew.sh/Installation)

### [Quick Look plugins](https://sourabhbajaj.com/mac-setup/Homebrew/Cask.html)

```shell
brew install --cask \
    qlcolorcode \
    qlstephen \
    qlmarkdown \
    quicklook-json \
    qlprettypatch \
    quicklook-csv \
    betterzip \
    webpquicklook \
    suspicious-package
```

### applications

```shell
brew install --cask \
    appcleaner \
    google-chrome \
    iterm2 \    
    raycast \
    visual-studio-code
```

### command line tools
```shell
# [Nerd Font](https://www.nerdfonts.com/)
brew install --cask font-fira-code-nerd-font

brew install \
    bat \
    fish \
    git \
    git-delta \
    go \
    hugo \
    jq \
    neofetch \
    orbstack \
    ripgrep \
    starship \
    tree \
    wget
```

## git
```shell
git config --global alias.ci commit
git config --global alias.co checkout
git config --global alias.ss status
```

### git-delta
`~/.gitconfig`

```ini
[core]
    pager = delta

[interactive]
    diffFilter = delta --color-only

[delta]
    navigate = true    # use n and N to move between diff sections
    light = false      # set to true if you're in a terminal w/ a light background color (e.g. the default macOS terminal)

[merge]
    conflictstyle = diff3

[diff]
    colorMoved = default
```


## fish shell

```shell
starship preset nerd-font-symbols -o ~/.config/starship.toml
```

add to `~/.config/fish/config.fish`

```shell
# Add HomeBrew's bin directory to path so you can use HomeBrew's binaries like `starship`
# Fish uses `fish_add_path` instead of `export PATH` modify $PATH.
fish_add_path "/opt/homebrew/bin/"
# Enable Starship prompt
starship init fish | source
```

### Package manager
[fisher](https://github.com/jorgebucaran/fisher)

plugin:
* [z](https://github.com/jethrokuan/z)

### abbreviation
add to `~/.config/fish/config.fish`

```shell
source ~/.config/fish/abbreviation.fish
```

create `abbreviation.fish`
```shell
abbr proxyall "set --export http_proxy http://127.0.0.1:7890; set --export https_proxy http://127.0.0.1:7890"
```

### custom function
it's very easy to add a custom function in fish shell, [an example](https://dev.to/aminnairi/fish-in-the-boat-4j9f)

## Visual Studio Code

### Settings
Side Bar:Location change to `right`

### extensions
* Auto Hide
* AutoTrim
* Emacs Friendly Keymap
* Indenticator
* Sort lines
* vscode-icons

## Python
use [pyenv](https://github.com/pyenv/pyenv) to manage Python environments, don't reply on the python installed by `brew`, because it might update Python version upexpecetdly when performs `brew update`.

```shell
brew install readline xz pyenv
# otpinal: setup pyenv with fish shell
alias brew="env PATH=(string replace (pyenv root)/shims '' \"\$PATH\") brew"
exec "$SHELL"

pyenv install 3.11.6
pyenv global 3.11.6
```

### Reference
* https://opensource.com/article/19/5/python-3-default-mac

## Terminal emulator

iTerm2

## Keyboard setting
Use `fn` to `Change Input Source`

Keyboard Shortcuts -> Uncheck all `Input Sources` `Spotlight`

### Apple Internal Keyboard
Keyboard Shortcuts -> Modifier Keys

- `Caps Lock Key` -> `Command`
- `Command` -> `Control`

### External Keyboard
Keyboard Shortcuts -> keep Modifier Keys unchanged

Karabiner-Elements

- left_command -> left_control
- left_control -> left_command
- right_command -> right_control
- right_option -> `fn`

Make Caps Lock → Hyper Key (⌃⌥⇧⌘) (Caps Lock if alone)[import](https://ke-complex-modifications.pqrs.org/#hyper_key)


## Tiling Windows Manager

- yabai (no need to disable `System Integrity Protection`)
- skhd

yabai installation and configuration reference:
- [System Settings](https://github.com/koekeishiya/yabai/wiki#installation-requirements)
- [brew install](https://github.com/koekeishiya/yabai/wiki/Installing-yabai-(latest-release))
- [typical config](https://www.josean.com/posts/yabai-setup)

skhd config

`cmd + ctrl + shift + alt` is the `Hyper` Key configurated using `Karabiner-Elements`

```shell
# change focus between external displays (left and right)
cmd + ctrl + shift + alt - p : yabai -m display --focus west
cmd + ctrl + shift + alt - n : yabai -m display --focus east

# fullscreen window
cmd + ctrl + shift + alt - m : yabai -m window --toggle zoom-fullscreen

# cycle focus between windows
cmd + ctrl + shift + alt - o : yabai -m window --focus prev || yabai -m window --focus last
# cycle swap window to the main window
cmd + ctrl + shift + alt - j : /bin/bash ~/bin/cycle_clockwise.sh; yabai -m window --focus prev || yabai -m window --focus last

# rotate layout clockwise
cmd + ctrl + shift + alt - r : yabai -m space --rotate 270
# flip along y-axis
cmd + ctrl + shift + alt - y : yabai -m space --mirror y-axis
# flip along x-axis cmd + ctrl + shift + alt - x : yabai -m space --mirror x-axis
# toggle window float
cmd + ctrl + shift + alt - f : yabai -m window --toggle float --grid 4:4:1:1:2:2
```

`cycle_clockwise.sh`:
```bash
#!/bin/bash

win=$(yabai -m query --windows --window last | jq '.id')

while : ; do
    yabai -m window $win --swap prev &> /dev/null
    if [[ $? -eq 1 ]]; then
        break
    fi
done
```









