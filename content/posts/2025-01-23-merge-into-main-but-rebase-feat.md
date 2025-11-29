---
title: Merge into main, but rebase feature branches
post: 2025-01-23-merge-into-main-but-rebase-feat.md
date: 2025-01-23T01:29:19+0800
tags: [git]
---
This **git** principle advocates for a workflow that balances a clear main branch history with efficient feature development.

**1. Merge into `main`:**

- **Purpose:**  Keeps the `main` branch history clean and linear in terms of releases and major integrations.
- **How it works:** When a feature is complete and tested, it's integrated into `main` using a **merge commit**. This explicitly marks the point in time when the feature was incorporated.
- **Benefit:** `main` branch history clearly shows the progression of releases and key integrations, making it easier to track releases and understand project evolution.

**2. Rebase feature branches:**

- **Purpose:**  Maintains a clean and linear history *within* each feature branch and simplifies integration with `main`.
- **How it works:** Before merging a feature branch into `main`, you **rebase** it onto the latest `main`. This replays your feature branch commits *on top* of the current `main`, effectively rewriting the feature branch history.
- **Benefit:**
    - **Linear History:** Feature branch history becomes a straight line, easier to understand and review.
    - **Clean Merges:**  Merging a rebased feature branch into `main` often results in a fast-forward merge (if `main` hasn't advanced since the rebase), or a simpler merge commit, as the feature branch is already based on the latest `main`.
    - **Avoids Merge Bubbles:** Prevents complex merge histories on feature branches that can arise from frequently merging `main` into the feature branch.

**In essence:**

- **`main` branch:**  Preserve a clean, chronological, and release-oriented history using merges.
- **Feature branches:**  Keep them clean and up-to-date with `main` using rebase to simplify integration and maintain a linear development path within the feature.

**Analogy:** Imagine `main` as a clean timeline of major project milestones. Feature branches are like side notes. Rebase neatly integrates those side notes onto the main timeline before officially adding them to the main history via a merge.