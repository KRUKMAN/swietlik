# Świetlik — Render verification checklist

Tests and lint passing prove the **domain model** works. They prove nothing about whether the app renders, because Vue SFCs and WebGL are both out of scope for the Phase 0 test harness (see `/CLAUDE.md` §5). **This checklist is the only evidence that the app actually runs.** Work it before claiming any visual or integration change is done.

Runnable by hand, or by an agent driving Chrome (the Claude-in-Chrome tools, or any browser automation). The steps are written so either works.

---

## 0. Start

```bash
cd /c/dev/swietlik
npm start
```

Open <http://localhost:5173>.

> Reminder: the repo is at `C:\dev\swietlik`. The OneDrive folder contains only a pointer file.

---

## 1. Tab title

- [ ] The browser tab reads **`Świetlik`** (with the diacritics intact — a mojibake'd `Åšwietlik` means an encoding regression in `index.html`).

## 2. Splash popup

The splash appears on first load. Confirm all three:

- [ ] The **Świetlik wordmark** is shown (the textual logo SVG — *not* the old ASLS Studio logo).
- [ ] A **GPLv3 licence link** is present and points at the GNU licence text.
- [ ] The **upstream attribution** line is present: `based on ASLS Studio © ASLS-org 2021–2026`.

If any of these three is missing, stop — that is a licence-compliance failure, not a cosmetic one (see `/CLAUDE.md` §8).

Dismiss the splash to continue.

## 3. Default universe

- [ ] The **patch bay** shows a default universe already present (an empty show bootstraps with one). Fixtures cannot be patched without it.

## 4. Patch a fixture

- [ ] Add a fixture: manufacturer **Clay Paky**, model **Sharpy** (`public/fixtures/clay-paky/sharpy.json`).
- [ ] The fixture appears in the fixture list under the default universe with a DMX address.
- [ ] **The fixture appears in the 3D viewport** — a moving-head body is visible in the scene.

## 5. Produce a beam

- [ ] Select the patched Sharpy and set its **Dimmer** channel to **255**.
- [ ] **A visible beam is emitted** in the 3D viewport (the volumetric beam shader is doing its job).

If the fixture renders but no beam appears at full dimmer, that is a visualizer regression worth chasing — it is the single most load-bearing visual in the app.

## 6. Console — THIS IS THE PASS/FAIL GATE

- [ ] The browser devtools console shows **ZERO uncaught errors** across the whole run above.

**This is the gate, not pixel-perfection.** Rendering differences, layout nits, and shader tuning are judgement calls; an uncaught exception is not. Warnings (Vue compat deprecations, WSC connection failures with no gateway running) are expected and acceptable. Uncaught errors are a fail.

## 7. Autosave

After patching the fixture, in the console:

```js
localStorage.getItem('SWIETLIK_SHOWFILE')
```

- [ ] Returns a **non-null** JSON string.

Note: `Show` also read-migrates the upstream key `ASLS_STUDIO_SHOWFILE` on load, but only ever **writes** `SWIETLIK_SHOWFILE`. A null result here means autosave did not fire.

---

## Result

| # | Check | Pass |
| --- | --- | --- |
| 1 | Tab title `Świetlik` | ☐ |
| 2 | Splash: wordmark + GPLv3 link + ASLS attribution | ☐ |
| 3 | Default universe in patch bay | ☐ |
| 4 | Clay Paky Sharpy patched **and visible in 3D** | ☐ |
| 5 | Dimmer 255 → visible beam | ☐ |
| 6 | **Zero uncaught console errors** | ☐ |
| 7 | `SWIETLIK_SHOWFILE` non-null | ☐ |

Record the date, the branch, and anything that failed. A partial pass is a partial pass — say so rather than rounding up.
