---
title: Fixing the "disk lvmid not found" Error in Proxmox 7.4.6
date: 2023-10-21
tags: [proxmox, grub, lvm]
---

## Problem: Unable to Boot System After Upgrading to Proxmox 7.4.6

After upgrading to Proxmox 7.4.6 and rebooting the system, an error message appears, stating "disk 'lvmid/<PVID>/<LVID>' not found." This issue is caused by a bug in GRUB.

## Solution: Using Super-Grub2 to Boot and Repair GRUB2

To resolve this issue, follow these steps:

1. Create a bootable USB using [Super Grub Disk2 Rescue ISO](https://www.supergrubdisk.org/).

2. Boot the system from the Super Grub Disk2 USB.

3. Upon booting, an orange-colored menu will appear.

4. Select "Enable GRUB2's RAID and LVM support" and press Enter.

5. Press Esc to return to the main menu.

6. Select "Boot manually" and press Enter.

7. Select "Operating Systems" and press Enter.

8. Scroll down to the second last option, "Linux /boot/vmlinuz-5.xx.xx-x-pve (lvm/pve-root)," and press Enter.

9. The system will reboot and boot into Proxmox VE as before.

10. Once successfully booted into Proxmox VE, open the Proxmox VE shell.

11. Run the following command to repair GRUB2: `update-grub`.

However, running the `update-grub` command may throw errors related to disks not found. To resolve this, perform the following steps:

12. Inside the Proxmox VE shell, run the following command to extend the LVM: `lvextend -L +1G /dev/pve/`.

13. After extending the LVM, run the following command to reduce the LVM back: `lvreduce -L -1G /dev/pve/`.

14. After completing these steps, you should be able to use the system as normal.

References:
- [Proxmox Forum Thread: System Unbootable - GRUB Error: Disk lvmid not found](https://forum.proxmox.com/threads/system-unbootable-grub-error-disk-lvmid-not-found.98761/post-534701)
- [Reddit Thread: Stuck at GRUB Rescue After an Update and Reboot](https://www.reddit.com/r/Proxmox/comments/vy33ho/stuck_at_grub_rescue_after_an_update_and_reboot/)