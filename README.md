# Świetlik

**Web-based DMX stage-lighting previsualization and control, with a real-time 3D visualizer.**

Świetlik lets you patch DMX fixtures into universes, group them, build scenes and effects, sequence cues into chases, and preview the whole rig live in a 3D WebGL viewport before touching a single physical light.

---

## Status

Świetlik is an **early-stage fork**, currently under active rework. Expect breaking changes, missing docs, and rough edges while the project finds its shape. Not yet recommended for production show use.

---

## Quick Start

```bash
npm ci
npm start
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

Run tests:

```bash
npm run test:run
```

Run lint:

```bash
npm run lint:ci
```

---

## Roadmap

Planned direction includes: MCP-based AI control of the show, an interactive stage builder, more realistic real-time rendering, and a clearer, layered UX for both quick programming and deep control.

---

## License & Attribution

Świetlik is a fork of [ASLS Studio](https://github.com/ASLS-org/studio) by Timé Kadel and ASLS-org, used and redistributed under the GNU GPL v3.0 (see [COPYING](./COPYING)).

This project is licensed under the **GNU General Public License v3.0**. See [`COPYING`](./COPYING) for full terms. Third-party library credits are listed in [`CREDITS.html`](./CREDITS.html).
