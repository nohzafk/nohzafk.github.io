---
title: Always use Wezterm from Applications
post: 2024-11-24-always-use-wezterm-from-applications.md
date: 2024-11-24T03:24:42+0800
tags: [homebrew, raycast, wezterm]
---
# A raycast script command to start lowfi
I recently create a Raycast script command to start the [lowfi](https://github.com/talwat/lowfi) command effortlessly, so I can enjoy the lowfi music in no time and control it just using keyboard.

Here is the [gist](https://gist.github.com/nohzafk/8b89d55ef372b57d7ef9b6a462c7c1cf), just place the **lowfi.sh** to the [Raycast Script Directory](https://github.com/raycast/script-commands). Run it the first time, a wezterm window will be created if lowfi process isn't running, run it the second time, the wezterm window will be brought to the front.

# Problem of using /opt/hombrew/bin/wezterm
While i thought it was a simple task, it tooks me 1 hour to finished it. I encountered a totally unexpected problem: osascript can't control the wezterm window that running lowfi process.

I installed wezterm using homebrew cask, when launching WezTerm using the Homebrew-installed binary (`/opt/homebrew/bin/wezterm`), the window was created with a **NULL** bundleID, which made it impossible for AppleScript/System Events to properly control it. This is because the Homebrew version doesn't properly register itself with macOS's window management system.

I was only able to debug this problem thanks to the amazing [aerospace](https://github.com/nikitabobko/AeroSpace) command

> aerospace debug-windows

The solution was to always use the full application path `/Applications/WezTerm.app/Contents/MacOS/wezterm` for all WezTerm operations, ensuring proper window management integration with macOS.

When launching WezTerm using the full application path (`/Applications/WezTerm.app/Contents/MacOS/wezterm`), the window is created with the proper bundleID `com.github.wez.wezterm`. This allows:

1. System Events to properly identify and control the window
2. AppleScript to manipulate the window through accessibility actions (AXRaise, AXMain)
3. Proper window focusing and bringing to front