// ui/ui.js — DOM overlay UI for the 3D monster-collecting game.
// Vanilla ESM, no frameworks. Each component renders into a `root` container,
// creates/removes its own child nodes, and never clobbers siblings.

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ELEMENT_COLORS = {
  ember: "#ff6b4a",
  tide: "#4aa8ff",
  verdant: "#5fce7a",
  gale: "#9fd0ff",
  stone: "#c9a06b",
  spark: "#ffd23f",
  frost: "#8ee7ff",
  umbra: "#9a7bd6",
  lumen: "#ffe59e",
};

/** Map an element string to its hex color (falls back to accent cyan). */
export function elementColor(el) {
  if (!el) return "#6ee7ff";
  return ELEMENT_COLORS[String(el).toLowerCase()] || "#6ee7ff";
}

// Baked UI icon assets (tools/bake-ui.mjs). Paths resolve relative to the page.
const UI_ICON_BASE = "../assets/textures/ui/";
const ELEMENT_SET = new Set(Object.keys(ELEMENT_COLORS));
function iconImg(src, cls) {
  return el("img", { class: cls, attrs: { src, alt: "", "aria-hidden": "true", draggable: "false" } });
}
export function elementIconEl(elm, cls = "ui-el-icon") {
  const key = String(elm || "").toLowerCase();
  if (!ELEMENT_SET.has(key)) return null;
  return iconImg(`${UI_ICON_BASE}elements/${key}.png`, cls);
}
function itemIconEl(id, cls = "ui-item-icon") {
  return iconImg(`${UI_ICON_BASE}items/${id}.png`, cls);
}
function categoryIconEl(cat, cls = "ui-cat-icon") {
  const key = String(cat || "").toLowerCase();
  if (!["physical", "special", "status"].includes(key)) return null;
  return iconImg(`${UI_ICON_BASE}cat/${key}.png`, cls);
}

/** Small DOM builder. */
function el(tag, opts = {}, ...children) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.html != null) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v != null) node.setAttribute(k, v);
    }
  }
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.on) {
    for (const [ev, fn] of Object.entries(opts.on)) node.addEventListener(ev, fn);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/** Build a colored type chip element (element icon + label). */
function typeChip(typeStr) {
  const c = elementColor(typeStr);
  const icon = elementIconEl(typeStr, "ui-typechip-icon");
  return el(
    "span",
    { class: "ui-typechip", style: { "--chip": c } },
    icon,
    el("span", { class: "ui-typechip-label", text: String(typeStr || "").toUpperCase() })
  );
}

function clamp01(n) {
  n = Number(n);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/* ------------------------------------------------------------------ */
/* TitleScreen                                                         */
/* ------------------------------------------------------------------ */

export class TitleScreen {
  constructor(root) {
    this.root = root;
    this.node = null;
  }

  /** show({hasSave}) -> Promise<"new"|"continue"> */
  show({ hasSave = false } = {}) {
    this._teardown();
    return new Promise((resolve) => {
      const finish = (val) => {
        this._teardown();
        resolve(val);
      };

      const newBtn = el("button", {
        class: "ui-title-btn ui-title-btn--primary",
        text: "New Game",
        on: { click: () => finish("new") },
      });

      const contBtn = el("button", {
        class: "ui-title-btn",
        text: "Continue",
        attrs: hasSave ? null : { disabled: "" },
        on: { click: () => hasSave && finish("continue") },
      });

      this.node = el(
        "div",
        { class: "ui-overlay ui-title" },
        el(
          "div",
          { class: "ui-title-glow" }
        ),
        el(
          "div",
          { class: "ui-title-inner" },
          el("div", { class: "ui-title-eyebrow", text: "A Resonance Awaits" }),
          el("h1", { class: "ui-title-name", html: 'Kin<span>bound</span>' }),
          el("p", { class: "ui-title-tag", text: "Collect. Resonate. Ascend." }),
          el("div", { class: "ui-title-actions" }, contBtn, newBtn)
        )
      );

      this._keyHandler = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (hasSave) finish("continue");
          else finish("new");
        }
      };
      window.addEventListener("keydown", this._keyHandler);
      this.root.appendChild(this.node);
      // trigger entrance transition
      requestAnimationFrame(() => this.node && this.node.classList.add("is-in"));
    });
  }

  _teardown() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    this.node = null;
  }
}

