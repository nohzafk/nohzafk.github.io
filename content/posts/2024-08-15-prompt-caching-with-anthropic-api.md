---
title: Prompt caching with Anthropic API
post: 2024-08-15-prompt-caching-with-anthropic-api.md
date: 2024-08-14T18:51:32+0800
tags: [api_calls, in-context_learning, prompt_caching]
---
Anthropic AI just announced [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)

## What

Prompt caching is a feature that allows developers to efficiently use large amounts of context or instructions in repeated API calls to Claude. While the entire prompt (including cached content) is sent with each request, the cached portion is processed more efficiently and charged at a reduced rate after the initial setup.

Key benefits:

- Reduced costs: Cached content is charged at only 10% of the base input token price in subsequent requests.
- Improved performance: Potentially faster processing times for large, repeated contexts.
- Enhanced capabilities: You can include more examples, instructions, or background information cost-effectively, leveraging Claude's in-context learning abilities.

Use cases:

- Chatbots that need consistent, complex instructions
- Coding assistants that reference large codebases
- Q&A systems working with entire books or documents
- Any application requiring extensive, consistent context across multiple interactions

## How

1. Initial cache setup: The first request to set up the cache is charged at 125% of the base input token price for the cached portion of the prompt (cache write).
2. Subsequent requests: The cached portion of the prompt is charged at 10% of the base input token price (cached read).
3. The entire prompt, including cached content, is sent with each request but processed more efficiently.
4. Cache has a 5-minute lifetime, refreshed each time the cached content is used.

## Important notes

- Prompt caching doesn't reduce data transfer; the full prompt is sent each time.
- It's not traditional fine-tuning, but a way to efficiently leverage Claude's long context window (200k tokens) and in-context learning capabilities.
- Enables customization of model behavior for specific tasks without changing model parameters.