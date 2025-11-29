---
title: Solving Playwright Error in Google cloud run container
date: 2023-11-10T21:01:15+0800
tags: [devops, automation, python]
---

I recently ventured into deploying a service on Google Cloud Run. My goal was straightforward: create a service that fetches webpage titles and captures screenshots of URLs. However, the journey led me into a peculiar bug when I actually used it on Goole Cloud Run.

## The Bug

During the development phase, I worked with a `python:3.11-slim` base image on `macOS`, and my Dockerfile functioned without a hitch. Here's a snapshot of the Dockerfile I used:

```dockerfile
from python:3.11-slim

RUN apt-get update && \
    apt-get install -y git && \
    python -m pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install pytest-playwright && \
    playwright install-deps && \
    playwright install && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

Yet, upon deploying to Google Cloud Run and initiating the screenshot capture process, I hit a snag:

```text
playwright._impl._api_types.Error: Executable doesn't exist at /home/.cache/ms-playwright/chromium-1084/chrome-linux/chrome
╔═════════════════════════════
║ Looks like Playwright was just installed or updated.                   
║ Please run the following command to download new browsers: 
║                                                                                                            
║     playwright install                                                                          
║                                                                                                            
║ <3 Playwright Team                                                                         
╚═════════════════════════════
```

## Official Playwright Docker Image Saves the Day

Rather than wrestle with the error, I pivoted to an official Docker image of Playwright, and skipped installation of dependency:

> mcr.microsoft.com/playwright/python:v1.39.0-jammy {=[docker image](https://playwright.dev/python/docs/docker)}


Let’s dig down the issue:

### The Compatibility Issue

Playwright demands compatibility. It [officially supports](https://playwright.dev/python/docs/intro#system-requirements) Python versions 3.8 and higher, and it requires specific Linux distributions:

- Debian 11 (bullseye)
- Debian 12 (bookworm)
- Ubuntu 20.04 (focal)
- Ubuntu 22.04 (jammy)

However, on docker environment, the official image is only based on [Unbuntu](https://playwright.dev/docs/docker#base-images).

### Use ENV PLAYWRIGHT_BROWSERS_PATH

After some search and experiments, I found the only solution in to [specify the chromium binary files using ENV **PLAYWRIGHT_BROWSERS_PATH** during install](https://stackoverflow.com/a/75885021/22903883). source code [Dockerfile](https://github.com/microsoft/playwright-python/blob/9060038770d19256d08ec29fab82086f07a3cce9/utils/docker/Dockerfile.jammy#L25) also use this environment variable to specify the broswer executable path.

using `python:3.11-slim-bookworm`

```dockerfile
FROM python:3.11-slim-bookworm

ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install git
RUN apt-get update

# install playwright or whatever
RUN python -m pip install --upgrade pip && \
    pip install -r requirements.txt

# install chrominum
RUN PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright && \
    playwright install --with-deps chromium
```

using `ubuntu:22.04`

```dockerfile
FROM ubuntu:22.04

ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install git
RUN apt-get update && \
    apt-get install -y python3-all python-is-python3 python3-pip

# install playwright or whatever
RUN python -m pip install --upgrade pip && \
    pip install -r requirements.txt

# install chrominum
RUN PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright && \
    playwright install --with-deps chromium
```

## Memory requirement of Google Cloud Run
The playwright 1.39.0 requires slightly more than 512MB of memory to run on Google Cloud Run. Adjust the memory limit on GCR, as it’s 512 MB by default. 

## Conclusion
Use the official Docker image to save time, or specify the `PLAYWRIGHT_BROWSERS_PATH` environment variable on a supported linux docker image.

Further reading:
 - [A deep dive into the “official” Docker image for Python](https://pythonspeed.com/articles/official-python-docker-image/).
 - [Managing browser binaries](https://playwright.dev/python/docs/browsers#managing-browser-binaries)