/* ------------------------------------------------------------------ */
/* StarterSelect                                                       */
/* ------------------------------------------------------------------ */

export class StarterSelect {
  constructor(root) {
    this.root = root;
    this.node = null;
  }

  /** choose(species[]) -> Promise<speciesId> */
  choose(species = []) {
    this._teardown();
    return new Promise((resolve) => {
      const finish = (id) => {
        this._teardown();
        resolve(id);
      };

      const cards = species.map((sp, i) => {
        const types = Array.isArray(sp.types) ? sp.types : [];
        const primary = elementColor(types[0]);
        return el(
          "div",
          {
            class: "ui-starter-card",
            style: { "--accent": primary, "--delay": `${i * 90}ms` },
            attrs: { tabindex: "0", role: "button" },
            on: {
              click: () => finish(sp.id),
              keydown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  finish(sp.id);
                }
              },
            },
          },
          el(
            "div",
            { class: "ui-starter-types" },
            ...types.map((t) => typeChip(t))
          ),
          el("h3", { class: "ui-starter-name", text: sp.name || sp.id }),
          el("p", { class: "ui-starter-lore", text: sp.lore || "" }),
          el("div", { class: "ui-starter-pick", text: "Choose" })
        );
      });

      this.node = el(
        "div",
        { class: "ui-overlay ui-starter" },
        el(
          "div",
          { class: "ui-starter-head" },
          el("div", { class: "ui-title-eyebrow", text: "Choose your first Kin" }),
          el("h2", { class: "ui-starter-title", text: "A bond begins" })
        ),
        el("div", { class: "ui-starter-cards" }, ...cards)
      );

      this.root.appendChild(this.node);
      requestAnimationFrame(() => this.node && this.node.classList.add("is-in"));
    });
  }

  _teardown() {
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    this.node = null;
  }
}

/* ------------------------------------------------------------------ */
/* Dialogue                                                            */
/* ------------------------------------------------------------------ */

export class Dialogue {
  constructor(root) {
    this.root = root;
    this.node = null;
  }

  /** say(speaker, text) -> Promise<void> (click / Space / Enter advances) */
  say(speaker, text) {
    this._teardown();
    text = text == null ? "" : String(text);
    return new Promise((resolve) => {
      let done = false;
      let idx = 0;
      let timer = null;

      const textNode = el("div", { class: "ui-dlg-text" });
      const cursor = el("span", { class: "ui-dlg-cursor", text: "▸" });

      const complete = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        textNode.textContent = text;
        idx = text.length;
        this.node && this.node.classList.add("is-complete");
      };

      const finish = () => {
        if (done) return;
        done = true;
        this._teardown();
        resolve();
      };

      const advance = () => {
        if (idx < text.length) complete();
        else finish();
      };

      this._keyHandler = (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      };

      this.node = el(
        "div",
        { class: "ui-dlg", on: { click: advance } },
        el(
          "div",
          { class: "ui-dlg-box" },
          speaker
            ? el("div", { class: "ui-dlg-speaker", text: speaker })
            : null,
          textNode,
          el("div", { class: "ui-dlg-hint" }, cursor)
        )
      );

      window.addEventListener("keydown", this._keyHandler);
      this.root.appendChild(this.node);
      requestAnimationFrame(() => this.node && this.node.classList.add("is-in"));

      // Typewriter reveal.
      timer = setInterval(() => {
        idx++;
        textNode.textContent = text.slice(0, idx);
        if (idx >= text.length) {
          clearInterval(timer);
          timer = null;
          this.node && this.node.classList.add("is-complete");
        }
      }, 18);
      this._timer = timer;
    });
  }

  _teardown() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    this.node = null;
  }
}

/* ------------------------------------------------------------------ */
/* BattleHUD                                                           */
/* ------------------------------------------------------------------ */

