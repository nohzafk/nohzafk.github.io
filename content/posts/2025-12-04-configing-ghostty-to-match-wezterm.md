---
title: Configing Ghostty Font and Color to match WezTerm
post: 2025-12-04-configing-ghostty-to-match-wezterm.md
date: 2025-12-04T19:28:38+0800
tags: [macos, tools]
---
## Rendering

After years of using WezTerm, I decided to try Ghostty—the new GPU-accelerated terminal that's been generating buzz. The installation was simple enough, but getting it to look like my carefully tuned WezTerm setup turned into a journey through terminal rendering differences.

Here's what I learned, and the configuration that finally got Ghostty looking right (almost).

## The Problem: Everything Looks Wrong

Opening Ghostty for the first time on my Macbook, something felt off. The colors appeared washed out, the fonts looked thin, and the text seemed more spread out than in WezTerm. Same font (IosevkaTerm Nerd Font Mono), same size—completely different appearance.

This wasn't just my imagination. These are documented issues in the Ghostty community.

Fix #1: Washed Out Colors

The most jarring difference was color saturation. My Gruvbox Light theme looked faded, like viewing it through a fog.

The fix:

```ini
window-colorspace = display-p3
```

That's it. One line. Ghostty defaults to sRGB, but on macOS displays, display-p3 provides the color saturation you expect. This is a https://github.com/ghostty-org/ghostty/discussions/3470 that trips up many new users.

Fix #2: Thin Font Rendering

With colors fixed, the fonts still looked anemic. In WezTerm, I use:

```lua
config.font = wezterm.font({ family = "IosevkaTerm Nerd Font Mono", weight = "Bold" })
```

This loads the actual Bold variant of the font. Ghostty doesn't support specifying font weight this way. Instead, it offers synthetic bolding:

```ini
font-thicken = true
font-thicken-strength = 150
```

The font-thicken option (macOS only) artificially adds stroke weight. The font-thicken-strength parameter (0-255) lets you dial in exactly how much—a feature https://github.com/ghostty-org/ghostty/discussions/3492.

The catch: Synthetic bold isn't true bold. A properly designed Bold font variant has intentionally adjusted proportions. Synthetic bold just makes everything uniformly thicker. You'll notice subtle differences—the bowl of a "d" becomes rounder, letterforms feel slightly different. Whether this matters depends on your sensitivity to typography.

Fix #3: Wide Letter Spacing

Even after the above fixes, text in Ghostty appeared more spread out horizontally.  This is another https://github.com/ghostty-org/ghostty/discussions/3842 roughly 1 pixel difference in letter spacing.

```ini
adjust-cell-width = -5%
```

This tightens the horizontal spacing. Some users go as far as -10%, but I found -5% matched WezTerm closely enough.

## The Complete Configuration

Here's my final Ghostty config, matching my WezTerm setup as closely as possible:

```ini
# Font
font-family = IosevkaTerm Nerd Font Mono
font-size = 16
font-thicken = true
font-thicken-strength = 150
adjust-cell-width = -5%

# Fix washed out colors on macOS
window-colorspace = display-p3

# Gruvbox Light Soft (base16) - matching WezTerm
background = f2e5bc
foreground = 504945
cursor-color = 504945
selection-background = d5c4a1
selection-foreground = 504945

palette = 0=#f2e5bc
palette = 1=#9d0006
palette = 2=#79740e
palette = 3=#b57614
palette = 4=#076678
palette = 5=#8f3f71
palette = 6=#427b58
palette = 7=#504945
palette = 8=#bdae93
palette = 9=#9d0006
palette = 10=#79740e
palette = 11=#b57614
palette = 12=#076678
palette = 13=#8f3f71
palette = 14=#427b58
palette = 15=#282828

# Window
background-opacity = 0.96
window-padding-x = 8
window-padding-y = 0
macos-titlebar-style = hidden
confirm-close-surface = false
```

## Ghostty vs WezTerm: Honest Comparison

| Aspect              | WezTerm                       | Ghostty                                 |
|---------------------|-------------------------------|-----------------------------------------|
| Font weight control | True bold via weight = "Bold" | Synthetic via font-thicken              |
| Color saturation    | "Correct" by default          | Requires window-colorspace = display-p3 |
| Letter spacing      | Tighter                       | Wider (fix with adjust-cell-width)      |
| Config format       | Lua (powerful, verbose)       | INI-style (simple, limited)             |
| Hot reload          | Automatic                     | Manual (Cmd+Shift+,)                    |

## Should You Switch?

Ghostty is fast, lightweight, and under active development—it has real potential. But after all the tweaking needed to match WezTerm's appearance (and still not quite getting there), I'm sticking with WezTerm for now. It just works out of the box.

I'll revisit Ghostty in a few months when it's more mature. For now, the config above gets it 90% of the way there. Whether that last 10% matters is up to you.

---

Resources:
- https://ghostty.org/docs/config
- https://github.com/tinted-theming/base16-schemes/blob/main/gruvbox-light-soft.yaml