// Figures for the when-to-fold post.
// Each <figure class="ft" data-ft="NAME"> is filled by FIGS[NAME].
// Sizes are thousands of tokens; prices are in units of the model's input
// price, as in the post. Every figure computes the rule the way the host's
// Bend core does: apply when cold, at compaction's trigger, or when r·D·h >= E.
(() => {
  if (window.__ftLoaded) return;
  window.__ftLoaded = true;

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
  const k = (x) => `${Math.round(x)}k`;
  const num = (x) => (Math.abs(x) >= 100 ? Math.round(x).toString() : (+x.toFixed(1)).toString());

  // ---------- the rule ----------

  const PRICES = {
    opus: { r: 0.05, w: 2, name: "opus-5-5: r 0.05, w 2" },
    r10: { r: 0.1, w: 2, name: "r 0.1, w 2" },
    deepseek: { r: 0.02, w: 1, name: "DeepSeek: r 0.02, w 1" },
  };
  const HS = [5, 10, 20, 40, 80, 160, Infinity];
  const sub = (a, b) => Math.max(0, a - b);

  function decide({ queued, cold, over, price, D, L, S, h }) {
    if (queued === 0) return { apply: false, why: "nothing queued" };
    if (cold) return { apply: true, why: "cold" };
    if (over) return { apply: true, why: "pressure" };
    const E = price.w * sub(sub(L, D), S) - price.r * sub(L, S);
    const save = h === Infinity ? (price.r * D > 0 ? Infinity : 0) : price.r * D * h;
    return { apply: save >= E, why: save >= E ? "pays" : "waits", E, save };
  }

  const select = (label, opts, value) => {
    const l = h("label", null, label + " ");
    const s = h("select");
    for (const [v, t] of opts) s.append(new Option(t, v, false, v === value));
    l.append(s);
    return [l, s];
  };
  const slider = (label, min, max, step, value, fmt = k) => {
    const l = h("label", null, `${label} <output></output>`);
    const i = h("input");
    Object.assign(i, { type: "range", min, max, step, value });
    l.append(i);
    const out = l.querySelector("output");
    const show = () => { out.textContent = fmt(+i.value); };
    i.addEventListener("input", show);
    show();
    return [l, i];
  };
  const check = (label, on) => {
    const l = h("label");
    const i = h("input");
    i.type = "checkbox";
    i.checked = on;
    l.append(i, document.createTextNode(" " + label));
    return [l, i];
  };
  const hOpts = HS.map((x) => [String(x), x === Infinity ? "∞" : String(x)]);

  // ---------- figure: the pulse of a session ----------
  // A synthetic session, not a recorded one: every request adds 4k of tool
  // results; every fifth request the card comes and the model queues a 20k
  // fold. 35k of tools, system prompt and cover stay put; 25k of open work
  // stays in the tail. Compaction's trigger is at 170k.

  function session({ policy, h, breaks, price }) {
    const N = 100, G = 4, FOLD = 20, TRIGGER = 170, TITLE = 0.06;
    const coldAt = breaks ? new Set([31, 67]) : new Set();
    let S = 35, Q = 0, queued = 0, T = 25, prev = 0;
    const reqs = [];
    for (let i = 0; i < N; i++) {
      T += G;
      const card = i % 5 === 4;
      if (card) { T -= FOLD; Q += FOLD; queued++; }
      const L = S + Q + T;
      const cold = i === 0 || coldAt.has(i);
      let d = { apply: false, why: queued ? "waits" : "" };
      if (policy === "once") d = { apply: queued > 0, why: queued ? "at once" : "" };
      else d = decide({ queued, cold, over: L >= TRIGGER, price, D: Q, L, S, h });
      const n = queued;
      let cached, sent;
      if (d.apply) {
        const before = S;
        S += TITLE * queued;
        Q = 0;
        queued = 0;
        sent = S + T;
        cached = cold ? 0 : before;
      } else {
        sent = L;
        cached = cold ? 0 : Math.min(prev, sent);
      }
      const written = sent - cached;
      reqs.push({ i, sent, cached, written, apply: d.apply, why: d.why, n, card, cold, cost: price.r * cached + price.w * written });
      prev = sent;
    }
    return { reqs, total: reqs.reduce((a, q) => a + q.cost, 0), trigger: TRIGGER };
  }

  const pulse = {
    build(fig) {
      const ctl = h("div", "fc-controls");
      const [hl, hs] = select("the rule's h", hOpts, "20");
      const [bl, bs] = check("the user steps away twice for over an hour", true);
      const play = h("button", null, "play");
      ctl.append(play, hl, bl);
      const svg = svgEl("ft-pulse", "Two runs of one synthetic session: every request's prompt, read from the cache or written.");
      const info = h("pre", "ft-info");
      const key = h("div", "fc-key",
        `<span class="ft-sw cached"></span> read from the cache &nbsp; <span class="ft-sw written"></span> written: a miss ` +
        `&nbsp; <span class="ft-mk card">▼</span> the model queues a fold &nbsp; <span class="ft-mk apply">●</span> the queue is applied ` +
        `&nbsp; <span class="ft-sw cold"></span> the user was away`);
      fig.append(ctl, svg, key, info);

      const W = 660, x0 = 8, rowH = 112, gap = 34, N = 100, bw = (W - x0 - 8) / N;
      let shown = N, timer = null, focus = null;

      const render = () => {
        const price = PRICES.opus;
        const hv = +hs.value;
        const runs = [
          ["apply every fold at once", session({ policy: "once", h: hv, breaks: bs.checked, price })],
          [`the rule, h = ${hv === Infinity ? "∞" : hv}`, session({ policy: "rule", h: hv, breaks: bs.checked, price })],
        ];
        const max = 180, sc = (rowH - 26) / max;
        const out = [];
        const base = runs[0][1].total;
        runs.forEach(([title, run], r) => {
          const y0 = r * (rowH + gap), yb = y0 + rowH;
          const upto = run.reqs.slice(0, shown);
          const cost = upto.reduce((a, q) => a + q.cost, 0);
          const misses = upto.filter((q) => q.i > 0 && q.cached / q.sent < 0.9).length;
          out.push(`<text class="fc-lbl" x="${x0}" y="${y0 + 11}">${title}</text>`);
          out.push(`<text class="ft-total" x="${W - 8}" y="${y0 + 11}" text-anchor="end">cost ${Math.round(cost)}${shown === N ? ` · ${(run.total / base).toFixed(2)}×` : ""} · ${misses} miss${misses === 1 ? "" : "es"}</text>`);
          const yt = yb - run.trigger * sc;
          out.push(`<line class="ft-trigger" x1="${x0}" x2="${W - 8}" y1="${yt}" y2="${yt}"/>`);
          for (const q of upto) {
            const x = x0 + q.i * bw;
            if (q.cold && q.i > 0) out.push(`<rect class="ft-cold" x="${x}" y="${y0 + 16}" width="${bw}" height="${rowH - 16}"/>`);
            const hc = q.cached * sc, hw = q.written * sc;
            out.push(`<rect class="ft-bar cached${focus === q.i ? " focus" : ""}" x="${x + 0.5}" y="${yb - hc}" width="${bw - 1}" height="${hc}"/>`);
            out.push(`<rect class="ft-bar written${focus === q.i ? " focus" : ""}" x="${x + 0.5}" y="${yb - hc - hw}" width="${bw - 1}" height="${hw}"/>`);
            if (q.card) out.push(`<text class="ft-mk card" x="${x + bw / 2}" y="${yb - q.sent * sc - 3}" text-anchor="middle">▼</text>`);
            if (q.apply) out.push(`<circle class="ft-apply ${q.why.replace(" ", "-")}" cx="${x + bw / 2}" cy="${yb + 7}" r="3"/>`);
            out.push(`<rect class="ft-hit" data-i="${q.i}" x="${x}" y="${y0 + 16}" width="${bw}" height="${rowH}"/>`);
          }
          out.push(`<line class="ft-axis" x1="${x0}" x2="${W - 8}" y1="${yb}" y2="${yb}"/>`);
          out.push(`<text class="fc-lbl" x="${W - 8}" y="${yt - 3}" text-anchor="end">compaction's trigger</text>`);
        });
        svg.setAttribute("viewBox", `0 0 ${W} ${2 * rowH + gap + 14}`);
        svg.innerHTML = out.join("");
        const q0 = focus == null ? null : runs.map(([t, run]) => [t, run.reqs[focus]]);
        info.textContent = q0
          ? `request ${focus + 1}\n` + q0.map(([t, q]) =>
              `${t.padEnd(26)} sent ${k(q.sent).padStart(5)}  read ${k(q.cached).padStart(5)}  written ${k(q.written).padStart(5)}` +
              (q.apply ? `  applied ${q.n} fold${q.n === 1 ? "" : "s"} (${q.why})` : q.why === "waits" ? `  ${q.n} queued, waiting` : "")).join("\n")
          : "point at a request to see what it sent";
      };

      svg.addEventListener("mousemove", (e) => {
        const t = e.target.closest(".ft-hit");
        const i = t ? +t.dataset.i : null;
        if (i !== focus) { focus = i; render(); }
      });
      svg.addEventListener("mouseleave", () => { focus = null; render(); });
      play.onclick = () => {
        clearInterval(timer);
        shown = 0;
        timer = setInterval(() => { shown++; render(); if (shown >= N) clearInterval(timer); }, 45);
      };
      hs.onchange = render;
      bs.onchange = render;
      render();
    },
  };

  // ---------- figure: one request, one decision ----------

  const rule = {
    build(fig) {
      const ctl = h("div", "fc-controls ft-grid");
      const [sl, ss] = slider("S, kept", 10, 120, 5, 35);
      const [dl, ds] = slider("D, debt", 0, 200, 5, 40);
      const [xl, xs] = slider("rest", 0, 200, 5, 60);
      const [pl, ps] = select("prices", Object.entries(PRICES).map(([v, p]) => [v, p.name]), "opus");
      const [hl, hs] = select("horizon h", hOpts, "20");
      const [cl, cs] = check("cold: the cache misses anyway", false);
      const [ol, os] = check("at compaction's trigger", false);
      ctl.append(sl, dl, xl, pl, hl, cl, ol);
      const svg = svgEl("ft-req", "The request about to be sent, split into what a fold keeps, removes and rewrites.");
      const math = h("pre", "ft-math");
      const verdict = h("div", "ft-verdict");
      fig.append(ctl, svg, math, verdict);

      const render = () => {
        const S = +ss.value, D = +ds.value, X = +xs.value, L = S + D + X;
        const price = PRICES[ps.value], hv = +hs.value;
        const d = decide({ queued: 1, cold: cs.checked, over: os.checked, price, D, L, S, h: hv });
        const E = price.w * X - price.r * (D + X);
        const save = hv === Infinity ? Infinity : price.r * D * hv;
        const need = hv === Infinity ? 0 : ((price.w - price.r) * X) / (price.r * (hv + 1));
        const W = 660, x0 = 8, max = Math.max(280, L * 1.05), sc = (W - 16) / max, y = 22, bh = 30;
        const seg = (cls, a, len, label) =>
          `<rect class="ft-seg ${cls}" x="${x0 + a * sc}" y="${y}" width="${Math.max(0, len * sc)}" height="${bh}"/>` +
          (len * sc > 30 ? `<text x="${x0 + (a + len / 2) * sc}" y="${y + 19}" text-anchor="middle">${label}</text>` : "");
        const brace = (a, len, txt, below) => {
          const yy = below ? y + bh + 8 : y - 6;
          const right = x0 + (a + len) * sc;
          return `<line class="ft-brace" x1="${x0 + a * sc}" x2="${right}" y1="${yy}" y2="${yy}"/>` +
            `<text class="fc-lbl" x="${below ? Math.max(right, 330) : x0}" y="${below ? yy + 13 : yy - 4}" text-anchor="${below ? "end" : "start"}">${txt}</text>`;
        };
        const out = [
          seg("stable", 0, S, `S ${k(S)}`),
          seg("debt", S, D, `D ${k(D)}`),
          seg("rest", S + D, X, `rest ${k(X)}`),
          brace(0, L, `L = ${k(L)}, sent as it stands if the queue waits`, false),
          brace(S + D, X, "written again if the queue is applied", true),
        ];
        if (!cs.checked && !os.checked && need > 0 && need <= max - S) {
          const nx = x0 + (S + need) * sc;
          out.push(`<line class="ft-need" x1="${nx}" x2="${nx}" y1="${y - 4}" y2="${y + bh + 4}"/>`);
        }
        svg.setAttribute("viewBox", `0 0 ${W} ${y + bh + 30}`);
        svg.innerHTML = out.join("");
        math.textContent =
          `E      = w·(L − D − S) − r·(L − S) = ${price.w}·${num(X)} − ${price.r}·${num(D + X)} = ${num(E)}\n` +
          `r·D·h  = ${price.r}·${num(D)}·${hv === Infinity ? "∞" : hv} = ${save === Infinity ? "∞" : num(save)}\n` +
          `rent   = r·D = ${num(price.r * D)} per request: the rewrite is repaid after ${price.r * D > 0 ? Math.ceil(E / (price.r * D)) : "∞"} warm requests\n` +
          (hv === Infinity ? "" : `applies once D ≥ ${k(need)} with this rest (the dashed line)`);
        const why = {
          cold: "APPLY: the cache misses before the fold point anyway, so the rewrite is free",
          pressure: "APPLY: the request would reach compaction's trigger; folds go before a summary",
          pays: `APPLY: the reads saved over ${hv === Infinity ? "an unbounded horizon" : `${hv} requests`} cover the rewrite`,
          waits: `WAIT: the rewrite costs more than ${hv} requests of reading the debt`,
        }[d.why];
        verdict.textContent = why;
        verdict.className = "ft-verdict " + (d.apply ? "apply" : "wait");
      };
      for (const i of [ss, ds, xs]) i.addEventListener("input", render);
      for (const i of [ps, hs, cs, os]) i.addEventListener("change", render);
      render();
    },
  };

  // ---------- figure: rent or buy ----------

  const rent = {
    build(fig) {
      const ctl = h("div", "fc-controls ft-grid");
      const [dl, ds] = slider("D, debt", 5, 150, 5, 40);
      const [xl, xs] = slider("rest", 5, 150, 5, 60);
      const [tl, ts] = slider("cold after", 1, 120, 1, 45, (v) => `${v} req.`);
      ctl.append(dl, xl, tl);
      const svg = svgEl("ft-rent", "Cost of keeping a fold queued against applying it, request by request.");
      const table = h("pre", "ft-math");
      const key = h("div", "fc-key",
        `<span class="ft-sw" style="background:var(--fc-ghost)"></span> keep it queued: pay r·D each request &nbsp; ` +
        `<span class="ft-sw" style="background:var(--fc-a)"></span> apply now: pay E once &nbsp; ` +
        `<span class="ft-sw" style="background:var(--fc-pair)"></span> rent until the rent reaches E, then apply`);
      fig.append(ctl, svg, key, table);

      const render = () => {
        const p = PRICES.opus, D = +ds.value, X = +xs.value, T = +ts.value, H = 20, N = 120;
        const r = p.r * D, E = p.w * X - p.r * (D + X), kb = Math.ceil(E / r);
        const W = 660, x0 = 44, y0 = 10, ch = 170, cw = W - x0 - 14;
        const ymax = Math.max(E * 2.1, r * Math.min(T, N) * 1.1, 10);
        const X_ = (i) => x0 + (i / N) * cw, Y_ = (v) => y0 + ch - (Math.min(v, ymax) / ymax) * ch;
        const line = (cls, f) => {
          const pts = [];
          for (let i = 0; i <= N; i++) pts.push(`${X_(i)},${Y_(f(i))}`);
          return `<polyline class="ft-l ${cls}" points="${pts.join(" ")}"/>`;
        };
        const waitC = (i) => r * Math.min(i, T);
        const buyC = () => E;
        const beC = (i) => (kb < T ? (i < kb ? r * i : r * kb + E) : r * Math.min(i, T));
        const out = [
          `<line class="ft-axis" x1="${x0}" x2="${x0 + cw}" y1="${y0 + ch}" y2="${y0 + ch}"/>`,
          `<line class="ft-axis" x1="${x0}" x2="${x0}" y1="${y0}" y2="${y0 + ch}"/>`,
          `<rect class="ft-cold" x="${X_(Math.min(T, N))}" y="${y0}" width="${Math.max(0, X_(N) - X_(Math.min(T, N)))}" height="${ch}"/>`,
          `<line class="ft-h" x1="${X_(H)}" x2="${X_(H)}" y1="${y0}" y2="${y0 + ch}"/>`,
          `<text class="fc-lbl" x="${X_(H) + 4}" y="${y0 + 11}">h = 20</text>`,
          T < N ? `<text class="fc-lbl" x="${X_(T) + 4}" y="${y0 + ch - 6}">cold: the fold is free from here</text>` : "",
          line("wait", waitC), line("buy", buyC), line("be", beC),
          `<text class="fc-lbl" x="${x0 - 6}" y="${Y_(E) + 4}" text-anchor="end">E</text>`,
          `<text class="fc-lbl" x="${x0 + cw}" y="${y0 + ch + 14}" text-anchor="end">requests after the fold is queued →</text>`,
        ];
        if (kb <= N) out.push(`<circle class="ft-cross" cx="${X_(kb)}" cy="${Y_(r * kb)}" r="3.5"/><text class="fc-lbl" x="${X_(kb) + 6}" y="${Y_(r * kb) - 6}">break-even, ${kb}</text>`);
        svg.setAttribute("viewBox", `0 0 ${W} ${y0 + ch + 20}`);
        svg.innerHTML = out.join("");
        const ruleBuys = r * H >= E;
        const costs = [
          ["apply at once", E],
          ["keep it queued until the cache is cold", r * T],
          ["rent-or-buy: rent until the rent reaches E, then apply", beC(N)],
          [`the rule: ${ruleBuys ? "apply now, since r·D·h ≥ E" : "wait, since r·D·h < E"}`, ruleBuys ? E : r * T],
          ["hindsight: the cheaper of the first two", Math.min(E, r * T)],
        ];
        const best = Math.min(E, r * T);
        table.textContent = costs.map(([t, c]) => `${t.padEnd(56)} ${num(c).padStart(6)}  ${best > 0 ? (c / best).toFixed(2) + "×" : ""}`).join("\n");
      };
      for (const i of [ds, xs, ts]) i.addEventListener("input", render);
      render();
    },
  };

  const FIGS = { pulse, rule, rent };

  for (const fig of document.querySelectorAll("figure.ft[data-ft]")) {
    const f = FIGS[fig.dataset.ft];
    if (!f) continue;
    const stage = h("div", "fc-stage");
    fig.insertBefore(stage, fig.firstChild);
    f.build(stage);
  }
})();