export class BattleHUD {
  constructor(root) {
    this.root = root;
    this.playerKin = null;
    this.enemyKin = null;

    this.node = el("div", { class: "ui-battle" });
    this.statusLayer = el("div", { class: "ui-battle-status" });
    this.logEl = el("div", { class: "ui-battle-log", attrs: { role: "log" } });
    this.menuLayer = el("div", { class: "ui-battle-menu" });

    this.node.appendChild(this.statusLayer);
    this.node.appendChild(this.logEl);
    this.node.appendChild(this.menuLayer);
    this.root.appendChild(this.node);

    this._refs = { player: null, enemy: null };
    this._actionResolver = null;
    this._keyHandler = null;
  }

  /** setActors(playerKin, enemyKin): build two status panels. */
  setActors(playerKin, enemyKin) {
    this.playerKin = playerKin;
    this.enemyKin = enemyKin;
    this.statusLayer.textContent = "";
    this._refs.enemy = this._buildStatusPanel(enemyKin, false);
    this._refs.player = this._buildStatusPanel(playerKin, true);
    this.statusLayer.appendChild(this._refs.enemy.panel);
    this.statusLayer.appendChild(this._refs.player.panel);
    this.refresh();
  }

  _buildStatusPanel(kin, isPlayer) {
    const k = kin || {};
    const types = Array.isArray(k.types) ? k.types : [];

    const nameEl = el("span", { class: "ui-st-name", text: k.nickname || k.name || "???" });
    const lvEl = el("span", { class: "ui-st-lv", text: `Lv ${k.level ?? "?"}` });
    const typesEl = el("div", { class: "ui-st-types" }, ...types.map((t) => typeChip(t)));
    const statusEl = el("span", { class: "ui-st-status" });

    const hpFill = el("div", { class: "ui-bar-fill ui-bar-fill--hp" });
    const hpNum = el("span", { class: "ui-bar-num" });
    const hpBar = el(
      "div",
      { class: "ui-bar" },
      el("span", { class: "ui-bar-label", text: "HP" }),
      el("div", { class: "ui-bar-track" }, hpFill),
      hpNum
    );

    const panelChildren = [
      el(
        "div",
        { class: "ui-st-head" },
        nameEl,
        lvEl,
        statusEl
      ),
      typesEl,
      hpBar,
    ];

    const refs = { hpFill, hpNum, nameEl, lvEl, statusEl };

    if (isPlayer) {
      const syncFill = el("div", { class: "ui-bar-fill ui-bar-fill--sync" });
      const syncNum = el("span", { class: "ui-bar-num" });
      const syncBar = el(
        "div",
        { class: "ui-bar" },
        el("span", { class: "ui-bar-label", text: "Sync" }),
        el("div", { class: "ui-bar-track" }, syncFill),
        syncNum
      );
      const resoEl = el("div", { class: "ui-st-reso" });
      panelChildren.push(syncBar, resoEl);
      refs.syncFill = syncFill;
      refs.syncNum = syncNum;
      refs.resoEl = resoEl;
    }

    const panel = el(
      "div",
      { class: `ui-st-panel ${isPlayer ? "ui-st-panel--player" : "ui-st-panel--enemy"}` },
      ...panelChildren
    );

    refs.panel = panel;
    return refs;
  }

  _applyKin(refs, kin, isPlayer) {
    if (!refs || !kin) return;
    refs.nameEl.textContent = kin.nickname || kin.name || "???";
    refs.lvEl.textContent = `Lv ${kin.level ?? "?"}`;

    const cur = Number(kin.currentHp ?? 0);
    const max = Number(kin.maxHp ?? 1) || 1;
    const frac = clamp01(cur / max);
    refs.hpFill.style.width = `${frac * 100}%`;
    refs.hpFill.classList.toggle("is-low", frac <= 0.25);
    refs.hpFill.classList.toggle("is-mid", frac > 0.25 && frac <= 0.5);
    refs.hpNum.textContent = `${Math.max(0, Math.round(cur))}/${Math.round(max)}`;

    if (kin.status) {
      refs.statusEl.textContent = kin.status;
      refs.statusEl.style.display = "";
    } else {
      refs.statusEl.textContent = "";
      refs.statusEl.style.display = "none";
    }

    if (isPlayer && refs.syncFill) {
      const sync = clamp01(Number(kin.sync ?? 0) / 100);
      refs.syncFill.style.width = `${sync * 100}%`;
      refs.syncNum.textContent = `${Math.round(Number(kin.sync ?? 0))}`;
      const reso = kin.resonance != null ? kin.resonance : "-";
      const temp = kin.temperamentLabel || "";
      refs.resoEl.textContent = "";
      refs.resoEl.appendChild(el("span", { class: "ui-st-reso-val", text: `Resonance ${reso}` }));
      if (temp) refs.resoEl.appendChild(el("span", { class: "ui-st-reso-temp", text: temp }));
    }
  }

