# Świetlik — Upstream divergence ledger

Every upstream file this fork has **edited or deleted**, with a one-line reason. Additive files (new modules, tests, config) carry no merge debt and are listed separately at the end for completeness.

**Regenerate the raw list with:**

```bash
git diff develop...HEAD --name-status
```

`develop` is the pristine `ASLS-org/studio` mirror, so this diff *is* the fork's divergence. Keep this file in sync — **any new upstream edit must be added here in the same change that makes it** (see `/CLAUDE.md` §2).

- **Scope of this snapshot:** Phase 0 (branch `phase-0-foundation`)
- **Totals:** 52 files changed, +5337 / −5954 (of which `package-lock.json` alone is +1298/−5597 churn from the dependency bump and package rename)

---

## Modified upstream files (23)

### Root / config

| File | Reason |
| --- | --- |
| `package.json` | Rebrand (`name`, `author`, `contributors` crediting Timé Kadel); added `test` / `test:run` / `lint:ci` scripts; `@asls/wsc-*` `^2.0.5` → `^2.2.0`; added `vitest` + `jsdom`; dropped `semantic-release` and its `release` block (upstream's release pipeline is not ours). |
| `package-lock.json` | Regenerated for the dependency changes above. |
| `.env` | `WSC_VERSION` `2.2.0-rc.6` → `2.2.0`, aligning the Electron prebuild download with the bumped `@asls/wsc-*` packages. |
| `index.html` | Tab title → `Świetlik`; favicon repointed to `/images/swietlik_logo.svg`. |
| `.eslintrc.js` | Resolver settings so `lint:ci` reaches 0 errors: ignore `?worker`/`?raw` Vite query imports in `import/no-unresolved`, add three's extensionless `three/examples/jsm/*` paths to `import/core-modules`, add a node resolver fallback. |
| `.gitignore` | One added line: `.vite-start.log`, the dev-server log written when Vite is started in the background. (Logged retroactively — found by `.claude/scripts/check-upstream-ledger.mjs` on its first run.) |

### Documentation / attribution

| File | Reason |
| --- | --- |
| `README.md` | Full rewrite for the fork (172 lines changed) — retains the ASLS Studio / Timé Kadel attribution and GPL-3.0 notice as a licence requirement. |
| `CREDITS.html` | Prepended an "Upstream Project" block crediting ASLS Studio, Timé Kadel and ASLS-org under GPL-3.0. Additive to the existing third-party credits. |
| `docs/developer/core/docma.json` | Docs title `ASLS Studio - Core` → `Świetlik - Core`. |
| `docs/developer/ui/.storybook/theme.asls.js` | Storybook `brandTitle` → `Świetlik storybook`, `brandUrl` → this repo. Filename left as-is (see intentional references below). |
| `docs/manual/.vitepress/config.js` | Manual title/siteTitle/footer/social+download links rebranded to Świetlik and this repo. |
| `docs/manual/introduction/installation.md` | Logo image repointed to `swietlik_logo_textual.svg` (the upstream SVG was deleted, so the reference had to move). |
| `public/fixtures/README.md` | Retitled the example directory tree from `ASLS_STUDIO` to `swietlik`. |

### Electron (out of scope, but had to compile)

| File | Reason |
| --- | --- |
| `src/electron/main.js` | Icon import repointed to `swietlik_standalone_logo.svg`; removed an unused `Menu` import flagged by lint. |
| `src/electron/electron-builder.yml` | `appId` → `digital.rundown.swietlik`, `productName` → `Świetlik`, win `executableName` → `Swietlik`. |

### Application source

| File | Reason |
| --- | --- |
| `src/models/DMX/show.model.js` | localStorage key migration: writes `SWIETLIK_SHOWFILE`, falls back to reading upstream's `ASLS_STUDIO_SHOWFILE` so existing autosaves on `localhost:5173` still load. Also: `loadFromLocalStorage` now treats an empty/whitespace-only value as absent (was `??`, which never falls through on `''`) and wraps the parse+load in try/catch that returns `false` instead of throwing uncaught — fixes code-review-2026-09-09.md §1.1/§5.1 (app hangs on load). |
| `src/models/DMX/universe.model.js` | `checkPatchCapability` rewritten from a dead `Array#forEach` (`return false` inside it was a no-op, so the function always returned `true` and patch-collision detection never fired) to a short-circuiting `.every`, plus an explicit 512-address range check — fixes code-review-2026-09-09.md §2.2/§5.2. |
| `src/models/DMX/fixture.model.js` (incl. `chCount` getter) | `setChannel` now throws a descriptive `Invalid channel id ${id} for fixture ${this.name}` error for an out-of-range/non-integer channel id instead of an opaque `TypeError` from indexing `undefined` — fixes code-review-2026-09-09.md §2.3/§5.3. |
| `src/models/DMX/cue.item.model.js` | `fadeOut` setter fixed to assign `this._fadeOut` (it was assigning `this._fadeIn`, clobbering `fadeIn` and making `fadeOut` permanently unreadable) — fixes code-review-2026-09-09.md §2.1/§5.5. |
| `src/models/DMX/cue.pool.model.js` | `genCueId` reduced over `this.chases` (copy-paste from ChasePool) — threw on any `addCue` without an explicit id; fixed to `this.cues`. Found by Task 3 agent; regression test `test/models/cuePool.spec.js`. |
| `src/views/activities/app/_popups/popup.splash.vue` | Branding: Świetlik wordmark, release/branch links repointed to `KRUKMAN/swietlik`, copyright line reworked to `KRUKMAN © 2026 · based on ASLS Studio © ASLS-org 2021–2026`. |
| `src/views/activities/app/fragments/toolbar/toolbar.fragment.vue` | Branding: added a persistent `KRUKMAN © 2026 · based on ASLS Studio` toolbar strip (attribution surface); Manual/Contact menu links repointed to this repo and `github.com/KRUKMAN`. |
| `src/views/activities/app/fragments/toolbar/_popups/popup.newshow.vue` | Branding: template entry `ASLS Demo` → `Demo Show`. |
| `src/views/activities/app/fragments/toolbar/_popups/popup.saveas.vue` | Branding: default download filename `asls_showfile` → `swietlik_showfile`. |
| `src/views/activities/app/fragments/modifiers/_widgets/modifier.widget.colorpicker.vue` | Pre-existing lint **errors** (comma-operator assignments, `let`-that-should-be-`const`, unused vars, over-long template line) blocking `lint:ci` at 0 errors. Behaviour-neutral. |
| `src/views/components/uikit/lists/uikit.list.vue` | Pre-existing lint error: unused `e` parameter on `handleFocusOut` (and its now-stale JSDoc `@param`). Behaviour-neutral. |

---

## Deleted upstream files (6)

| File | Reason |
| --- | --- |
| `.github/workflows/deploy.app.yaml` | Upstream's deploy pipeline — targets ASLS infrastructure we have no access to. Replaced by our own `ci.yaml`. |
| `.github/workflows/deploy.docs.yaml` | Same — upstream docs deployment. |
| `.github/workflows/release.yaml` | Same — upstream `semantic-release` flow, dropped along with the dependency. |
| `public/images/studio_standalone_logo.png` | ASLS Studio branding asset, replaced by `public/images/swietlik_logo.svg`. |
| `src/assets/images/studio_logo_textual.svg` | ASLS Studio wordmark, replaced by `src/assets/images/swietlik_logo_textual.svg`. |
| `src/assets/images/studio_standalone_logo.svg` | ASLS Studio mark, replaced by `src/assets/images/swietlik_standalone_logo.svg`. |

---

## Intentional REMAINING "asls" references

These are **deliberate**. Do not "clean them up".

| Reference | Why it stays |
| --- | --- |
| `@asls/wsc-client`, `@asls/wsc-sdk` | Upstream npm package names — the actual DMX gateway client. Renaming is not ours to do. Imported by `src/plugins/wsc.connection.js` and `universe.modifier.widget.connection.vue`. |
| `.asls` showfile extension | **Format contract.** `DEFAULT_PROJECT_NAME = 'new_project.asls'`, the `SHOWFILE_EXTENSIONS.ASLS` parser branch, and the file-picker `accept='.qxw,.asls,.json'` all depend on it. Renaming breaks existing user showfiles. |
| `ASLS_STUDIO_SHOWFILE` localStorage key | Legacy read-migration key in `show.model.js`. Never written, never removed. |
| `public/demo/images/asls.png` | Preview thumbnail for the demo show template (`popup.newshow.vue` background + `preview`). Cosmetic; the label was rebranded, the image was not. |
| `docs/manual/**/*.md` prose | Manual body text still describes "ASLS Studio". Rebranding the manual is its own task. |
| `docs/manual/public/studio_*.png`, `ASLSlogo.png`, `asls*.png` | Manual image assets, still referenced by `.vitepress/config.js` (favicon + logo). Left with the unrebranded prose. |
| `docs/developer/ui/.storybook/theme.asls.js` | **Filename** kept (its contents were rebranded) — renaming means touching `manager.js`/`preview.js` imports for no functional gain. Its `brandImage` still points at `/images/asls.logo.white.png`. |
| `src/electron/prebuild.js` | Downloads the WSC gateway binary from `github.com/ASLS-org/WSC/releases` — that is genuinely where it lives. Electron is out of scope anyway. |
| `test/models/show.spec.js`, `test/stubs/wsc.connection.stub.js` | Our own files; they reference the legacy key and the WSC API by name on purpose. |
| `index.html` `<noscript>` | Fixed in the docs commit — now reads "Świetlik". |

---

## Additive files (no merge debt)

New files only; nothing upstream to conflict with.

- `.github/workflows/ci.yaml` — `npm ci` → `lint:ci` → `test:run` → `build` on push/PR to `main`.
- `vitest.config.mjs` — test config, deliberately separate from `vite.config.mjs`.
- `test/setup.js`, `test/helpers/ofl.js`
- `test/stubs/moving_head.stub.js`, `test/stubs/controls.stub.js`, `test/stubs/wsc.connection.stub.js`
- `test/models/*.spec.js` — 10 files, 156 tests: `capability`, `channel`, `cueItem`, `entityManager`, `fade`, `fixture`, `master`, `pools`, `proxify`, `show`
- `public/images/swietlik_logo.svg`
- `src/assets/images/swietlik_logo_textual.svg`, `src/assets/images/swietlik_standalone_logo.svg`
- `CLAUDE.md`, `docs/swietlik/roadmap.md`, `docs/swietlik/verification.md`, `docs/swietlik/upstream-diff.md` (this file)
