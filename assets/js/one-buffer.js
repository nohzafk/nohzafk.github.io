// Figures for the one-buffer-one-window post. Each figure is a tiny model of
// one mechanism, computed the way Emacs computes it, and driven by the reader.
(() => {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const show = (ch) => (ch === "\n" ? "↵" : ch === " " ? "␣" : ch);

  // ── tape: text properties and stickiness ───────────────────────────
  function tape(fig) {
    const box = fig.querySelector(".obw-tape");
    const say = fig.querySelector(".obw-say");
    const TYPE = "fix it";
    const OUT = ["ok\n", "42\n", "hm\n", "…\n"];
    let cells, anchor, typed, outs, fresh;

    const cell = (ch, props, ns = []) => ({ ch, props: new Set(props), ns });
    function reset() {
      cells = [];
      for (const ch of "done.\n") cells.push(cell(ch, ["ro"], ["ro"]));
      anchor = cells.length;
      for (const ch of "ctx 9%\n") cells.push(cell(ch, ["ro"], ["ro"]));
      cells.push(cell(">", ["ro", "face", "km"]));
      cells.push(cell(" ", ["ro", "face", "km"], ["ro", "face"]));
      typed = 0;
      outs = 0;
      fresh = new Set();
    }

    function render() {
      const point = cells.length - 1;
      box.innerHTML = cells
        .map((c, i) => {
          const cls = ["obw-cell"];
          if (i === anchor) cls.push("anchor");
          if (c.ns.length && c.props.has("face")) cls.push("ns");
          if (fresh.has(i)) cls.push("fresh");
          if (i === point) cls.push("point");
          const lanes = ["ro", "face", "km"]
            .map((p) => `<span class="obw-lane ${p}${c.props.has(p) ? " on" : ""}"></span>`)
            .join("");
          return `<div class="${cls.join(" ")}" title="${esc([...c.props].join(" ") || "no properties")}"><span class="obw-ch${c.ch === "\n" ? " nl" : ""}">${esc(show(c.ch))}</span>${lanes}</div>`;
        })
        .join("");
      fresh = new Set();
    }

    function typeKey() {
      if (typed >= TYPE.length) {
        say.innerHTML = "The draft is full in this model. Press <b>reset</b>.";
        return;
      }
      const prev = cells[cells.length - 1];
      const inherited = [...prev.props].filter((p) => !prev.ns.includes(p));
      const ch = TYPE[typed++];
      cells.push(cell(ch, inherited));
      fresh.add(cells.length - 1);
      const names = { ro: "read-only", face: "face", km: "keymap" };
      const dropped = [...prev.props].filter((p) => prev.ns.includes(p)).map((p) => names[p]);
      say.innerHTML =
        `Typed <b>${esc(show(ch))}</b>. It copies the properties of the character before it ` +
        `(<b>${esc(show(prev.ch))}</b>): gets <code>${inherited.map((p) => names[p]).join(", ") || "nothing"}</code>` +
        (dropped.length ? `; <code>${dropped.join(", ")}</code> stop at the rear-nonsticky wall.` : ".") +
        " So it is writable, is not styled as prompt, and carries the input keymap.";
      render();
    }

    function output() {
      if (outs >= OUT.length) {
        say.innerHTML = "Enough output for one figure. Press <b>reset</b>.";
        return;
      }
      const text = OUT[outs++];
      const add = [...text].map((ch) => cell(ch, ["ro"], ["ro"]));
      cells.splice(anchor, 0, ...add);
      add.forEach((_, k) => fresh.add(anchor + k));
      anchor += add.length;
      say.innerHTML =
        "Output is inserted <em>at the anchor</em>, which is also where the input area begins. " +
        "The whole region slides right as one piece — the draft and point come with it, untouched.";
      render();
    }

    fig.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act === "type") typeKey();
      else if (act === "output") output();
      else if (act === "reset") {
        reset();
        say.textContent = "Reset. The prompt is “> ” and the draft is empty.";
        render();
      }
    });
    reset();
    render();
  }

  // ── keys: which keymap answers ─────────────────────────────────────
  function keys(fig) {
    const ol = fig.querySelector(".obw-layers");
    const out = fig.querySelector(".obw-result");
    const sweepBox = fig.querySelector("[data-sweep]");
    const remapBox = fig.querySelector("[data-remap]");
    let where = "region";
    let key = "q";
    const printable = ["q", "5", "SPC", "a"];

    function lookup() {
      const sweep = sweepBox.checked;
      const remapBack = remapBox.checked;
      const layers = [
        {
          name: "<b>keymap</b> text property",
          what: "cordis-input-map — only under point inside the input area",
          present: where === "region",
          map: Object.assign({ "C-RET": "cordis-send" }, sweep ? Object.fromEntries(printable.map((k) => [k, "self-insert-command"])) : {}),
        },
        {
          name: "<b>major mode</b> map",
          what: "derived from special-mode-map",
          present: true,
          map: { q: "quit-window", 5: "digit-argument", SPC: "scroll-up-command" },
        },
        { name: "<b>global</b> map", what: "the usual printable keys", present: true, map: { q: "self-insert-command", 5: "self-insert-command", SPC: "self-insert-command", a: "self-insert-command" } },
      ];
      let hit = -1;
      let cmd = null;
      layers.forEach((l, i) => {
        if (hit < 0 && l.present && l.map[key]) {
          hit = i;
          cmd = l.map[key];
        }
      });
      // the remap pass: consulted after the table lookup, in the same order
      let remap = null;
      if (cmd === "self-insert-command") {
        if (where === "region" && remapBack) remap = { by: "text-property map", to: "self-insert-command" };
        else remap = { by: "special-mode-map", to: "undefined" };
      }
      const final = remap ? remap.to : cmd || "undefined";
      const good = {
        region: { q: "self-insert-command", 5: "self-insert-command", SPC: "self-insert-command", a: "self-insert-command", "C-RET": "cordis-send" },
        output: { q: "quit-window", 5: "digit-argument", SPC: "scroll-up-command", a: "undefined", "C-RET": "undefined" },
      }[where][key];

      ol.innerHTML =
        layers
          .map((l, i) => {
            const cls = !l.present ? "absent" : i === hit ? "hit" + (final === good || remap ? "" : " bad") : hit < 0 || i < hit ? "passed" : "";
            const b = l.present ? (l.map[key] ? `${esc(key)} → ${l.map[key]}` : `${esc(key)}: no binding, fall through`) : "not active here";
            return `<li class="${cls}"><span>${l.name}<br><small>${l.what}</small></span><span>${b}</span></li>`;
          })
          .join("") +
        `<li class="${remap ? "hit" + (final === good ? "" : " bad") : "absent"}"><span><b>remap</b> pass<br><small>runs after the lookup</small></span><span>${
          remap ? `[remap self-insert-command] in ${remap.by} → ${remap.to}` : "nothing to remap"
        }</span></li>`;

      const ok = final === good;
      out.innerHTML = `<b>${esc(key)}</b> in ${where === "region" ? "the input area" : "the output"} runs <code>${final}</code> — <span class="${ok ? "ok" : "bad"}">${
        ok ? "as intended" : "wrong: expected " + good
      }</span>`;
    }

    fig.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.where) {
        where = b.dataset.where;
        fig.querySelectorAll("[data-where]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      } else if (b.dataset.key) {
        key = b.dataset.key;
        fig.querySelectorAll("[data-key]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      }
      lookup();
    });
    sweepBox.addEventListener("change", lookup);
    remapBox.addEventListener("change", lookup);
    fig.querySelectorAll("[data-where]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.where === where));
    lookup();
  }

  // ── window: pad before the body, then pin the start ────────────────
  function win(fig) {
    const H = 18; // window rows
    const K = 2; // region rows
    const screen = fig.querySelector(".obw-screen");
    const dl = fig.querySelector(".obw-readout");
    const range = fig.querySelector("[data-n]");
    const nOut = fig.querySelector("[data-nout]");
    const padBox = fig.querySelector("[data-pad]");
    const width = (i) => 35 + ((i * 37) % 60); // stable ragged line lengths

    function render() {
      const n = +range.value;
      nOut.textContent = n;
      const usePad = padBox.checked;
      const pad = usePad ? Math.max(0, H - K - n) : 0;
      const buf = [];
      for (let i = 0; i < pad; i++) buf.push({ t: "pad" });
      for (let i = 0; i < n; i++) buf.push({ t: "body", i, isNew: i === n - 1 });
      buf.push({ t: "reg", cfg: true }, { t: "reg" });
      const start = Math.max(0, buf.length - H); // pinned window start once content overflows
      const vis = buf.slice(start, start + H);
      while (vis.length < H) vis.push({ t: "empty" });
      screen.innerHTML = vis
        .map((r) =>
          r.t === "body"
            ? `<div class="obw-r body${r.isNew ? " new" : ""}"><i style="width:${width(r.i)}%"></i></div>`
            : `<div class="obw-r ${r.t}${r.cfg ? " cfg" : ""}"></div>`
        )
        .join("");
      const regionRow = vis.findIndex((r) => r.t === "reg") + K; // 1-based row of the draft
      const floating = regionRow !== H;
      screen.classList.toggle("floating", floating);
      screen.dataset.above = start > 0 ? `▲ ${start} line${start > 1 ? "s" : ""} scrolled away` : "";
      const rows = [
        ["window", `${H} rows`],
        ["region K", `${K} rows`],
        ["pad", usePad ? `max(0, ${H} − ${K} − ${n}) = <b>${pad}</b>` : "off"],
        ["origin", start > 0 ? `window-start set ${start} lines down` : "top of buffer"],
        ["draft on row", `<span class="${floating ? "bad" : "ok"}">${regionRow} of ${H}</span>`],
      ];
      dl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    }
    range.addEventListener("input", render);
    padBox.addEventListener("change", render);
    render();
  }

  // ── pixels: whole lines leave a remainder ──────────────────────────
  function pixels(fig) {
    const H = 200; // px of window drawn at 1:1
    const BASE = 20;
    const box = fig.querySelector(".obw-px");
    const dl = fig.querySelector(".obw-readout");
    const spacer = fig.querySelector("[data-spacer]");
    const kinds = {
      line: { h: 20, text: "body text", cls: "" },
      head: { h: 22, text: "## a heading", cls: "head" },
      emoji: { h: 27, text: "done ⚒ with a fallback glyph", cls: "emoji" },
    };
    const lines = ["line", "line", "line", "head", "line", "line", "line", "emoji", "line"].map((k) => kinds[k]);

    function render() {
      // choose window-start by whole lines: as many trailing body lines as fit above the region
      const region = 2 * BASE;
      let used = region;
      let first = lines.length;
      while (first > 0 && used + lines[first - 1].h <= H) used += lines[--first].h;
      const rem = H - used;
      const on = spacer.checked;
      const cfgH = BASE + (on ? rem : 0);
      box.innerHTML =
        lines
          .slice(first)
          .map((l) => `<div class="obw-pl ${l.cls}" style="height:${l.h}px"><span class="h">${l.h}px</span>${esc(l.text)}</div>`)
          .join("") +
        `<div class="obw-pl cfg" style="height:${cfgH}px"><span class="h">${cfgH}px</span>model · ctx 12%${on ? " ␣" : ""}</div>` +
        `<div class="obw-pl draft" style="height:${BASE}px"><span class="h">20px</span>&gt; draft</div>` +
        `<div class="obw-gap" style="height:${on ? 0 : rem}px"></div>`;
      dl.innerHTML = [
        ["window", `${H}px (drawn 1:1)`],
        ["whole lines", `${used}px`],
        ["remainder", `<span class="${rem && !on ? "bad" : "ok"}">${on ? 0 : rem}px</span>`],
        ["spacer", on ? `<code>(space :height ${(cfgH / BASE).toFixed(2)})</code> = ${cfgH}px` : "off"],
      ]
        .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
        .join("");
    }
    fig.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (!act) return;
      lines.push(kinds[act]);
      render();
    });
    spacer.addEventListener("change", render);
    render();
  }

  const kinds = { tape, keys, window: win, pixels };
  const boot = () =>
    document.querySelectorAll("figure.obw[data-obw]").forEach((fig) => {
      const f = kinds[fig.dataset.obw];
      if (f) f(fig);
    });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