  /** refresh(): re-read kin values into bars (smooth via CSS transitions). */
  refresh() {
    this._applyKin(this._refs.player, this.playerKin, true);
    this._applyKin(this._refs.enemy, this.enemyKin, false);
  }

  /** log(text): append a line to the scrollable battle log (keeps last ~40). */
  log(text) {
    const line = el("div", { class: "ui-log-line", text: String(text == null ? "" : text) });
    this.logEl.appendChild(line);
    while (this.logEl.childNodes.length > 40) {
      this.logEl.removeChild(this.logEl.firstChild);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  /**
   * chooseAction({moves, canCatch, canFlee, party, bag}) -> Promise<action>
   */
  chooseAction({ moves = [], canCatch = false, canFlee = false, party = [], bag = [] } = {}) {
    this._clearMenu();
    return new Promise((resolve) => {
      const finish = (action) => {
        this._clearMenu();
        this._actionResolver = null;
        resolve(action);
      };
      this._actionResolver = finish;

      const showTop = () => {
        this.menuLayer.textContent = "";
        const grid = el("div", { class: "ui-cmd-grid" });

        grid.appendChild(this._cmdButton("Fight", "fight", () => showMoves()));
        grid.appendChild(this._cmdButton("Party", "party", () => showParty()));
        grid.appendChild(this._cmdButton("Bag", "bag", () => showBag()));
        if (canCatch) grid.appendChild(this._cmdButton("Catch", "catch", () => showBag(true)));
        if (canFlee)
          grid.appendChild(this._cmdButton("Run", "run", () => finish({ kind: "flee" })));

        this.menuLayer.appendChild(grid);
      };

      const withBack = (panel) => {
        const wrap = el("div", { class: "ui-submenu" });
        wrap.appendChild(panel);
        wrap.appendChild(
          el("button", {
            class: "ui-back-btn",
            text: "← Back",
            on: { click: showTop },
          })
        );
        this.menuLayer.textContent = "";
        this.menuLayer.appendChild(wrap);
      };

      const showMoves = () => {
        const list = el("div", { class: "ui-move-list" });
        if (!moves.length) {
          list.appendChild(el("div", { class: "ui-empty", text: "No moves." }));
        }
        moves.forEach((m, i) => {
          const isArt = !!m.isResonanceArt;
          const notReady = isArt && !m.ready;
          const chip = typeChip(m.type);
          const btn = el(
            "button",
            {
              class: `ui-move ${isArt ? "ui-move--art" : ""} ${notReady ? "is-disabled" : ""}`,
              style: { "--accent": elementColor(m.type) },
              attrs: notReady ? { disabled: "" } : { "data-idx": String(i + 1) },
              on: {
                click: () => !notReady && finish({ kind: "move", moveId: m.id }),
              },
            },
            el(
              "div",
              { class: "ui-move-top" },
              el(
                "span",
                { class: "ui-move-name" },
                categoryIconEl(m.category),
                isArt ? el("span", { class: "ui-move-art", text: "✦ " }) : null,
                document.createTextNode(m.name || m.id)
              ),
              chip
            ),
            el(
              "div",
              { class: "ui-move-meta" },
              el("span", { text: `PW ${m.power ?? "—"}` }),
              el("span", { text: `AC ${m.accuracy ?? "—"}` }),
              isArt
                ? el("span", {
                    class: notReady ? "ui-move-art-tag is-wait" : "ui-move-art-tag is-ready",
                    text: notReady ? `Sync ${m.syncCost ?? ""}` : "Ready",
                  })
                : null,
              el("span", { class: "ui-move-key", text: i < 4 ? String(i + 1) : "" })
            )
          );
          list.appendChild(btn);
        });
        withBack(list);
      };

      const showParty = () => {
        const list = el("div", { class: "ui-switch-list" });
        if (!party.length) list.appendChild(el("div", { class: "ui-empty", text: "No allies." }));
        party.forEach((p, i) => {
          const fainted = Number(p.currentHp ?? 0) <= 0;
          const active = !!p.isActive || p === this.playerKin;
          const disabled = fainted || active;
          const cur = Number(p.currentHp ?? 0);
          const max = Number(p.maxHp ?? 1) || 1;
          const frac = clamp01(cur / max);
          const btn = el(
            "button",
            {
              class: `ui-switch ${disabled ? "is-disabled" : ""} ${fainted ? "is-fainted" : ""}`,
              attrs: disabled ? { disabled: "" } : null,
              on: { click: () => !disabled && finish({ kind: "switch", switchIndex: i }) },
            },
            el(
              "div",
              { class: "ui-switch-head" },
              el("span", { class: "ui-switch-name", text: p.nickname || p.name || "???" }),
              el("span", { class: "ui-switch-lv", text: `Lv ${p.level ?? "?"}` }),
              active ? el("span", { class: "ui-switch-tag", text: "Active" }) : null,
              fainted ? el("span", { class: "ui-switch-tag is-fainted", text: "Fainted" }) : null
            ),
            el(
              "div",
              { class: "ui-bar ui-bar--mini" },
              el(
                "div",
                { class: "ui-bar-track" },
                el("div", {
                  class: "ui-bar-fill ui-bar-fill--hp",
                  style: { width: `${frac * 100}%` },
                })
              ),
              el("span", { class: "ui-bar-num", text: `${Math.max(0, Math.round(cur))}/${Math.round(max)}` })
            )
          );
          list.appendChild(btn);
        });
        withBack(list);
      };

      const showBag = (catchOnly = false) => {
        const list = el("div", { class: "ui-bag-list" });
        const items = bag.filter((b) => (catchOnly ? isResonator(b.id) : true));
        if (!items.length) {
          list.appendChild(el("div", { class: "ui-empty", text: catchOnly ? "No resonators." : "Bag is empty." }));
        }
        items.forEach((it) => {
          const resonator = isResonator(it.id);
          const btn = el(
            "button",
            {
              class: `ui-item ${resonator ? "ui-item--catch" : ""}`,
              on: {
                click: () =>
                  finish(
                    resonator
                      ? { kind: "catch", itemId: it.id }
                      : { kind: "item", itemId: it.id }
                  ),
              },
            },
            itemIconEl(it.id),
            el("span", { class: "ui-item-name", text: it.name || it.id }),
            el("span", { class: "ui-item-count", text: `x${it.count ?? 0}` })
          );
          list.appendChild(btn);
        });
        withBack(list);
      };

      // number-key move selection (1-4) when on the top menu / anywhere
      this._keyHandler = (e) => {
        if (e.key >= "1" && e.key <= "4") {
          const btn = this.menuLayer.querySelector(`.ui-move[data-idx="${e.key}"]`);
          if (btn && !btn.disabled) {
            e.preventDefault();
            btn.click();
          }
        }
      };
      window.addEventListener("keydown", this._keyHandler);

      showTop();
    });
  }

  _cmdButton(label, kind, onClick) {
    return el("button", {
      class: `ui-cmd ui-cmd--${kind}`,
      text: label,
      on: { click: onClick },
    });
  }

  _clearMenu() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
    this.menuLayer.textContent = "";
  }

  hide() {
    this._clearMenu();
    if (this._actionResolver) {
      // resolve any pending action defensively so callers don't hang.
      const r = this._actionResolver;
      this._actionResolver = null;
      r({ kind: "flee" });
    }
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
  }
}

function isResonator(id) {
  if (!id) return false;
  const s = String(id).toLowerCase();
  return s.includes("resonator") || s.includes("core") || s.includes("prism") || s.includes("ball");
}

/* ------------------------------------------------------------------ */
/* HUD — persistent overworld overlay (region, party, side menu,       */
/* continuous-story Continue prompt)                                   */
/* ------------------------------------------------------------------ */

export class HUD {
  constructor(root) {
    this.root = root;
    this._cbs = {};
    this._continueResolver = null;

    this.regionEl = el("span", { class: "ui-hud-region", text: "" });
    this.sealEl = el("span", { class: "ui-hud-seals", text: "" });
    this.topbar = el(
      "div",
      { class: "ui-hud-top" },
      el("span", { class: "ui-hud-rune", text: "◈" }),
      this.regionEl,
      this.sealEl
    );

    this.partyEl = el("div", { class: "ui-hud-party" });

    this.exploreBtn = this._menuBtn("Explore", "explore", () => this._cbs.onExplore && this._cbs.onExplore());
    this.menuEl = el(
      "div",
      { class: "ui-hud-menu" },
      this.exploreBtn,
      this._menuBtn("Party", "party", () => this._cbs.onParty && this._cbs.onParty()),
      this._menuBtn("Bag", "bag", () => this._cbs.onBag && this._cbs.onBag()),
      this._menuBtn("Save", "save", () => this._cbs.onSave && this._cbs.onSave())
    );

    this.beatEl = el("span", { class: "ui-hud-beat-text", text: "" });
    this.continueBtn = el("button", {
      class: "ui-hud-continue",
      on: { click: () => this._resolveContinue() },
    }, el("span", { text: "Continue" }), el("span", { class: "ui-hud-continue-arrow", text: "▶" }));
    this.continueWrap = el("div", { class: "ui-hud-continuewrap is-hidden" }, this.beatEl, this.continueBtn);

    this.node = el("div", { class: "ui-hud is-hidden" }, this.topbar, this.partyEl, this.menuEl, this.continueWrap);
    this.root.appendChild(this.node);

    this._keyHandler = (e) => {
      if (!this._continueResolver) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._resolveContinue(); }
    };
    window.addEventListener("keydown", this._keyHandler);
  }

