---
title: Goto in C programming language
date: 2023-11-23T02:46:01+0800
tags: [programming, linux]
---
I have very limited experience about goto statement except that I know it is not encouraged in high level language. Today I learn from a comment of [why is it illegal to use “goto”](https://youtu.be/AKJhThyTmQw?si=VNvB5j_euTgwLRQa) that `goto` statement are commonly used in Linux kernel in resource acquisition/release pattern. 

> The goto statement comes in handy when a function exits from multiple locations and some common work such as cleanup has to be done. If there is no cleanup needed then just return directly. {=[Centralized exiting of functions - Linux kernel coding style](https://www.kernel.org/doc/html/v4.19/process/coding-style.html#centralized-exiting-of-functions)}

## Context: Resource Acquisition and Release
* In C, managing resources like memory, file handles, or network connections is critical. These resources must be acquired before use and released after use.
* The process of acquiring and releasing resources is prone to errors. If not handled correctly, it can lead to issues like memory leaks, where memory isn't freed correctly, or resource exhaustion, where resources aren't released back to the system.

## Why goto is Useful Here
`Simplifies Error Handling`: When acquiring multiple resources, each step might fail. Normally, you'd need nested if statements to handle these failures. However, with goto, you can jump to the specific code that releases resources, simplifying the error handling.

`Clarity and Maintenance`: By using goto for forward jumps, the flow of error handling becomes linear and more readable. This is in contrast to nested if statements, which can become complex and difficult to follow.

## Example
```c
int function() {
    int *resource1 = acquireResource1();
    if (resource1 == NULL) goto error1;

    int *resource2 = acquireResource2();
    if (resource2 == NULL) goto error2;

    // Use resources...

    releaseResource2(resource2);
    releaseResource1(resource1);
    return SUCCESS;

error2:
    releaseResource1(resource1);
error1:
    return FAILURE;
}
```

In this example, if acquiring resource2 fails, the code jumps to error2, where resource1 is released. This ensures that even if there is an error in acquiring the second resource, the first one is properly released