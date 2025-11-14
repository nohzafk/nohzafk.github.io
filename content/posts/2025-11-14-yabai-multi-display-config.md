---
title: Per-Display Layout Configuration in Yabai Using spacespy
post: 2025-11-14-yabai-multi-display-config.md
date: 2025-11-14T22:20:02+0800
tags: [macos, spacespy, tiling_window_manager, yabai]
---
# Per-Display Layout Configuration in Yabai Using spacespy

## The Problem

When running yabai with multiple displays, you often want different layouts per screen:

- **Built-in laptop display**: Stack layout (one window at a time)
- **External displays**: BSP tiling (multiple windows side-by-side)

The challenge? `yabai -m query --displays` gives you display indices but doesn't tell you which is the built-in screen.

## The Solution: spacespy

[spacespy](https://github.com/nohzafk/spacespy) is a lightweight macOS utility that provides display information as JSON, including whether a display is "Built-in" or external.

Install from source:

```bash
git clone https://github.com/nohzafk/spacespy.git
cd spacespy
make
sudo make install
```

## The Configuration Script

Create `~/.config/yabai/configure-displays.sh`:

```bash
#!/usr/bin/env bash

# Get display information
spacespy_output=$(spacespy)
displays=$(yabai -m query --displays)

# Configure layout for all spaces on a display
configure_display() {
  local display_index=$1
  local layout=$2

  spaces=$(echo "$displays" | jq -r ".[] | select(.index == $display_index) | .spaces[]")

  for space in $spaces; do
    yabai -m config --space "$space" layout "$layout"
  done
}

# Find built-in display
builtin_display_number=$(echo "$spacespy_output" | jq -r '.monitors[] | select(.name | contains("Built-in")) | .display_number')
all_display_numbers=$(echo "$spacespy_output" | jq -r '.monitors[].display_number')
display_count=$(echo "$displays" | jq 'length')

if [ "$display_count" -eq 1 ]; then
  # Single display - use stack
  configure_display 1 "stack"
else
  # Multiple displays
  [ -n "$builtin_display_number" ] && configure_display "$builtin_display_number" "stack"

  # External displays - use BSP
  for display_num in $all_display_numbers; do
    [ "$display_num" != "$builtin_display_number" ] && configure_display "$display_num" "bsp"
  done
fi
```

Make it executable:

```bash
chmod +x ~/.config/yabai/configure-displays.sh
```

## Event-Driven Reconfiguration

Add to your `.yabairc`:

```bash
# Configure on startup
bash ~/.config/yabai/configure-displays.sh

# Reconfigure when displays change
yabai -m signal --add event=display_added \
  action="bash ~/.config/yabai/configure-displays.sh"

yabai -m signal --add event=display_removed \
  action="bash ~/.config/yabai/configure-displays.sh"

yabai -m signal --add event=display_moved \
  action="bash ~/.config/yabai/configure-displays.sh"

yabai -m signal --add event=mission_control_exit \
  action="bash ~/.config/yabai/configure-displays.sh"
```

## Why This Works

1. **Automatic**: Connect/disconnect displays → layouts reconfigure automatically
2. **Clean separation**: spacespy handles display detection, yabai handles window management
3. **SIP-compatible**: Works with System Integrity Protection enabled
4. **Simple**: One script, a few signal handlers

## The Result

On the go (laptop only) → stack layout maximizes limited screen space
At my desk (external monitors) → BSP tiling on big screens, stack on laptop

The transition happens automatically. No manual intervention needed.

The key insight: spacespy provides the missing piece—identifying which display is built-in. Once you know that, per-display layout configuration becomes trivial.