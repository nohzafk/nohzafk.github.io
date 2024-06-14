---
title: quickly invoke services menu item
post: 2024-06-15-quickly-invoke-services-menu-item.md
date: 2024-06-14T18:41:50+0800
tags: [applescript, macos, services]
---
In macOS, I've configured a variety of **shortcuts** to automate tasks, for example:
- Appending selected text to a specified Obsidian note.
- Opening a prompt menu and sharing the selected text with ChatGPT to obtain results.
- Extracting text from an image to read in an editor.
- And many others.

I frequently use these actions on both my iPhone and Mac. However, on macOS, I find myself having to manually navigate through the **Services menu** to activate these actions, which tends to slow down my workflow.

To streamline this process, I've developed a script that automatically triggers a **Services menu** item whenever I select text and press **Command** + **Right Click**. This enhancement significantly speeds up my interaction with macOS, making my workflow more efficient.

[[Hammerspoon]] script

```lua
-- Ensure the listener is global to avoid garbage collection issues
MouseListener = hs.eventtap.new({ hs.eventtap.event.types.rightMouseDown }, function(e)
  local buttonPressed = e:getProperty(hs.eventtap.event.properties.mouseEventButtonNumber)
  local cmdPressed = e:getFlags().cmd

  if cmdPressed == true then
    -- AppleScript to open the Services menu
    -- https://stackoverflow.com/a/59330902/22903883
    hs.osascript.applescript([[
tell application "System Events"
    set appName to item 1 of (get name of processes whose frontmost is true)
    tell (process 1 where frontmost is true)
        tell menu bar 1
            tell menu bar item appName
                tell menu appName
                     tell menu item "Services"
                          tell menu "Services"
                            click menu item "GPT: Share"
                          end tell
                     end tell
                end tell
            end tell
        end tell
    end tell
end tell]])
    return true -- Consume the right-right-click
  end

  return false
end)

-- Start the event listener
MouseListener:start()
```