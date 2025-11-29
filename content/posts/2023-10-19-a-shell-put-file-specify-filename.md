---
title: Specify filename for 'put file' shortcut action of A-Shell on iOS
date: 2023-10-20
images: ["/images/20231020_2d7567.jpg"]
tags: [ios, automation]
---

As of the time of writing, the current version of A-Shell is **1.12.1**.

## Passing Python Files to A-Shell

When using the iOS shortcut action [A-Shell](https://holzschu.github.io/a-Shell_iOS/), the `Put File` action does not provide an option to **specify the filename**. Instead, it automatically names the file based on the first line of th content, excluding special symbols.

Base on this observation we can use the first line to specify filename and modify it after the file creation.

Let's consider the following content.

```python
getgif
import sys

if __name__ == "__main__":
    # print the first command line argument
    print(sys.argv[1])
```

it will be named `getgif.txt` after being passed from the "Text" action into A-Shell `put file` action

## Removing the First Line with Sed

To remove the first line of a file (in this case, `getgif.txt`), we can utilize the `Execute Command` shortcut action in A-Shell. The command we can use is

```shell
sed -i '' '1d' getgif.txt
```

## Executing the Python Script

Once we have removed the first line of the file, we can proceed to execute the Python script within A-Shell using `Execute Command`

```python
python getgif.txt "hello"
```
