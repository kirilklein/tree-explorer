# Handoff

> Generated: 2026-11-17 (replaces the 2026-11-13 version)
> Project: Tree Explorer, `/Users/kirilklein/kiril/personal_code/learning/tree-explorer`
> Session summary: The seamless Roots shot and descent are done and approved; leaves, trunk and transport were half-built by three parallel builders when the Mac had to restart. All work is saved in local WIP commits.

## Goal

An interactive 3D tree in the browser that teaches tree biology by zooming. The learner starts at the whole tree and moves into leaves, trunk and roots, then into tissues and single cells, with animated processes. **Every move is one continuous camera shot through the same tree. Nothing is swapped out.** Kiril on the Roots descent: "this is exactly how i imagined it, perfect!!" That descent (`src/views/rock/`) is the reference for everything else.

Repo: public `kirilklein/tree-explorer`, live at https://kirilklein.github.io/tree-explorer/ (Pages, deployed on push to `main`).

## Current State

**Done**
- `main` (live): stage 1 tree plus the view frame (PR #1, squash-merged).
- Roots shot + descent: reviewed, approved by Kiril. On `feat/view-frame` as PR #3 → `main`, mergeable, **waiting for Kiril's squash-merge**. (PR #2 was merged into `feat/view-frame`, not `main`; #3 fixes that.)
- Preparation: commit `71254db` on `feat/view-world`, pushed, no PR yet. One shot for all stops, per-stop site files, views get a `world`, all four views anchored. Lint, 68 tests, build passed.

**Half-built (local WIP commits, not pushed, unverified by eye)**

| View | Worktree | Branch | WIP commit |
|---|---|---|---|
| Leaves descent | `learning/tree-explorer-leaf` | `feat/descent-leaf` | `1cba20b` |
| Trunk descent | `learning/tree-explorer-trunk` | `feat/descent-trunk` | `64b00ad` |
| Transport view | `learning/tree-explorer-transport` | `feat/transport` | `dc41213` |

All three branch from `71254db`. Each WIP commit must be finished and then replaced by one clean commit (`git reset --soft 71254db` then commit, or amend).

**Nothing is running after the restart.** Dev servers (5180 main, 5181 frame, 5186 view-world) and all builders are gone. The builders' context is lost; their status reports are condensed below.

## Next Steps

1. Check PR #3. If merged: rebase `feat/view-world` onto `origin/main` (`git rebase --onto origin/main f804931 feat/view-world`), push with `--force-with-lease`, open its PR against `main`.
2. Finish the three views, one Opus builder each (Kiril allowed Opus builders and parallel work). Give each builder: this file's section for its view, the "how to write an anchored view" text in `src/views/types.ts` header, and the scripts folder. Each ends with lint, full `npm test`, build, recordings, one commit.
3. Review each: contact sheets, single frames at each handover, sentence → quote tables, tree restored on leaving.
4. Merge the three into one local branch, run a preview, let Kiril watch. He must see motion himself; stills cannot sign it off.
5. PRs against `main`, one at a time, each rebased after the one before is merged.

## Per-view status (from the builders' hand-backs)

### Trunk (`src/views/section/`) — closest to done
- **Works in stills:** step 1 (rings, five layers, bright cambium line, cut flush with the bark), steps 2–3 (green glowing living cells, pale rims around dark holes for dead cells). 15 tests in the folder passed; full suite not re-run.
- **How the wedge is cut:** `wood.material.clippingPlanes` = 5 planes with `clipIntersection` (bottom, top, two radial planes at ±0.7 rad, outer bound). The hole is filled by `cut.ts` geometry built from a ray-cast against the real trunk triangles (`surfaceOf` in `frame.ts`), because the trunk is a decagon and a circle would stick out about 5%. Safe because no other wood comes below y=2.06 and the cut spans about 0.77–1.13; a test asserts it. The wedge opens with camera distance (closed at ≥2.15, open at ≤1.70), so nothing pops.
- **Kiril's hard checks:** the cut stays inside the trunk's outline; rings visible in step 1. Both reported as holding; verify by eye.
- **To do:** (1) step-1 labels overlap at 400px; fix computed, not applied: anchor Outer bark, Phloem, Cambium on the left wall (`frame.point(-HALF_ANGLE, mid(layer), h)` at h = 0.13 / 0.04 / −0.05), Sapwood at (0.15, sapwood middle, FLOOR), Heartwood at (0.3, 0.18, FLOOR). (2) Delete `scratch.test.ts`. (3) Orbit stills came out wrong (empty sky); use smaller drags, one capture at a time. (4) Overview still with the cut open. (5) Recordings in and out.
- **Deviations:** cells sit on the horizontal cross-section, not a radial wall (water-carrying cells run up the trunk, so only a cross-section shows them as rims around holes). Total zoom about 14x, not 100x+.
- **Card changes:** dropped "Under it," before the phloem sentence (no source places it); step 3 line 3 is "Over time, the phloem becomes part of the bark."

### Transport (`src/views/water/`)
- **Works in stills:** all five steps render. Step 3 (eight files of beads in lockstep with link threads) reads well. 25 tests in the folder passed before two small edits.
- **How:** `paths.ts` builds root-tip → trunk → twig paths from the generator's `chains()`; arc length `s` is shared in the trunk so files line up. Particles are InstancedMeshes patched with the shell's own `addWind` and a per-instance `aSway`, so they move with the branches; wind is also calmed to 0.15. `glass.ts` makes wood 0.28, roots 0.35, leaves 0.42 opacity and restores them.
- **Contract gap:** `update` gets no "leaving" signal. The view reads `location.hash.startsWith('#/water')` to fade out during the fly-back. Works; consider a proper signal in the shell later.
- **To do:** look at the new side-on crown pose for step 2 (earlier it was cluttered and vapour looked like hail); recordings in and out (never completed); phone stills; overview-after still; full test, build, lint.
- **Oddity:** its dev log showed HMR updates for `src/App.tsx` it did not make. Cause unknown.

### Leaves (`src/views/cell/`) — least verified
- **Built, never seen on screen:** blade with veins on the real leaf, notch with tissue section, featured palisade cell with exploded view, chloroplast with five streams, 14 labels. `sway.ts` copies the leaf wind shader on the CPU so detail stays on the leaf. 12 tests in the folder pass; `tsc` and lint clean.
- **Problem 1, render cost:** headless Chrome takes about 2 s per frame with the view shown. Likely cause: about 800k triangles in the tissue (2,500 chloroplast bumps, 400 epidermis spheres, 250 palisade capsules, 190 spongy cells). Cut segments or counts first. Not confirmed.
- **Problem 2:** the one frame seen of `#/leaves/inside/3` showed crown leaves, not the cell. Too early, or a pose bug. Not diagnosed.
- **To do:** fix cost, get stills of every step, tune labels and card fit at 400px (step 3 card is long), check transparency order, record, full test and build.
- Sizes: cell unit C = 0.0003; pose distances 1 → 0.012 → 0.00375 → 0.000255 (about 8,600x from the stop arrival at 2.2).

## Facts on the cards (rule: every sentence maps to a quoted passage in a source that was opened)

- **Roots:** OpenStax Biology 2e 30.3, 31.3; Schmalenberger et al. 2015 (PMC4510491) for the oxalate step, worded as one lab study. No pit in the stone.
- **Trunk:** Oregon State PNW 184, OpenStax 30.1, 30.2. Not supported, keep off cards: outer bark is dead, "ray cells", a "thin" cambium, "hollow tubes".
- **Leaves:** OpenStax 30.4, 4.3, 8.1, 31.1. Label reads "Plasma membrane" (4.3 never says "cell membrane"). No cytoplasmic streaming.
- **Transport:** OpenStax 30.5 only. Never "the tree has no pump" (the Cal Academy transcript says it acts like one). No "10 metre" limit, no pressure figure. The phloem's position "just under the bark" is shown, not stated.
- Full sentence → quote tables and saved source text are in the scratch folder (`*-src/`). Videos are never a source.

## Files in Play

| Path (under `/Users/kirilklein/kiril/personal_code/learning/`) | Why |
|---|---|
| `tree-explorer/` | Main checkout, `main`. Claude cannot commit or push here (`guard.sh`). |
| `tree-explorer-frame/` | `feat/view-frame`, PR #3. |
| `tree-explorer-shot/` | `feat/view-world` at `71254db`. The shared shell. |
| `tree-explorer-{leaf,trunk,transport}/` | The three WIP views. |
| `tree-explorer-handoff/` | This file, branch `docs/handoff`. Not for `main`. |
| `tree-explorer-scratch/` | **Not a repo.** Saved from the session scratchpad before the restart: all capture scripts (`*-record.mjs`, `*-assemble.sh`, `*-run.sh`), videos and contact sheets of the roots shot, descent and preparation, partial stills of the three views, source text dumps. Scripts still contain the old `/private/tmp/...scratchpad` paths; fix them before use. |
| `src/views/types.ts` | The view contract; its header is the builder guide. |
| `src/views/rock/` | Reference implementation. |
| `src/scene/shot.ts`, `camera.ts`, `createScene.ts`, `sites/` | Shot timeline, ratio zoom, shell, per-stop sites. |
| `/Users/kirilklein/.claude/plans/lets-build-a-3d-concurrent-sifakis.md` | The last approved plan (leaves, trunk, transport). |

## What Has Been Tried (and Why It Failed)

- **Scene-swap views (PR #1's "Go inside").** Kiril rejected the jump. Replaced by anchored views.
- **Zoom-dissolve between two pictures.** Rejected before building; he wanted the same geometry.
- **Stacked PRs.** Kiril squash-merges. PR #2 stacked on #1's branch never reached `main` and the follow-up conflicted. Fixed with `git merge -s ours origin/main` after checking both trees. Now: one PR at a time against `main`.
- **Old trunk placeholder** (a cylinder wider than the trunk). Kiril: "this thing just becomes bigger than the trunk itself ... doesn't show any detail like the rings". Hence the two hard checks.
- **My mistake:** I force-removed the old worktrees `tree-explorer-{section,water,rock,cell}` and lost four uncommitted draft files. Look inside a worktree before removing it.
- **Parallel recording.** Three builders recording at once made headless Chrome so slow that direct-link stills fired before the view loaded. Record one at a time.

## Key Constraints

- Kiril's global `CLAUDE.md`: a plan he agrees to before architectural code; short replies with a path line and a "Needs you" block; subagents only when he asks (he allowed Opus builders here); comments only when really necessary; no co-author lines; deliver only what was asked.
- Feature branches only. Kiril merges, with squash. Local commits and PRs are allowed ("You can also open prs once done").
- Git identity: `kirilklein`, remote `git@github-personal:kirilklein/tree-explorer.git`. For `gh` writes: `gh auth switch --user kirilklein` in the same call, then back to `kvk-cmd`.
- Stack: Vite, TypeScript, React 19, plain three.js, vitest, oxlint. No new dependencies.
- Headless capture: DevTools protocol with a stepped virtual clock, 60 frames per second of shot time, ffmpeg at `/opt/homebrew/bin/ffmpeg`. Software rendering is slow.
- `open.lib.umn.edu` was added to the managed WebFetch allowlist by Kiril; it takes effect after a Claude Code restart. The site may still answer 403. No card needs it.

## Memory Pointers

- Work state list `tree-explorer` (`work_state_read`).
- Memory file `squash-merges-no-stacked-prs`.
- Searches: `tree explorer roots descent`, `tree explorer view world`.
