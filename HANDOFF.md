# Handoff

> Generated: 2026-11-13
> Project: Tree Explorer, `/Users/kirilklein/kiril/personal_code/learning/tree-explorer`
> Session summary: Built stage 1 (windy 3D tree, live), a view frame (PR #1), then changed direction to seamless continuous camera shots; the Roots pilot shot was being built when this was written.

## Goal

An interactive 3D tree in the browser that teaches tree biology by zooming. The learner starts at the whole tree, then moves into leaves, trunk and roots, then into tissues and single cells, with animated processes (water transport, cambium growth, fungi dissolving rock, a leaf cell that comes apart). **Every move must be a seamless zoom through the same tree, never a jump between scenes.** Kiril said this explicitly after seeing the view frame.

Repo: public `kirilklein/tree-explorer`, live at https://kirilklein.github.io/tree-explorer/ (GitHub Pages, deployed by `.github/workflows/deploy.yml` on push to `main`).

## Current State

**Working:**
- Stage 1 on `main` (`b7c6b17`), live. Procedural tree with GPU wind, soil block with a quarter cut away, three stops (Leaves, Trunk, Roots) with camera fly-in and text card, hash routing.
- View frame on `feat/view-frame` (`067a52a`), open as PR #1, not merged. Adds a view contract (`src/views/types.ts`), lazy registry, routes like `#/trunk/inside/2`, a step card, a "Follow the water" button, four stub views. Lint, 6 tests and build passed.

**In progress when this was written:**
- Roots pilot shot: an Opus subagent was building in worktree `learning/tree-explorer-shot`, branch `feat/roots-shot` (from `feat/view-frame`). **Its result was not seen.** It was told to commit once ("Make overview to roots one continuous shot") and not push. Check `git -C /Users/kirilklein/kiril/personal_code/learning/tree-explorer-shot log --oneline -3` and `status`. If there is no commit, the work is partial or missing: re-run it from the plan.

**Known wrong (by Kiril's standard):**
- "Go inside" in PR #1 swaps scenes in one frame. That is the jump he rejected. It stays until the Roots shot pattern is proven.

**On hold:**
- Four view builders (trunk cross-section, water transport, roots and rock, leaf cell). None committed code. Research is done; see below.

## Files in Play

All paths under `/Users/kirilklein/kiril/personal_code/learning/`.

| File | Why It Matters |
|------|---------------|
| `/Users/kirilklein/.claude/plans/lets-build-a-3d-concurrent-sifakis.md` | The approved plan for the Roots shot. Read first. |
| `tree-explorer/` | Main checkout, branch `main`. Do not commit or push `main` from Claude: `guard.sh` blocks it. |
| `tree-explorer-frame/` | Worktree, `feat/view-frame`, PR #1. |
| `tree-explorer-shot/` | Worktree, `feat/roots-shot`. The Roots pilot. |
| `tree-explorer-{section,water,rock,cell}/` | Worktrees, `feat/view-<name>`, all at `067a52a`. `section` has four uncommitted, untested draft files in `src/views/section/` (`growth.ts`, `growth.test.ts`, `log.ts`, `cells.ts`). |
| `src/scene/tree.ts` | Seeded generator: branches, roots, leaves. The shot needs a pure function here that picks the featured root and its fork. |
| `src/scene/ground.ts` | Soil as a fixed extruded L shape with stones in the cut faces. The shot replaces it with two resizable boxes per layer so a wall can retreat. |
| `src/scene/camera.ts` | OrbitControls rig, straight-line `flyTo`, card inset offset. |
| `src/scene/createScene.ts` | Renderer, lights, loop, `showView` (frame branch). |
| `src/scene/wind.ts` | Wind as an `onBeforeCompile` vertex patch. |
| `src/data/stops.ts`, `src/App.tsx`, `src/route.ts` | Stops, shell, hash routes. |
| `/private/tmp/claude-501/-Users-kirilklein-kiril-personal-code/4f40b665-ca1b-413c-9ee8-f74060440f35/scratchpad/` | Capture scripts (`shoot.mjs`, `frame-shoot.mjs`), screenshots, and (if the builder finished) `shot-recordings/` with mp4s and contact sheets. Under `/private/tmp`: gone after a reboot. |
| `/Users/kirilklein/.claude/plans/lets-build-a-3d-concurrent-sifakis-agent-*.md` | Three view builders' own plans (water, rock, cell) with draft card text and source quotes. |

## What Has Been Tried (and Why It Failed)

### Attempt 1: Scene-swap view frame (PR #1)
- **What:** a deep view replaces the tree; the tree is hidden in one frame and the camera flies to the view's first pose.
- **Why it failed:** nothing connects tree and view. Kiril: "my idea was making seamless transitions, with zoomins ... rather than a jump from one thing to the other."

### Attempt 2: Zoom-dissolve plan (never built)
- **What:** push the camera into a spot on the tree and crossfade to the view rendered by a second camera.
- **Why rejected:** still two pictures blended. Kiril replaced it with his own brief: one continuous shot through the *same* geometry, so the learner can point at a root and follow that exact root underground.

### Attempt 3: Four view builders in parallel on the scene-swap contract
- **What:** four Opus subagents, one per view, each in its own worktree.
- **Why stopped:** the views must be anchored to a real spot on the tree, not shown in its place. Building them on the old contract would be rework.

### Small traps hit
- `guard.sh` blocks any push or commit on `main` from Claude, including `!` commands in the session. Kiril pushed `main` from a plain terminal.
- Headless Chrome `--screenshot --virtual-time-budget` renders only about 3 frames under SwiftShader. Use the DevTools-protocol scripts in the scratchpad.
- three r187 removed `PCFSoftShadowMap`; use `PCFShadowMap`.
- `open.lib.umn.edu` returns 403 to curl and is not on the WebFetch allowlist.

## Current Best Theory

Kiril's brief is the design. One canvas, one scene. One timeline value drives camera position, look target and soil cutaway together, and runs backward for Back. The shot starts from the learner's current camera pose, aims at a fork of one real root, descends beside the trunk, the soil wall retreats along that root, and the camera glides along it and settles; labels and card appear only when it is nearly still. Prove it on Overview → Roots → Overview, tuned against recordings, **before** applying it to Trunk and Leaves.

For scale jumps of 100x and more (root tip to fungal thread, trunk to cells) the same rule applies: a detail mesh aligned to the same spot and blended in as the camera approaches. Not designed yet.

## Next Steps

1. Read the plan file, then check the Roots shot worktree for a commit (see Current State).
2. If committed: run lint, test, build there; read the contact sheets in `scratchpad/shot-recordings/` (or re-record if the scratchpad is gone); check the four beats of the brief, both directions, default and off-axis start.
3. Give Kiril the half-speed recordings (or a dev preview: `npm run dev -- --port 5186 --strictPort` in the shot worktree). **He must watch the motion; stills cannot sign it off.**
4. Tune until he agrees. Then push `feat/roots-shot` and open PR #2 with base `feat/view-frame`.
5. Apply the pattern to Trunk and Leaves (own short plan first).
6. Re-brief the four views as detail anchored to the tree, then resume them in parallel. Use the research below.

## Research already done for the views (keep)

- **Water** (OpenStax Biology 2e 30.5, Cal Academy transcript): do not say "the tree has no pump"; the Cal Academy transcript says "The tree acts like a giant water pump." Say it costs the tree no metabolic energy. Redwoods "nearing 116 meters" (OpenStax). No "10 metre" limit in any opened source.
- **Rock** (PMC4510491, Schmalenberger et al. 2015): Scots pine seedlings with *Paxillus involutus* in lab microcosms. Hyphae secreted oxalate; calcium oxalate crystals built up on hyphae; more on gabbro, basalt, olivine, limestone than on quartz and granite. **No pits were imaged and return transport to the tree was not measured.** Show crystals; mark any pit as illustration. General points from OpenStax 30.3 and 31.3.
- **Trunk** (Oregon State `pnw184.pdf`, OpenStax 30.1 and 30.2): layers and rings from Oregon State; living phloem, water-conducting xylem "dead at maturity", living xylem parenchyma, cambium forming xylem inside and phloem outside from OpenStax. **Unsupported so far:** outer bark is dead, "ray cells", cambium is "thin".
- **Cell** (OpenStax 4.3, 8.1, 31.1): carbon from atmospheric CO2 "composes the majority of the dry mass within most plants" (31.1). "Palisade" and cytoplasmic streaming are unsupported without the Minnesota page.
- The Veritasium and GFZ videos shape the story only; no claim may be attributed to them.

## Key Constraints

- Kiril's global `CLAUDE.md`: a plan he agrees to before architectural code; replies short; no subagents unless he asks (he allowed Opus 5.5 builders for implementation here); comments only when really necessary; no co-author lines in commits; deliver only what was asked.
- Every card sentence must be backed by a passage from a written source that was actually opened.
- Git: personal identity (`kirilklein`, `49436907+kirilklein@users.noreply.github.com`), remote `git@github-personal:kirilklein/tree-explorer.git`. For `gh` writes: `gh auth switch --user kirilklein` in the same call, then switch back to `kvk-cmd`.
- Feature branches only; Kiril merges and pushes `main`.
- Stack: Vite, TypeScript, React 19, plain three.js (no react-three-fiber), vitest, oxlint. No new dependencies.
- Dev servers may still run on ports 5180 (`main`) and 5181 (frame). Stop them if not needed.
- Open question for Kiril: University of Minnesota source (paste text, allow host, or drop).
- This file lives only on branch `docs/handoff` (worktree `learning/tree-explorer-handoff`). Do not merge it into `main`.

## Memory Pointers

- Work state list `tree-explorer` (`work_state_read`) holds the same status in short.
- Searches worth re-running: `tree explorer roots shot`, `tree explorer view frame`.