  _menuBtn(label, kind, onClick) {
    return el(
      "button",
      { class: `ui-hud-btn ui-hud-btn--${kind}`, attrs: { "data-k": kind }, on: { click: onClick } },
      el("span", { class: "ui-hud-btn-ico", text: MENU_GLYPH[kind] || "•" }),
      el("span", { class: "ui-hud-btn-label", text: label })
    );
  }

  bind(cbs = {}) { this._cbs = cbs; }

  show() { this.node.classList.remove("is-hidden"); }
  hide() { this.node.classList.add("is-hidden"); }

  update({ regionName = "", party = [], seals = 0, canExplore = true } = {}) {
    this.regionEl.textContent = regionName;
    this.sealEl.textContent = seals ? `✦ ${seals}` : "";
    this.exploreBtn.classList.toggle("is-disabled", !canExplore);
    this.exploreBtn.disabled = !canExplore;

    this.partyEl.textContent = "";
    (Array.isArray(party) ? party : []).forEach((k) => {
      const cur = Number(k.currentHp ?? 0), max = Number(k.maxHp ?? 1) || 1;
      const frac = clamp01(cur / max);
      const fainted = cur <= 0;
      const color = elementColor((k.types || [])[0]);
      const pip = el(
        "div",
        { class: `ui-hud-pip ${fainted ? "is-fainted" : ""}`, style: { "--accent": color }, attrs: { title: `${k.nickname || k.name || "?"} · Lv ${k.level ?? "?"}` } },
        el("div", { class: "ui-hud-pip-orb" }, elementIconEl((k.types || [])[0], "ui-hud-pip-ico")),
        el("div", { class: "ui-hud-pip-bar" }, el("div", { class: "ui-hud-pip-fill", style: { width: `${frac * 100}%` } }))
      );
      this.partyEl.appendChild(pip);
    });
  }

