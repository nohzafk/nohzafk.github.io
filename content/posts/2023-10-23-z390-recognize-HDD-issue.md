---
title: Troubleshooting HDD Recognition in Gigabyte Z390 Motherboard BIOS
date: 2023-10-23
tags: [hardware]
---

## Problem

The Gigabyte Z390 motherboard fails to detect a connected hard disk drive (HDD) in the BIOS settings.

## Issue Specifics

When changing the SATA port after saving the BIOS settings, the HDD is not recognized. This issue may arise when connecting or rearranging SATA devices in the system.

## Solution

To resolve this problem, perform a CMOS reset and reboot the system. This allows the BIOS to correctly detect the SATA port and associated devices.

### Instructions

1. Locate the CMOS reset pins on the Gigabyte Z390 motherboard.
2. Use a screwdriver to short the two CMOS reset pins together.
3. Reboot the system and enter the BIOS settings again.
4. The BIOS should now be able to read the connected SATA configuration properly.

## Additional Information

This issue seems to be specific to the Gigabyte Z390 Designare motherboard. Users have reported that any changes to the SATA configuration, such as adding a new hard drive or rearranging SATA connections, can cause the BIOS to fail to recognize the devices. The only known solution in this case is to reset the CMOS by shorting the two pins on the motherboard.

For more information and user experiences, refer to the [Gigabyte forum thread](http://forum.gigabyte.us/thread/5594/z390-aorus-sata-ports-working).