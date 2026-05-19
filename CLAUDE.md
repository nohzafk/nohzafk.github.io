# Hugo Blog - afk-blog-hugo

Personal blog built with Hugo using a custom terminal/console-themed design.

## Quick Start

```bash
# Development server
hugo server

# Production build
hugo --minify

# Create new post (add tags manually after)
hugo new content/posts/YYYY-MM-DD-post-title.md

# Create new project
hugo new content/projects/project-name.md
```

## Project Structure

```
content/
  posts/           # Blog posts (YYYY-MM-DD-title.md)
  projects/        # Project showcase pages
  about.md         # About page
layouts/
  _default/        # Base templates (baseof, single, taxonomy)
  partials/        # Reusable components (header, footer, timeline)
  posts/           # Posts-specific layouts
  projects/        # Projects-specific layouts
assets/css/        # CSS processed via Hugo Pipes
static/
  css/             # Static CSS files
  fonts/           # Custom fonts (Departure Mono)
  images/          # Site images
```

## Design System

The blog uses a **terminal/console aesthetic**:

- **Fonts**: IBM Plex Mono (body), Departure Mono (decorative/headers)
- **Colors**: Amber accent theme (#8b5a00 light / #80580a dark)
- **Terminal styling**: Shell prompts, EOF indicators, box-drawing frames
- **Syntax highlighting**: atom-one-light (light) / gruvbox-dark-hard (dark)

Key partials for terminal styling:
- `partials/timeline.html` - Posts listing with `tail -f` styling
- `partials/projects.html` - Projects listing with `ls -la` styling
- `partials/header_article.html` - Article headers with HUD frame

## Post Frontmatter

```yaml
---
title: Post Title
date: YYYY-MM-DD
images: ["/images/filename.jpg"]  # Optional featured image
tags: [tag1, tag2, tag3]
---
```

## Key Features

- **Mermaid diagrams**: Use fenced code blocks with `mermaid` language
- **Lightbox**: Auto-enabled for images
- **Utterances comments**: Configured for `nohzafk/blog-comment` repo
- **Hugo Modules**: utterances (comments), hugo-pangu-spacing (CJK formatting)

## Configuration

- `hugo.toml` - Main config (menu, params, markup)
- `config/production/hugo.toml` - Production overrides (Google Analytics)
- Permalinks: `/posts/:filename/`
- Goldmark: `unsafe = true` for raw HTML support

## Deployment

GitHub Actions (`.github/workflows/hugo.yml`) deploys to GitHub Pages using Hugo Extended v0.136.4.
