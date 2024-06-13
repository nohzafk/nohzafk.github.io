---
title: emacs auto completion in devcontainer
post: 2024-06-14-emacs-auto-completion-in-devcontainer.md
date: 2024-06-13T17:22:09+0800
tags: [devcontainer, emacs, lsp-bridge]
---
# Using `lsp-bridge` for Language Server Protocol in Emacs

Emacs 29 introduced built-in TRAMP Docker support for editing files within containers. However, enabling auto-completion inside a container remains challenging.

After discovering [lsp-bridge](https://github.com/manateelazycat/lsp-bridge), I realized the benefit of a Python process interacting with the language server, rather than relying solely on Emacs Lisp.

I added a feature for automatic reconnection to remote SSH servers and started supporting devcontainers. Using nix-darwin to configure my MacBook, I implemented the [devcontainer feature](https://github.com/nohzafk/devcontainer-feature-emacs-lsp-bridge) to install `lsp-bridge` and the language server within the devcontainer. This was facilitated by the [Nix ecosystem](https://search.nixos.org/packages). To make it work, I needed to start with patching the official Nix devcontainer feature and create separate projects — a long journey, but worthwhile.

## Container File Buffer Handling

When opening files in a container, `lsp-bridge` creates an `lsp-bridge` buffer, inserts the file content, and uses it for editing and rendering diagnostic information. The remote file content on the container is maintained by the `lsp-bridge` server running inside the container.

I completed the handling of the visited file modification time for the buffer and enabled auto-revert mode to reload file content automatically when the formatter updates the file.

Using the created `lsp-bridge` buffer, I used `set-visited-file-name` to associate a buffer with a file path. However, saving the buffer after the first save prompts a warning: "File has been changed since visited." This occurs due to discrepancies in how file timestamps are handled by Emacs through TRAMP. To resolve this, Emacs' record of the file’s modification time must be manually updated with something like this:

```lisp
(defun my-update-file-mod-time ()
  (when buffer-file-name
    (let ((mod-time (file-attribute-modification-time (file-attributes buffer-file-name))))
      (set-visited-file-modtime mod-time))))

(add-hook 'after-save-hook 'my-update-file-mod-time)
```

Emacs' "auto-revert" mode, which automatically reverts buffers when the displayed files change externally, is also useful when files are updated by the formatter. Therefore, the file buffer must enable `auto-revert-mode`.

With these pieces in place, I now have a smooth editing experience with auto-completion inside the devcontainer.

Emacs rocks!