---
title: build your own workflow
post: 2024-10-22-build-your-own-workflow.md
date: 2024-10-22T07:06:26+0800
tags: [django, emacs, automation]
---
# Build Your Own Workflow: Automating Tasks for Efficiency

Emacs is all about tailoring the text editor to fit your own needs, and Lisp program language is all about building the right abstraction for the problem. After years of using Emacs/writing Emacs lisp, one lesson stands out: whenever you find yourself repeating a task, it's time to build your own tools and create a personalized workflow.  A good automated workflow isn't just about saving time—it's about using automation to offload tedious, repetitive details, freeing up mental energy for the things that truly matter in the task. With the rise of Large Language Models (LLMs), even tasks that previously required fuzzy logic can now be automated.

On mobile, iOS Shortcuts offers a powerful way to design custom workflows. Pair it with tools like a-Shell, Scriptable, and Data Jar, and you can create powerful automation that integrates seamlessly with your daily tasks.

## Example 1: Automating Stroke Order Lookup

Sometimes, I forget the stroke order of a Chinese character and need to look it up. Instead of using third-party apps or look it up on the website every time, I built a Scriptable script that handles this for me automatically. It visit zdict.net, download and display the GIF. Now, with one tap, I can quickly find the stroke order without breaking my flow.

## Example 2: Automating note taking of Language Learning

When learning German, I often need to record new vocabulary. To streamline this, I crafted a custom prompt for ChatGPT to help with translations and explanations, and then log the results into [[Obsidian]] for future study. I linked these steps into a single iOS Shortcut, making the process completely automated—from asking the question to saving the notes.

## Example 3: Job Search Automation

Job hunting can be an exhausting process, involving multiple platforms, browsing job descriptions (JDs), evaluating opportunities, and tracking applications. After repeating these steps too many times, I developed a Python application combined with Selenium for browser automation. This app scrapes job postings, pulls the JDs, and stores the data in a Django backend. I also integrated ChatGPT to compare my resume with the job descriptions, giving me a quick assessment of which positions are a good match. This allows me to filter out irrelevant jobs and focus on those with the highest potential, leaving only the final judgment to manual review.
## build the automation
By building your own workflow, you can minimize time wasted on tedious details and concentrate on what truly matters. Whether it's handling simple everyday tasks or tackling more complex challenges like job hunting, there's always room to streamline your process.