  // Show the Continue prompt and wait for the player. Side-menu actions remain
  // usable while waiting (they resolve their own overlays independently).
  interlude({ nextBeat = "" } = {}) {
    this.beatEl.textContent = nextBeat ? `Next: ${nextBeat}` : "";
    this.continueWrap.classList.remove("is-hidden");
    return new Promise((resolve) => { this._continueResolver = resolve; });
  }

  _resolveContinue() {
    const r = this._continueResolver;
    this._continueResolver = null;
    this.continueWrap.classList.add("is-hidden");
    if (r) r("continue");
  }
}

const MENU_GLYPH = { explore: "⚑", party: "♥", bag: "🎒", save: "💾", map: "🗺" };

/* ------------------------------------------------------------------ */
/* BagScreen — standalone bag viewer (overworld)                       */
/* ------------------------------------------------------------------ */

export class BagScreen {
  constructor(root) {
    this.root = root;
    this.node = null;
  }
  show(bag = []) {
    this._teardown();
    return new Promise((resolve) => {
      const finish = () => { this._teardown(); resolve(); };
      const items = Array.isArray(bag) ? bag : [];
      const rows = items.length
        ? items.map((it) =>
            el(
              "div",
              { class: "ui-item ui-item--static" },
              itemIconEl(it.id),
              el("span", { class: "ui-item-name", text: it.name || it.id }),
              el("span", { class: "ui-item-count", text: `x${it.count ?? 0}` })
            )
          )
        : [el("div", { class: "ui-empty", text: "Bag is empty." })];
      this.node = el(
        "div",
        { class: "ui-overlay ui-party" },
        el(
          "div",
          { class: "ui-party-panel" },
          el(
            "div",
            { class: "ui-party-topbar" },
            el("h2", { class: "ui-party-title", text: "Bag" }),
            el("button", { class: "ui-close-btn", text: "✕", on: { click: finish } })
          ),
          el("div", { class: "ui-bag-list ui-bag-list--grid" }, ...rows)
        )
      );
      this._keyHandler = (e) => { if (e.key === "Escape") { e.preventDefault(); finish(); } };
      window.addEventListener("keydown", this._keyHandler);
      this.root.appendChild(this.node);
      requestAnimationFrame(() => this.node && this.node.classList.add("is-in"));
    });
  }
  _teardown() {
    if (this._keyHandler) { window.removeEventListener("keydown", this._keyHandler); this._keyHandler = null; }
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    this.node = null;
  }
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

export class Toast {
  constructor(root) {
    this.root = root;
    this.stack = el("div", { class: "ui-toast-stack" });
    this.root.appendChild(this.stack);
  }

