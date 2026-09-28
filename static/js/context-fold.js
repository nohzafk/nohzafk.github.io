// Animated figures for the context-fold post.
// Each <div class="cf" data-cf="NAME"> is filled by FIGS[NAME].
// First paint is the final frame (no motion); the figure plays when it
// scrolls into view, or on the button if the reader prefers reduced motion.
(() => {
  if (window.__cfLoaded) return;
  window.__cfLoaded = true;

  const REDUCE =
    matchMedia("(prefers-reduced-motion: reduce)").matches &&
    location.hash !== "#cf-play";

  const h = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ---------- shared pieces ----------

  function row(kind, task, text) {
    const r = h("div", `cf-row ${kind} t${task}`);
    r.textContent = text;
    r.dataset.task = task;
    return r;
  }

  function setStatus(el, text, cls) {
    el.className = "cf-status" + (cls ? " " + cls : "");
    el.innerHTML = text;
  }

  // Move a copy of `from` onto `dest` (already in the DOM, hidden).
  async function fly(root, from, dest, sleep) {
    const r0 = from.getBoundingClientRect();
    const r1 = dest.getBoundingClientRect();
    const g = from.cloneNode(true);
    g.classList.add("cf-fly");
    g.classList.remove("on");
    Object.assign(g.style, {
      left: r0.left + "px",
      top: r0.top + "px",
      width: r0.width + "px",
      height: r0.height + "px",
      right: "auto",
      bottom: "auto",
      opacity: "1",
      transformOrigin: "top left",
    });
    root.append(g);
    g.getBoundingClientRect();
    g.style.transform =
      `translate(${r1.left - r0.left}px, ${r1.top - r0.top}px) ` +
      `scale(${r1.width / r0.width}, ${r1.height / r0.height})`;
    await sleep(850);
    g.remove();
    dest.style.visibility = "";
  }

  // ---------- figure 1: compress vs fold ----------

  const TASKS = [
    {
      id: "a", turn: 1, ask: "fix the flaky login test",
      concl: "race in session setup, fixed",
      rows: [
        ["u", "fix the flaky login test"],
        ["t", "read tests/login.rs"],
        ["t", "bash cargo test login"],
        ["t", "read src/session.rs"],
        ["t", "edit src/session.rs"],
        ["t", "bash cargo test login"],
        ["a", "fixed: a race in session setup"],
      ],
    },
    {
      id: "b", turn: 2, ask: "add retry to the fetch client",
      concl: "retry with backoff, 3 tries",
      rows: [
        ["u", "add retry to the fetch client"],
        ["t", "grep 'fetch('"],
        ["t", "read src/net.rs"],
        ["t", "edit src/net.rs"],
        ["t", "bash cargo test net"],
        ["a", "retry with backoff, 3 tries"],
      ],
    },
    {
      id: "c", turn: 3,
      rows: [
        ["u", "why is the build so slow?"],
        ["t", "bash cargo build --timings"],
        ["t", "read Cargo.toml"],
        ["t", "read .cargo/config.toml"],
        ["a", "LTO is on in the dev profile"],
      ],
    },
    {
      // same unit as C: a short follow-up that a rule would call "new"
      id: "c", turn: 4, cont: true,
      rows: [
        ["u", "ok, turn it off"],
        ["t", "edit Cargo.toml"],
        ["t", "bash cargo build"],
        ["a", "dev build 4m10s → 48s"],
      ],
    },
  ];

  const compare = {
    title: "Fig. 1 — compress at the limit vs. fold when a unit closes",
    async run(stage, sleep, root) {
      const duo = h("div", "cf-duo");
      stage.append(duo);

      const mk = (title) => {
        const p = h("div");
        p.append(h("div", "cf-pane-h", title));
        const st = h("div", "cf-status");
        const win = h("div", "cf-win");
        const list = h("div", "cf-list");
        win.append(list);
        const meter = h("div", "cf-meter");
        const mt = h("div");
        const bar = h("div", "bar");
        const bi = h("i");
        bar.append(bi);
        meter.append(mt, bar);
        p.append(st, win, meter);
        duo.append(p);
        return { st, win, list, mt, bi, closed: new Set() };
      };
      const L = mk("compress (the usual way)");
      const R = mk("fold");
      const line = h("div", "cf-line", "<span>compaction trigger</span>");
      L.win.append(line);
      setStatus(L.st, "waits for the window to fill");
      setStatus(R.st, "waits for a unit of work to close");

      const live = (P) => [...P.list.children].filter((e) => !e.classList.contains("gone"));
      const meter = (P) => {
        const rows = live(P);
        const stale = rows.filter(
          (e) => e.classList.contains("t") && P.closed.has(e.dataset.task)
        ).length;
        P.mt.innerHTML =
          `in view: <b>${rows.length}</b> msgs · finished work's steps: <b>${stale}</b>`;
        P.bi.style.width = Math.min(100, (rows.length / 16) * 100) + "%";
        P.bi.classList.toggle("hot", rows.length >= 15);
      };
      meter(L);
      meter(R);

      const compact = async () => {
        setStatus(L.st, "window hit the trigger → summarize everything<br>" +
          "(one extra model call over the whole context)", "hot");
        L.win.classList.add("flash");
        await sleep(1300);
        L.win.classList.remove("flash");
        const rows = live(L);
        const doomed = rows.slice(0, rows.length - 2);
        doomed.forEach((e) => e.classList.add("gone"));
        const s = h("div", "cf-summary",
          "summary: fixed a login race; added retry;<br>" +
          "started on build speed… <s>originals: gone</s>");
        L.list.insertBefore(s, doomed[0]);
        await sleep(550);
        doomed.forEach((e) => e.remove());
        meter(L);
        setStatus(L.st, "a paraphrase replaced the record; it can't be read back");
      };

      let seq = 0;
      const fold = async (task) => {
        const group = [...R.list.children].filter(
          (e) => e.dataset.task === task.id && !e.classList.contains("gone")
        );
        const first = group[0];
        const last = group[group.length - 1];
        const top = first.offsetTop;
        const bottom = last.offsetTop + last.offsetHeight;
        const br = h("div", "cf-bracket");
        br.style.top = bottom + "px";
        br.style.height = "0px";
        R.list.append(br);
        br.getBoundingClientRect();
        br.style.top = top + "px";
        br.style.height = bottom - top + "px";
        await sleep(800);
        group.forEach((e) => e.classList.add("lit"));
        seq += 1;
        setStatus(R.st, `model: <b>fold_unit(${task.turn}, ${task.turn})</b><br>` +
          "host splices it out, archives the original", "ok");
        await sleep(700);
        group.forEach((e) => e.classList.add("gone"));
        br.style.opacity = "0";
        const tools = task.rows.filter((r) => r[0] === "t").length;
        const chip = h("div", "cf-chip");
        chip.style.setProperty("--c", `var(--cf-${task.id})`);
        chip.innerHTML =
          `<b>fold#${seq}</b> · turn ${task.turn} · ${tools} tools` +
          `<span class="cf-arch">…-fold-${seq}.json ↗</span>` +
          `<span class="cf-l2">“${esc(task.ask)}” ⇒ ${esc(task.concl)}</span>`;
        R.list.insertBefore(chip, first);
        await sleep(550);
        group.forEach((e) => e.remove());
        br.remove();
        R.closed.delete(task.id);
        meter(R);
      };

      for (let i = 0; i < TASKS.length; i++) {
        const t = TASKS[i];
        for (let j = 0; j < t.rows.length; j++) {
          const [k, text] = t.rows[j];

          if (j === 0 && i > 0) {
            // a new user turn: the host may attach a fold card to it
            const prev = TASKS[i - 1];
            setStatus(R.st, `host: fold card on turn ${t.turn} —<br>` +
              `“anything before this a closed unit?”`);
            await sleep(900);
            if (!t.cont) {
              L.list.append(row(k, t.id, text));
              R.list.append(row(k, t.id, text));
              meter(L);
              meter(R);
              await sleep(300);
              await fold(prev);
              continue;
            }
            setStatus(R.st, `model: “${esc(text)}” continues turn ${prev.turn}<br>` +
              "→ nothing closed, ignore the card");
          }

          L.list.append(row(k, t.id, text));
          R.list.append(row(k, t.id, text));
          if (k === "a" && !TASKS[i + 1]?.cont && i < 2) {
            L.closed.add(t.id);
            R.closed.add(t.id);
          }
          meter(L);
          meter(R);
          await sleep(k === "u" ? 550 : 380);
          if (live(L).length >= 15 && !L.done) {
            L.done = true;
            await compact();
          }
        }
      }
      setStatus(R.st, "the open unit stays verbatim —<br>the model is still using it", "ok");
    },
  };

  // ---------- figure 2: the fold card, in a terminal ----------

  const card = {
    title: "Fig. 2 — the host asks, the model answers one call",
    async run(stage, sleep) {
      const term = h("div", "cf-term");
      stage.append(term);
      const cur = h("span", "cur");
      term.append(cur);
      const put = (html) => {
        const s = h("span", null, html);
        term.insertBefore(s, cur);
        return s;
      };
      const lines = [
        ['k', '<system-reminder>  ← attached to your next message by the host'],
        ['y', '[fold card] turns 1–4 since the last fold'],
        ['', '  163 tool calls · 1.9 MB · src/card.rs, docs/…'],
        ['', '  turn 1  you: “the card shows up every turn, fix that”'],
        ['', '  turn 2  you: “all of them need to be improved”'],
        ['', '  turn 3  you: “now write the design doc”'],
        ['', '  turn 4  you: “you decide, it\'s fine, go ahead”'],
        ['', '  Which of these is a closed unit? If one is, call'],
        ['', '  fold_unit(from, to). Otherwise ignore this.'],
        ['k', '</system-reminder>'],
      ];
      for (const [c, l] of lines) {
        put(`<span class="${c}">${esc(l)}</span>\n`);
        await sleep(110);
      }
      await sleep(700);
      put('\n<span class="m">●</span> ');
      const call = "fold_unit(from: 1, to: 2)";
      const s = put("");
      for (const ch of call) {
        s.textContent += ch;
        await sleep(45);
      }
      put("\n");
      await sleep(500);
      put('<span class="g">  folded turns 1-2 into fold#1 (…/893-fold-1.json)</span>\n');
      await sleep(250);
      put('<span class="g">  ledger 337 → 69 messages · ctx 2%</span>\n\n');
      await sleep(900);
      put('<span class="k">what the model reads now, in place of turns 1-2:</span>\n');
      await sleep(300);
      const res = [
        ['c', '[folded turns 1-2 · fold#1]'],
        ['', '  tools    bash ×116 · 30 others     <span class="k">← counted by the host</span>'],
        ['', '  paths    7 files touched            <span class="k">← counted</span>'],
        ['', '  you said turn 1: “…” turn 2: “…”   <span class="k">← copied verbatim</span>'],
        ['', '  closing  the model\'s own last message <span class="k">← already written</span>'],
        ['', '  original …/893-fold-1.json · sha256 <span class="k">← read it back with read/grep</span>'],
      ];
      for (const [c, l] of res) {
        put(`<span class="${c}">${l}</span>\n`);
        await sleep(260);
      }
      await sleep(400);
      put('\n<span class="y">  model calls to write this: 0</span>\n');
    },
  };

  // ---------- figure 3: a strategy is a stack frame, a subagent is another process ----------

  const stack = {
    title: "Fig. 3 — strategy: push a frame, return a value. subagent: a separate process",
    async run(stage, sleep, root) {
      const trio = h("div", "cf-trio");
      stage.append(trio);
      const col = (title) => {
        const c = h("div", "cf-col idle");
        c.append(h("div", "cf-col-h", title));
        const st = h("div", "cf-col-s");
        const list = h("div", "cf-list");
        c.append(st, list);
        trio.append(c);
        return { c, st, list };
      };
      const M = col("main loop");
      const E = col("errand (strategy)");
      const S = col("subagent (fresh child)");
      M.c.className = "cf-col live";
      const add = (C, kind, task, text, ms = 380) => {
        const r = row(kind, task, text);
        C.list.append(r);
        return sleep(ms).then(() => r);
      };
      const say = (C, html) => (C.st.innerHTML = html);

      const prefix = h("div", "cf-prefix",
        "system prompt + tool table<br>~20k tokens, cached prefix");
      M.list.append(prefix);
      say(M, "one conversation, one ledger");
      await sleep(500);
      await add(M, "u", "a", "wire the retry into the CLI");
      await add(M, "t", "a", "edit src/cli.rs");
      await add(M, "a", "a", "done, flag --retries");
      await add(M, "u", "c", "CI is flaky again, look into it", 600);

      say(M, "model: <b>strategy_request(errand)</b>");
      await sleep(700);
      E.c.className = "cf-col live";
      M.c.className = "cf-col";
      prefix.classList.add("hit");
      say(E, "frame pushed on top of main<br>its prefix is main's, byte for byte");
      E.list.append(h("div", "cf-ghost",
        "↑ everything in main<br>cache read, 0.1× price"));
      await sleep(700);
      E.list.append(h("div", "cf-snap",
        "errand rules, pinned at the tail:<br>this task only · report · yield"));
      await sleep(700);
      const report = h("div", "cf-report");
      E.c.append(report);
      await add(E, "t", "c", "gh run list --status failure");
      await add(E, "t", "c", "read ci-4121.log");
      await add(E, "t", "c", "grep -rn 8080 tests/");
      report.innerHTML = "<b>strategy_report</b><br>3 failures, all EADDRINUSE";
      report.classList.add("on");
      await sleep(600);
      await add(E, "t", "c", "read tests/common.rs");
      await add(E, "t", "c", "bash cargo test -- --test-threads 8");
      report.innerHTML = "<b>strategy_report</b><br>tests share port 8080;<br>fix: bind :0, read the port back";
      report.classList.remove("bump");
      report.getBoundingClientRect();
      report.classList.add("bump");
      await sleep(800);

      say(E, "<b>strategy_yield</b> → the branch folds away");
      await sleep(600);
      const erows = [...E.list.children];
      erows.forEach((e) => {
        e.style.transition = "opacity .5s, height .5s";
        e.style.opacity = "0";
      });
      const ret = row("a", "c", "↩ errand: port 8080 shared → bind :0");
      ret.style.visibility = "hidden";
      ret.style.animation = "none";
      M.list.append(ret);
      await fly(root, report, ret, sleep);
      report.classList.remove("on");
      erows.forEach((e) => e.remove());
      E.c.className = "cf-col idle";
      M.c.className = "cf-col live";
      prefix.classList.remove("hit");
      say(E, "frame popped · the branch folded,<br>1 result kept in main");
      say(M, "back in main: one line where the errand was");
      await sleep(900);

      await add(M, "u", "b", "fix it; check the other crates too", 600);
      say(M, "model: <b>subagent_request(evidence)</b>");
      await sleep(600);
      S.c.className = "cf-col live";
      say(S, "fresh child: sees only its brief<br>runs in the background");
      const brief = h("div", "cf-snap fresh",
        "brief: tests binding a fixed port<br>in crates/*; answer path:line");
      brief.style.visibility = "hidden";
      brief.style.animation = "none";
      S.list.append(brief);
      const src = M.list.lastElementChild;
      await fly(root, src, brief, sleep);
      say(M, "main keeps working meanwhile");

      // the two run side by side
      const sub = (async () => {
        await add(S, "t", "b", "grep -rn ':8080' crates/", 520);
        await add(S, "t", "b", "read crates/api/tests/srv.rs", 520);
        await add(S, "t", "b", "read crates/cli/tests/e2e.rs", 520);
        return add(S, "a", "b", "api/tests/srv.rs:31, cli/tests/e2e.rs:12", 600);
      })();
      await add(M, "t", "c", "edit tests/common.rs", 700);
      await add(M, "t", "c", "bash cargo test", 700);
      const done = await sub;

      const rc = row("a", "b", "↩ receipt s1: 2 more, api:31 cli:12");
      rc.style.visibility = "hidden";
      rc.style.animation = "none";
      M.list.append(rc);
      await fly(root, done, rc, sleep);
      say(S, "done · its tool calls stay in the child's transcript");
      S.c.className = "cf-col";
      say(M, "main holds conclusions, not the searching");
    },
  };

  // ---------- figure 4: evaluation ----------

  const FORMS = [
    { cls: "f1", hd: "task", goal: '"fix the flaky login test"',
      body: ["read", "read", "edit", "bash", "bash"], val: '"race in session setup, fixed"' },
    { cls: "f2", hd: "errand", goal: '"why is CI flaky?"',
      body: ["gh", "read", "grep", "read", "bash"], val: '"port 8080 shared; bind :0"' },
    { cls: "f3", hd: "subagent evidence", goal: '"other fixed ports?"',
      body: ["grep", "read", "read"], val: '"api:31, cli:12"' },
    { cls: "f4", hd: "task", goal: '"fix all three"',
      body: ["edit", "edit", "edit", "bash"], open: true },
  ];

  const sexp = {
    title: "Fig. 4 — a closed form is replaced by its value",
    async run(stage, sleep) {
      const pre = h("div", "cf-sexp");
      stage.append(pre);
      pre.append(h("span", null, "(session\n"));
      for (const f of FORMS) {
        const form = h("span", f.cls);
        form.append(h("span", null, "  ("));
        form.append(h("span", "hd", f.hd));
        form.append(h("span", "goal", " " + esc(f.goal)));
        const body = h("span", "body");
        const cl = h("span", "cl");
        const val = h("span", "val", f.val ? " ⇒ " + esc(f.val) : "");
        form.append(body, cl, val);
        pre.append(form, h("span", null, "\n"));
        await sleep(300);
        for (const tok of f.body) {
          body.textContent += " " + tok;
          await sleep(230);
        }
        if (f.open) {
          pre.lastChild.before(h("span", "cur"));
          break;
        }
        cl.textContent = ")";
        form.classList.add("closing");
        await sleep(900);
        form.classList.remove("closing");
        form.classList.add("ev");
        await sleep(1300);
      }
    },
  };

  const FIGS = { compare, card, stack, sexp };

  // ---------- mount ----------

  function mount(el) {
    const fig = FIGS[el.dataset.cf];
    if (!fig) return;
    const foot = el.innerHTML.trim();
    el.innerHTML = "";
    const cap = h("div", "cf-caption");
    cap.append(h("span", null, fig.title));
    const btn = h("button", "cf-btn", "▶ play");
    cap.append(btn);
    const stage = h("div");
    el.append(cap, stage);
    if (foot) el.append(h("div", "cf-foot", foot));

    let token = 0;
    const play = async (instant) => {
      const my = ++token;
      const sleep = (ms) =>
        new Promise((res, rej) =>
          setTimeout(() => (my === token ? res() : rej("stop")), instant ? 0 : ms)
        );
      el.querySelectorAll(".cf-fly").forEach((g) => g.remove());
      stage.innerHTML = "";
      el.classList.toggle("cf-instant", !!instant);
      try {
        await fig.run(stage, sleep, el);
      } catch (e) {
        if (e !== "stop") console.error(e);
      }
      if (my === token) {
        el.classList.remove("cf-instant");
        if (!instant) el.dataset.done = String(my); // lets a recorder know the run ended
      }
    };
    btn.onclick = () => {
      btn.textContent = "↻ replay";
      play(false);
    };
    play(true); // final frame, no motion

    if (!REDUCE && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) {
            io.disconnect();
            btn.textContent = "↻ replay";
            play(false);
          }
        },
        { threshold: 0.45 }
      );
      io.observe(el);
    }
  }

  const boot = () => document.querySelectorAll(".cf[data-cf]").forEach(mount);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
