---
title: "Why My Mermaid Arrows Disappeared in Emacs"
post: 2026-05-25-why-my-mermaid-arrows-disappeared-in-emacs.md
date: 2026-06-13T14:50:58+0800
tags: [emacs, macos, tools]
---
I'm building a real-time Mermaid preview for Markdown in Emacs. The idea is straightforward: grab a fenced Mermaid block, pipe it through `mmdflux`, get SVG back, and display it inline in the buffer.

It almost worked on the first try. Nodes rendered. Labels rendered. Edges rendered. But the arrowheads were gone.

## The Broken Diagram

This block should obviously have arrows:

```mermaid
flowchart LR
    Decls["Declarations<br/>package! · config-unit!"]
    Elle["Elle backend"]
    Runtime["Runtime helpers<br/>package-vc · unit exec · reload"]

    Decls -->|export session data| Elle
    Elle -->|emit forms via :eval| Runtime
````

I got lines connecting the nodes, but no arrowheads. A flowchart without arrows is just boxes and string.

The first debugging question writes itself:

> Is `mmdflux` emitting bad SVG, or is Emacs failing to render valid SVG?

## Checking the SVG

`mmdflux` supports text, SVG, and structured JSON output. I was using SVG.

Mermaid-style arrows are represented with `<marker>` definitions and `marker-end` references — the standard SVG mechanism for drawing arrowheads at the final vertex of a path. Nothing exotic.

I reduced the problem to a minimal SVG:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="80">
  <defs>
    <marker id="arrow"
            viewBox="0 0 10 10"
            refX="10" refY="5"
            markerWidth="8" markerHeight="8"
            orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="black"/>
    </marker>
  </defs>
  <path d="M 20 40 L 180 40"
        stroke="black" stroke-width="4" fill="none"
        marker-end="url(#arrow)"/>
</svg>
```

Then rendered it outside Emacs:

```bash
resvg arrow.svg arrow-resvg.png
sips -s format png arrow.svg --out arrow-sips.png
```

`resvg` drew the arrowhead. `sips` (Apple's renderer) did not.

That was the answer. The SVG was fine. The rendering backend my Emacs build was using doesn't support SVG markers.

## The Emacs Build Detail

My custom macOS Emacs build uses the native image API:

```text
--with-native-image-api
```

So Emacs happily reports SVG support:

```elisp
(image-type-available-p 'svg)
;; => t
```

But `t` here only means "I can load an SVG and put pixels on screen." It says nothing about feature coverage. The native macOS image API doesn't implement the full SVG spec — and `<marker>` is one of the gaps.

The proper solution is `librsvg`, which is what `emacs-plus` builds with by default and what the Emacs manual associates with SVG support. If you're using a stock Homebrew Emacs build, you probably already have it and will never hit this.

## Why I Didn't Just Add librsvg

Because my Emacs build project, [ebuild](https://github.com/nohzafk/ebuild), has a strong constraint: the final binary should be static and self-contained.

Pulling `librsvg` from Homebrew would work, but it drags in a dynamic dependency stack. The whole point of the build is a single, mostly-static artifact — adding a runtime link against Homebrew's library tree defeats that.

Building `librsvg` from source is the other option, and it's not small. You're taking on Rust/Cargo, cargo-cbuild, Meson, Cairo (with PNG support), FreeType, GLib, libxml 2, and Pango — with optional deps for GDK-Pixbuf, GObject introspection, Vala bindings, AVIF support, and more. Upstream also notes that reproducible builds need vendored Cargo dependencies, since Cargo wants to fetch crates at build time.

That's not "add a library." That's importing a slice of the GNOME graphics stack into my build system. A much bigger project than fixing Mermaid preview arrows.

So I chose a workaround.

## The Workaround: Rasterize Before Display

The pipeline becomes:

```text
Mermaid source → mmdflux → SVG → resvg → PNG → Emacs buffer
```

SVG stays as the interchange format — `mmdflux` already produces good SVG, and I don't want to lose that. But before handing it to Emacs, I rasterize with `resvg`:

```bash
resvg diagram.svg diagram.png
```

Then display the PNG:

```elisp
(create-image png-file 'png nil
              :ascent 'center
              :scale 1
              :max-width max-width
              :max-height max-height)
```

This sidesteps the broken marker rendering entirely.

## Why PNG Is a Workaround, Not a Fix

A proper SVG renderer inside Emacs is the right answer. With `librsvg`, the preview stays vector-based, scales cleanly, and doesn't need an intermediate rasterization step.

But for now, PNG is the right tradeoff:

- Arrowheads render correctly.
- No Homebrew `librsvg` linked into the final binary.
- No vendored GNOME dependency chain to maintain.
- `mmdflux` stays unchanged.

The bug wasn't in Mermaid. It wasn't in `mmdflux`. It was in the SVG rendering path of my Emacs build — a gap in feature coverage that only shows up when you hit the specific SVG features Mermaid relies on.

The practical fix: move the final rendering step to a tool that actually implements the spec.

```text
valid SVG + capable rasterizer = correct preview
```

## Sources

- [mmdflux docs](https://docs.rs/mmdflux/latest/mmdflux/)
- [GNU Emacs Lisp Reference: Image Formats](https://www.gnu.org/s/emacs/manual/html_node/elisp/Image-Formats.html)
- [GNU Emacs Lisp Reference: SVG Images](https://www.gnu.org/software/emacs/manual/html_node/elisp/SVG-Images.html)
- [MDN: `marker-end`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end)
- [resvg project](https://github.com/linebender/resvg)
- [emacs-plus README](https://github.com/d12frosted/homebrew-emacs-plus)
- [librsvg compilation docs](https://gnome.pages.gitlab.gnome.org/librsvg/devel-docs/compiling.html)