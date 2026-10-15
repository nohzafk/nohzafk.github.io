// Figures for the merge-the-folds post.
// Each <figure class="fc" data-fc="NAME"> is filled by FIGS[NAME].
// Every figure is a small model of the rule, computed the way the host
// computes it: the reader presses the buttons and sees the view change.
(() => {
  if (window.__fcLoaded) return;
  window.__fcLoaded = true;

  const SVG = "http://www.w3.org/2000/svg";
  const h = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const svgEl = (cls, label) => {
    const s = document.createElementNS(SVG, "svg");
    s.setAttribute("class", cls);
    s.setAttribute("role", "img");
    if (label) s.setAttribute("aria-label", label);
    return s;
  };
  const popcount = (n) => n.toString(2).split("1").length - 1;
  const range = (b) => {
    const size = 1 << b.level, hi = b.lo + size - 1;
    return size > 1 ? `${b.lo}–${hi}` : `${b.lo}`;
  };

  // ---------- drawing ----------

  // One row of blocks: the view as the prompt renders it, oldest first.
  function drawFlat(svg, n, view) {
    const W = 300, x0 = 4, cw = (W - 8) / n, H = 30;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const out = [];
    for (const b of view) {
      const size = 1 << b.level;
      out.push(`<rect class="fc-blk view lvl${b.level}" x="${x0 + b.lo * cw + 1}" y="4" width="${size * cw - 2}" height="22" rx="2"/>`);
      out.push(`<text x="${x0 + (b.lo + size / 2) * cw}" y="19" text-anchor="middle">${range(b)}</text>`);
    }
    svg.innerHTML = out.join("");
  }

  // The forest: every aligned block that exists, one row per level,
  // with the view's blocks filled and the rest drawn as ghosts.
  function drawForest(svg, n, view, pair, maxLevel, opt = {}) {
    const W = 640, x0 = opt.levelLabels ? 130 : 10;
    const cw = Math.min(40, Math.floor((W - x0 - 10) / Math.max(n, 1)));
    const rowH = 22, H = (maxLevel + 1) * rowH + (opt.footer === false ? 14 : 34);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const out = [];
    const inView = new Set(view.map((b) => `${b.lo}:${b.level}`));
    for (let j = maxLevel; j >= 0; j--) {
      const size = 1 << j, y = 10 + (maxLevel - j) * rowH;
      if (opt.levelLabels) {
        out.push(`<text class="fc-lbl" x="4" y="${y + 13}">level ${j} · ${size} unit${size > 1 ? "s" : ""}</text>`);
      }
      for (let lo = 0; lo + size <= n; lo += size) {
        const key = `${lo}:${j}`;
        let cls = `fc-blk lvl${j} ` + (inView.has(key) ? "view" : "ghost");
        if (pair && j === pair.level && (lo === pair.lo || lo === pair.lo + size)) cls += " pair";
        out.push(`<rect class="${cls}" x="${x0 + lo * cw + 1}" y="${y}" width="${size * cw - 2}" height="${rowH - 4}" rx="2"/>`);
        if (j === 0) {
          out.push(`<text x="${x0 + lo * cw + cw / 2}" y="${y + 13}" text-anchor="middle">${lo}</text>`);
        } else if (inView.has(key) || opt.labelAll) {
          out.push(`<text x="${x0 + lo * cw + size * cw / 2}" y="${y + 13}" text-anchor="middle">${lo}–${lo + size - 1}</text>`);
        }
      }
    }
    if (opt.footer !== false) {
      const bits = n.toString(2);
      out.push(`<text class="fc-lbl" x="${x0}" y="${H - 8}">n = ${n} = <tspan class="fc-bit">${bits}</tspan>₂ (${popcount(n)} ones) · view ${view.length} lines · floor ${popcount(n)} lines</text>`);
    }
    svg.innerHTML = out.join("");
  }

  // ---------- figure: what a change costs ----------

  const cache = {
    build(fig) {
      const N = 14;
      const host = h("div", "fc-strips");
      const rowOf = (label, changeAt) => {
        const r = h("div", "fc-strip");
        r.append(h("span", "fc-strip-lbl", label));
        for (let i = 0; i < N; i++) {
          const c = h("span", "fc-cell " + (i < changeAt ? "cached" : "hot"), String(i + 1));
          r.append(c);
        }
        return r;
      };
      host.append(rowOf("edit at the tail", 12), rowOf("edit at the front", 2));
      const key = h("div", "fc-key",
        `<span class="fc-cell cached">n</span> same as the last request: about 0.1× &nbsp;` +
        `<span class="fc-cell hot">n</span> from the first changed byte on: full price`);
      fig.append(host, key);
    },
  };

  // ---------- figure: the forest over 13 units ----------

  const forest = {
    build(fig) {
      const n = 13;
      const fine = [], coarse = [];
      for (let lo = 0; lo < n; lo++) fine.push({ lo, level: 0 });
      let lo = 0;
      for (let j = 3; j >= 0; j--) if (n & (1 << j)) { coarse.push({ lo, level: j }); lo += 1 << j; }
      const mid = [{ lo: 0, level: 2 }, { lo: 4, level: 2 }, { lo: 8, level: 1 }, { lo: 10, level: 0 }, { lo: 11, level: 0 }, { lo: 12, level: 0 }];

      const all = svgEl("fc-forest", "Every aligned block over 13 units, one row per level.");
      fig.append(h("div", "fc-h", "every aligned block that exists over 13 units (dashed: allowed, not merged)"));
      fig.append(all);
      drawForest(all, n, [], null, 3, { levelLabels: true, labelAll: true, footer: false });

      const views = h("div", "fc-views");
      for (const [title, v] of [["no merge", fine], ["partly merged", mid], ["coarsest", coarse]]) {
        const box = h("div", "fc-view");
        box.append(h("div", "fc-h", `${title} · ${v.length} lines`));
        const s = svgEl("fc-flat", `${title} view`);
        box.append(s);
        drawFlat(s, n, v);
        const pre = h("pre");
        pre.textContent = v.map((b) => b.level ? `[${range(b)}]  merged line` : `[${b.lo}]  title`).join("\n");
        box.append(pre);
        views.append(box);
      }
      fig.append(views);
    },
  };

  // ---------- figure: hysteresis ----------

  const saw = {
    build(fig) {
      const svg = svgEl("fc-saw", "Lines in the view against closes, settling to B and to B/2.");
      const W = 640, B = 8, closes = 26;
      const panel = (y0, hgt, L, label) => {
        const out = [], x0 = 40, xw = W - 70, yb = y0 + hgt - 18, sc = (hgt - 52) / (B + 1), dx = xw / closes;
        const X = (i) => x0 + i * dx, Y = (v) => yb - v * sc;
        out.push(`<text class="fc-lbl" x="${x0}" y="${y0 + 12}">${label}</text>`);
        out.push(`<line class="fc-B" x1="${x0}" y1="${Y(B)}" x2="${x0 + xw}" y2="${Y(B)}"/><text class="fc-lbl" x="${x0 + xw + 6}" y="${Y(B) + 4}">B</text>`);
        if (L < B) out.push(`<line class="fc-L" x1="${x0}" y1="${Y(L)}" x2="${x0 + xw}" y2="${Y(L)}"/><text class="fc-lbl" x="${x0 + xw + 6}" y="${Y(L) + 4}">L</text>`);
        out.push(`<line class="fc-axis" x1="${x0}" y1="${yb}" x2="${x0 + xw}" y2="${yb}"/>`);
        const pts = [], dots = [];
        let v = 0;
        for (let i = 0; i <= closes; i++) {
          pts.push(`${X(i)},${Y(v)}`);
          if (v > B) { dots.push(`<circle class="fc-dot" cx="${X(i)}" cy="${Y(v)}" r="3.5"/>`); v = L; pts.push(`${X(i)},${Y(v)}`); }
          v++;
        }
        out.push(`<polyline class="fc-line" points="${pts.join(" ")}"/>`, dots.join(""));
        out.push(`<text class="fc-lbl" x="${x0 + xw / 2}" y="${y0 + hgt - 4}" text-anchor="middle">closes →</text>`);
        return out.join("");
      };
      svg.setAttribute("viewBox", `0 0 ${W} 230`);
      svg.innerHTML = panel(0, 112, B, "settle to just under B: the view moves on every close") +
        panel(118, 112, B / 2, "settle to L = B/2: the view moves once per B/(2t) closes");
      fig.append(svg);
    },
  };

  // ---------- figure: the simulator ----------

  const sim = {
    build(fig) {
      const MAX = 48;
      const S = { n: 0, view: [], written: new Set(), settles: 0, lastPair: null, log: [] };

      const ctl = h("div", "fc-controls");
      const b1 = h("button", null, "close ×1");
      const b10 = h("button", null, "close ×10");
      const br = h("button", "fc-quiet", "reset");
      const budgetLbl = h("label", null, `budget B <output>8</output> lines `);
      const budget = h("input"); budget.type = "range"; budget.min = "3"; budget.max = "16"; budget.value = "8";
      budgetLbl.append(budget);
      const rankLbl = h("label", null, "rank ");
      const rank = h("select", null, `<option value="small">smallest first</option><option value="age">age/size (cordis)</option>`);
      rankLbl.append(rank);
      ctl.append(b1, b10, br, budgetLbl, rankLbl);

      const stats = h("div", "fc-stats");
      const stat = (label) => { const d = h("div"); d.append(h("span", "fc-lbl", label), h("b", null, "0")); stats.append(d); return d.lastChild; };
      const stN = stat("units n"), stLines = stat("view lines"), stWritten = stat("lines written"),
        stSettles = stat("view moved"), stFloor = stat("floor (ones in n)");

      const svg = svgEl("fc-forest", "The forest after each close; filled blocks are the view.");
      const lines = h("pre", "fc-lines");
      const log = h("pre", "fc-log");
      fig.append(ctl, stats, svg, h("div", "fc-h", "rendered view, oldest first"), lines, h("div", "fc-h", "log"), log);

      const nLines = () => S.view.length;
      const pairs = () => {
        const out = [];
        for (let i = 0; i + 1 < S.view.length; i++) {
          const a = S.view[i], b = S.view[i + 1], size = 1 << a.level;
          if (a.level === b.level && a.lo % (2 * size) === 0 && b.lo === a.lo + size) out.push({ i, lo: a.lo, level: a.level, size });
        }
        return out;
      };
      const key = (p) => rank.value === "small"
        ? [p.size, p.lo]                                   // smallest first, then oldest
        : [-((S.n - p.lo) / p.size), p.lo, -p.size];       // age/size descending, older, larger
      const cmp = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };

      const settle = (B) => {
        const L = Math.floor(B / 2);
        if (nLines() <= B) return;
        S.settles++;
        let merged = 0;
        while (nLines() > L) {
          const ps = pairs();
          if (!ps.length) { S.log.push(`n=${S.n}: stuck at the floor, ${nLines()} lines > L=${L}; reported, no unit dropped`); break; }
          ps.sort((a, b) => cmp(key(a), key(b)));
          const p = ps[0];
          S.written.add(`${p.lo}:${p.level + 1}`);
          S.view.splice(p.i, 2, { lo: p.lo, level: p.level + 1 });
          S.lastPair = { lo: p.lo, level: p.level };
          merged++;
        }
        if (merged) S.log.push(`n=${S.n}: ${nLines() + merged} lines > B=${B} → settle: ${merged} pair${merged > 1 ? "s" : ""} merged, now ${nLines()} lines (≤ L=${L}); view moved once`);
      };
      const close = () => {
        S.lastPair = null;
        S.view.push({ lo: S.n, level: 0 });
        S.n++;
        settle(+budget.value);
        if (S.n >= MAX) S.log.push(`the simulator stops at ${MAX} units`);
      };
      const render = () => {
        let maxLevel = 0;
        for (const b of S.view) maxLevel = Math.max(maxLevel, b.level);
        if (S.lastPair) maxLevel = Math.max(maxLevel, S.lastPair.level + 1);
        drawForest(svg, S.n, S.view, S.lastPair, Math.max(maxLevel, 1));
        const B = +budget.value;
        stN.textContent = S.n;
        stLines.textContent = nLines();
        stLines.classList.toggle("over", nLines() > B);
        stWritten.textContent = S.written.size;
        stSettles.textContent = S.settles;
        stFloor.textContent = popcount(S.n);
        lines.textContent = S.view.length
          ? S.view.map((b) => b.level ? `[${range(b)}]  merged line (${1 << b.level} units)` : `[${b.lo}]  title`).join("\n")
          : "(empty view)";
        log.textContent = S.log.slice(-6).join("\n") || "(press close)";
        log.scrollTop = log.scrollHeight;
      };
      const reset = () => { S.n = 0; S.view = []; S.written.clear(); S.settles = 0; S.lastPair = null; S.log = []; render(); };

      b1.onclick = () => { if (S.n < MAX) { close(); render(); } };
      b10.onclick = () => { for (let i = 0; i < 10 && S.n < MAX; i++) close(); render(); };
      br.onclick = reset;
      budget.oninput = () => { budgetLbl.querySelector("output").textContent = budget.value; render(); };
      rank.onchange = render;
      reset();
    },
  };

  const FIGS = { cache, forest, saw, sim };

  for (const fig of document.querySelectorAll("figure.fc[data-fc]")) {
    const f = FIGS[fig.dataset.fc];
    if (!f) continue;
    const stage = h("div", "fc-stage");
    fig.insertBefore(stage, fig.firstChild);
    f.build(stage);
  }
})();
