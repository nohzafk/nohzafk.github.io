// Figures for the prelude post.
// Each <figure class="pl" data-pl="NAME"> is filled by FIGS[NAME].
// lexicon: one toy session stepped request by request, with the lexicon line
// delivered three ways, to show where the line lives and what each define and
// fold costs the prompt cache.
(() => {
  if (window.__plLoaded) return;
  window.__plLoaded = true;

  const SVG = "http://www.w3.org/2000/svg";
  const h = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  // ---------- the model: one toy session, request by request ----------
  // Blocks of the request, in order: tools, the system prompt, the cover (fold
  // titles, once there is one), then the conversation. A block carries the
  // lexicon line ("line") when it names sh(). Each request is compared with the
  // one before: the common prefix is read from the cache, blocks after it that
  // were sent before are written again, the rest are new.
  const EVENTS = [
    { text: "script 1 writes sh() inline", add: "s1" },
    { text: "script 2 writes sh() again", add: "s2" },
    { text: "the model keeps sh(): prelude define", add: "define", define: true },
    { text: "script 3 calls sh()", add: "s3", uses: true },
    { text: "script 4 calls sh()", add: "s4", uses: true },
    { text: "a fold is applied: scripts 1-4 become one title; script 5 calls sh()", add: "s5", fold: true, uses: true },
    { text: "script 6 calls sh()", add: "s6", uses: true },
    { text: "the user steps away; the cache goes cold and the prompt is resealed; script 7 calls sh()", add: "s7", cold: true, uses: true },
  ];

  function simulate(delivery, foldCold) {
    let defined = false, sealed = false, sys = 1, cover = false, notePending = false;
    let conv = [];
    let prev = null;
    const out = [];
    EVENTS.forEach((ev, i) => {
      const cold = i === 0 || !!ev.cold || (!!ev.fold && foldCold);
      if (ev.fold) { conv = conv.filter((b) => !["s1", "s2", "define", "note", "s3", "s4"].includes(b.key)); cover = true; }
      // a fold while the cache is warm takes the note away; the host says it again
      if (ev.fold && delivery === "hint" && defined && !sealed) notePending = "again";
      if (cold && delivery === "hint" && defined && !sealed) { sealed = true; sys++; notePending = false; }
      if (notePending) { conv.push({ key: notePending === "again" ? "note-again" : "note", label: "+ sh", kind: "note", line: true, again: notePending === "again" }); notePending = false; }
      if (delivery === "section" && defined && !sealed) { sealed = true; sys++; }
      conv.push({ key: ev.add, label: ev.add, kind: ev.define ? "define" : "script", line: !!ev.define });
      const blocks = [
        { key: "tools", label: "tools", kind: "tools", ver: 1 },
        { key: "sys", label: "system prompt", kind: "sys", ver: sys, line: sealed },
        ...(cover ? [{ key: "cover", label: "title", kind: "cover", ver: 1 }] : []),
        ...conv.map((b) => ({ ...b, ver: 1 })),
      ];
      let same = !cold && !!prev;
      const had = new Set(prev ? prev.map((b) => b.key) : []);
      for (let j = 0; j < blocks.length; j++) {
        const b = blocks[j], p = prev && prev[j];
        if (same && p && p.key === b.key && p.ver === b.ver) { b.state = "cached"; continue; }
        same = false;
        b.state = cold ? "written" : had.has(b.key) ? "written" : "new";
      }
      const where = blocks.filter((b) => b.line).map((b) => (b.kind === "sys" ? "the system prompt" : b.kind === "note" ? (b.again ? "the hint's note, said again after the fold" : "the hint's note") : "the define call's result"));
      out.push({ i, ev, cold, blocks, defined, knows: where.length > 0, where, rewritten: blocks.filter((b) => b.state === "written").length });
      if (ev.define) { defined = true; if (delivery === "hint") notePending = true; }
      prev = blocks;
    });
    return out;
  }

  const DELIVERY = [
    ["hint", "a host hint: sealed into the prompt, notes between"],
    ["section", "a system-prompt section"],
    ["result", "the define call's result only"],
  ];
  const WIDTH = { tools: 44, sys: 104, cover: 40, define: 52, note: 36, script: 34 };

  const lexicon = {
    build(fig) {
      const ctl = h("div", "fc-controls");
      const dl = h("label", null, "the lexicon line is kept in ");
      const ds = h("select");
      for (const [v, t] of DELIVERY) ds.append(new Option(t, v, false, v === "hint"));
      dl.append(ds);
      const cl = h("label");
      const cb = h("input");
      cb.type = "checkbox";
      cl.append(cb, document.createTextNode(" the fold is applied after a break, when the cache is cold"));
      ctl.append(dl, cl);
      const nav = h("div", "fc-controls");
      const prevB = h("button", "fc-quiet", "◀");
      const nextB = h("button", null, "next ▶");
      const steps = h("span", "pl-steps");
      nav.append(prevB, nextB, steps);
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("class", "pl-bar");
      svg.setAttribute("role", "img");
      const key = h("div", "fc-key",
        '<span class="pl-sw cached"></span> read from the cache &nbsp; <span class="pl-sw new"></span> new in this request ' +
        '&nbsp; <span class="pl-sw written"></span> written again: a miss &nbsp; <span class="pl-chip-k">sh</span> names sh() in the request');
      const info = h("pre", "pl-info");
      fig.append(ctl, nav, svg, key, info);

      let at = 0;
      const dots = EVENTS.map((_, i) => {
        const b = h("button", "pl-dot", String(i + 1));
        b.addEventListener("click", () => { at = i; render(); });
        steps.append(b);
        return b;
      });

      const render = () => {
        const run = simulate(ds.value, cb.checked);
        const q = run[at];
        dots.forEach((d, i) => d.classList.toggle("on", i === at));
        prevB.disabled = at === 0;
        nextB.disabled = at === run.length - 1;
        const W = 520, H = 70, y = 18, bh = 30;
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.setAttribute("aria-label", "Request " + (at + 1) + ": " + q.blocks.map((b) => b.label + ", " + b.state).join("; "));
        let x = 6;
        const parts = [];
        for (const b of q.blocks) {
          const w = WIDTH[b.kind];
          parts.push(`<rect class="pl-blk ${b.state} ${b.kind}" x="${x}" y="${y}" width="${w - 2}" height="${bh}" rx="2"/>`);
          parts.push(`<text x="${x + (w - 2) / 2}" y="${y + 19}" text-anchor="middle">${b.label}</text>`);
          if (b.line) parts.push(`<rect class="pl-chip" x="${x + w - 20}" y="${y - 9}" width="17" height="12" rx="2"/><text class="pl-chip-t" x="${x + w - 11.5}" y="${y}" text-anchor="middle">sh</text>`);
          x += w;
        }
        parts.push(`<text class="pl-req" x="6" y="${y + bh + 16}">request ${at + 1}${q.cold ? " · cache cold" : ""}${q.rewritten && !q.cold ? " · " + q.rewritten + (q.rewritten === 1 ? " block" : " blocks") + " written again" : ""}</text>`);
        svg.innerHTML = parts.join("");

        const ev = q.ev;
        let said;
        if (!q.defined && !ev.define) said = "No helper is kept yet: each script writes its own sh().";
        else if (q.knows) said = "The model is told sh(): in " + q.where.join(" and ") + ".";
        else said = "Nothing in this request names sh(). It is still in scope in every script,\nbut the model no longer knows it exists: it will write it again.";
        info.textContent = `${at + 1}. ${ev.text}\n${said}`;
        info.classList.toggle("lost", q.defined && !q.knows);
      };
      prevB.addEventListener("click", () => { if (at > 0) { at--; render(); } });
      nextB.addEventListener("click", () => { if (at < EVENTS.length - 1) { at++; render(); } });
      ds.addEventListener("change", render);
      cb.addEventListener("change", render);
      render();
    },
  };

  const FIGS = { lexicon };

  for (const fig of document.querySelectorAll("figure.pl[data-pl]")) {
    const f = FIGS[fig.dataset.pl];
    if (!f) continue;
    const stage = h("div", "fc-stage");
    fig.insertBefore(stage, fig.firstChild);
    f.build(stage);
  }
})();