  /** show(text, ms=1800) */
  show(text, ms = 1800) {
    const t = el("div", { class: "ui-toast", text: String(text == null ? "" : text) });
    this.stack.appendChild(t);
    requestAnimationFrame(() => t.classList.add("is-in"));
    const remove = () => {
      t.classList.remove("is-in");
      t.classList.add("is-out");
      setTimeout(() => {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 320);
    };
    setTimeout(remove, Math.max(400, ms));
    return t;
  }
}

/* ------------------------------------------------------------------ */
/* RegionMap                                                           */
/* ------------------------------------------------------------------ */

export class RegionMap {
  constructor(root) {
    this.root = root;
    this.node = null;
  }

  /** show({regionName, canExplore, nextBeat, seals}) -> Promise<string> */
  show({ regionName = "Unknown Region", canExplore = true, nextBeat = "", seals = [] } = {}) {
    this._teardown();
    return new Promise((resolve) => {
      const finish = (val) => {
        this._teardown();
        resolve(val);
      };

      const sealNodes = (Array.isArray(seals) ? seals : []).map((s) => {
        const label = typeof s === "string" ? s : s && (s.name || s.id) ? (s.name || s.id) : "Seal";
        const done = typeof s === "object" && s ? !!(s.cleared || s.done || s.unlocked) : false;
        return el(
          "div",
          { class: `ui-seal ${done ? "is-cleared" : ""}` },
          el("span", { class: "ui-seal-dot" }),
          el("span", { class: "ui-seal-name", text: label })
        );
      });

      const actions = el(
        "div",
        { class: "ui-map-actions" },
        this._mapBtn("Explore", "explore", canExplore, () => finish("explore")),
        this._mapBtn("Story", "story", true, () => finish("story")),
        this._mapBtn("Party", "party", true, () => finish("party")),
        this._mapBtn("Save", "save", true, () => finish("save")),
        this._mapBtn("Menu", "menu", true, () => finish("menu"))
      );

      this.node = el(
        "div",
        { class: "ui-overlay ui-map" },
        el(
          "div",
          { class: "ui-map-panel" },
          el("div", { class: "ui-title-eyebrow", text: "Region" }),
          el("h2", { class: "ui-map-title", text: regionName }),
          nextBeat
            ? el(
                "div",
                { class: "ui-map-beat" },
                el("span", { class: "ui-map-beat-label", text: "Next" }),
                el("span", { class: "ui-map-beat-text", text: nextBeat })
              )
            : null,
          sealNodes.length
            ? el(
                "div",
                { class: "ui-map-seals" },
                el("div", { class: "ui-map-seals-label", text: "Seals" }),
                el("div", { class: "ui-seal-list" }, ...sealNodes)
              )
            : null,
          actions
        )
      );

      this.root.appendChild(this.node);
      requestAnimationFrame(() => this.node && this.node.classList.add("is-in"));
    });
  }

