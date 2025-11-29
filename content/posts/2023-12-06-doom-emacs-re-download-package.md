---
title: Doom emacs re-download package
date: 2023-12-06T10:00:11+0800
tags: [emacs]
---
If you are experiencing issues with a Doom Emacs package that has been cloned from GitHub, and you want to force a re-download or re-clone of the package, you can use the following steps to address the issue:

1. Delete the Problematic Package: Navigate to your .emacs.d/.local/straight/repos/ directory (or wherever your packages are stored; this path is the default for Doom Emacs). Locate the directory corresponding to the problematic package and delete it.

```bash
rm -rf ~/.emacs.d/.local/straight/repos/<package-name>
``` 
Replace <package-name> with the actual name of the package directory you want to remove.

2. Clear Build Cache: Clear the build cache that might contain failed or partial build information. The build cache is typically located in the .emacs.d/.local/straight/build/ directory.

```bash
rm -rf ~/.emacs.d/.local/straight/build/<package-name>
``` 

3. Run Doom Sync: Run doom sync in your terminal to synchronize your configuration. This will re-download and rebuild any missing or deleted packages.

``` bash
doom sync
``` 

4. Restart Emacs: After running doom sync, restart Emacs to ensure that all changes take effect.

Remember that you should re-enable the package your config.el before running **doom sync** if you previously disabled it.