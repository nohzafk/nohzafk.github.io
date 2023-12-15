---
title: Installing and Enabling Content Caching for a macOS VM in Proxmox
date: 2023-10-25
tags: [proxmox, macos, content-caching, virtual machine]
---

## Overview
This guide provides step-by-step instructions for installing and enabling content caching for a macOS virtual machine (VM) in Proxmox.

## Install a macOS VM
Follow the tutorial [here](https://i12bretro.github.io/tutorials/0628.html) to install a macOS VM in Proxmox.

## Enable Content Caching
If you encounter difficulties enabling content caching through the Sharing menu, follow the instructions provided [here](https://github.com/falafalafala1668/ContentCachingInVM).

## Registration
If you are unable to register and receive a "Content Caching is temporarily unavailable" message, follow these steps:

1. Post-install OpenCore configuration.
2. Fix GenSMBios by following the steps [here](https://dortania.github.io/OpenCore-Post-Install/universal/iservices.html#using-gensmbios).
3. Fix en0 by verifying en0 as build-in. Details can be found [here](https://dortania.github.io/OpenCore-Post-Install/universal/iservices.html#fixing-en0).

![Image: en0](/images/20231025_9c2ede.jpg)

4. Fix ROM by following the steps [here](https://dortania.github.io/OpenCore-Post-Install/universal/iservices.html#fixing-rom).
5. Reboot your VM and verify the content caching status. 

   Reboot and verify the content caching status, you should be seen `Activated: true` and `Active: true`

```shell
> AssetCacheManagerUtil status

Content caching status:
    Activated: true
    Active: true
    ActualCacheUsed: 2.79 GB
    CacheDetails: (3)
        iCloud: 23.86 GB
        Mac Software: 211.7 MB
        Other: 701.7 MB
    CacheFree: 14.28 GB
    CacheLimit: 45 GB
    CacheStatus: OK
    CacheUsed: 24.77 GB
```

![Image: Content Caching Status](/images/20231025_7fc3e3.jpg)

For additional information and discussion, refer to the [Reddit post](https://www.reddit.com/r/MacOS/comments/zqium9/content_caching_in_macos_virtual_machine_proxmox/j5duitb/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button).