  _mapBtn(label, val, enabled, onClick) {
    return el("button", {
      class: `ui-map-btn ui-map-btn--${val} ${enabled ? "" : "is-disabled"}`,
      text: label,
      attrs: enabled ? null : { disabled: "" },
      on: { click: () => enabled && onClick() },
    });
  }

  _teardown() {
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    this.node = null;
  }
}

/* ------------------------------------------------------------------ */
/* PartyScreen                                                         */
/* ------------------------------------------------------------------ */

export class PartyScreen {
  constructor(root) {
    this.root = root;
    this.node = null;
  }

  /** show(party) -> Promise<void> (resolves on close) */
  show(party = []) {
    this._teardown();
    return new Promise((resolve) => {
      const finish = () => {
        this._teardown();
        resolve();
      };

      const cards = (Array.isArray(party) ? party : []).map((k) => {
        const types = Array.isArray(k.types) ? k.types : [];
        const cur = Number(k.currentHp ?? 0);
        const max = Number(k.maxHp ?? 1) || 1;
        const frac = clamp01(cur / max);
        const sync = clamp01(Number(k.sync ?? 0) / 100);
        const fainted = cur <= 0;
        return el(
          "div",
          {
            class: `ui-party-card ${fainted ? "is-fainted" : ""}`,
            style: { "--accent": elementColor(types[0]) },
          },
          el(
            "div",
            { class: "ui-party-head" },
            el("span", { class: "ui-party-name", text: k.nickname || k.name || "???" }),
            el("span", { class: "ui-party-lv", text: `Lv ${k.level ?? "?"}` })
          ),
          el("div", { class: "ui-party-types" }, ...types.map((t) => typeChip(t))),
          el(
            "div",
            { class: "ui-bar" },
            el("span", { class: "ui-bar-label", text: "HP" }),
            el(
              "div",
              { class: "ui-bar-track" },
              el("div", { class: "ui-bar-fill ui-bar-fill--hp", style: { width: `${frac * 100}%` } })
            ),
            el("span", { class: "ui-bar-num", text: `${Math.max(0, Math.round(cur))}/${Math.round(max)}` })
          ),
          el(
            "div",
            { class: "ui-bar" },
            el("span", { class: "ui-bar-label", text: "Sync" }),
            el(
              "div",
              { class: "ui-bar-track" },
              el("div", { class: "ui-bar-fill ui-bar-fill--sync", style: { width: `${sync * 100}%` } })
            ),
            el("span", { class: "ui-bar-num", text: `${Math.round(Number(k.sync ?? 0))}` })
          ),
          el(
            "div",
            { class: "ui-party-reso" },
            el("span", { text: `Resonance ${k.resonance != null ? k.resonance : "-"}` }),
            k.temperamentLabel ? el("span", { class: "ui-party-temp", text: k.temperamentLabel }) : null,
            k.status ? el("span", { class: "ui-party-status", text: k.status }) : null
          )
        );
      });

      this.node = el(
        "div",
        { class: "ui-overlay ui-party" },
        el(
          "div",
          { class: "ui-party-panel" },
          el(
            "div",
            { class: "ui-party-topbar" },
            el("h2", { class: "ui-party-title", text: "Party" }),
            el("button", { class: "ui-close-btn", text: "✕", on: { click: finish } })
          ),
          cards.length
            ? el("div", { class: "ui-party-grid" }, ...cards)
            : el("div", { class: "ui-empty", text: "Your party is empty." })
        )
      );

      this._keyHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish();
        }
      };
      window.addEventListener("keydown", this._keyHandler);
      this.root.appendChild(this.node);
      requestAnimationFrame(() => this.node && this.node.classList.add("is-in"));
    });
  }

  _teardown() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
    if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    this.node = null;
  }
}
