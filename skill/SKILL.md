---
name: koala-poc-canvas
description: Explore design options for this project's screens or components on Koala POC Canvas (a local canvas, the `koala-poc-canvas` command) and take the decision with the owner: live variants side by side in rounds (layout, then visual), built by a small team of agents (research, parallel builders, a reviewer) so only checked variants reach the canvas; the owner's verdicts (Pick, Maybe, Out), their requests for more variations or a mix, pinned comments, freehand drawings, and a recorded decision that freezes the losing options. Use when asked to "put this on the canvas", "show me options/variants side by side", "lay out three versions/directions of X", "what did I comment / draw / ask for", "explore the layout of X", or to check variants visually. Works with any web project that has a dev server.
---

# Koala POC Canvas (any project)

A local infinite canvas where frames are **live iframes of this project's own dev-server routes**. The owner pans, zooms, focuses a frame, pins comments (a point or a dragged area) and draws on it (pen, marker, arrows, boxes, circles); you read all of it with the CLI. Everything stays on this machine: state lives in `.koala-canvas/` at the project root (add it to `.gitignore`). Nothing goes to any cloud.

All commands print JSON. Run them from the project root. If `koala-poc-canvas` is not installed, say so and stop: install it with `npm i -g https://github.com/jespinosa19/koala-poc-canvas/releases/latest/download/koala-poc-canvas.tgz`, then `koala-poc-canvas skill`.

> In Git Bash on Windows, prefix commands with `MSYS_NO_PATHCONV=1` or `/routes` get rewritten into Windows paths.

## 1. Start the canvas server (once per session)

The canvas runs its own small server and proxies every route to the project's dev server, so frames are same-origin (the canvas can read which element a comment or drawing points at) and hot reload keeps working.

```bash
koala-poc-canvas serve --target http://localhost:5173
```

Run it in the background. Use the dev server's real port (Vite 5173, Next 3000, etc.); start the dev server first if it is not running. It prints the canvas URL, `http://localhost:4848/__canvas/`. `--port` changes 4848. If a server for this folder already answers on that port, reuse it.

## 2. The team: who does what

A round is too much for one context to do well: reading the history, building three or four routes and judging them honestly. Split it. `koala-poc-canvas skill` installs three agent definitions next to this skill (`~/.claude/agents/`); use them with the Agent tool.

| Role | Agent | Does | Never |
| --- | --- | --- | --- |
| **Lead** | you | Talks with the owner, owns the canvas (`init`, `add`, `requests done`, `decide`), dispatches the others, hands over. | Builds variants itself when there are 3 or more. |
| **Research** | `koala-poc-canvas-researcher` (1) | Reads the screen, the design system and the canvas history (verdicts, decisions, comments, drawings, requests) and writes the brief: Keep, Avoid, owner signals, 3–4 directions, one file each. | Edits code or the canvas. |
| **Builders** | `koala-poc-canvas-builder` (1 per direction, **in parallel**) | Each builds its one direction as a scratch route in its own file and self-checks it with `koala-poc-canvas check`. | Touches another builder's file, shared code, or the canvas. |
| **Review** | `koala-poc-canvas-reviewer` (1) | Renders every variant with `koala-poc-canvas check`, judges it against the brief and the owner's signals, and checks the set is genuinely different. PASS or FIX per variant. | Fixes code. |

The flow of a round:

1. **Research** → one researcher with the screen, the round's question and the owner's words. Read its brief; if the directions are not really different, send it back once.
2. **Build** → one builder per direction, all launched in the same message so they run in parallel. Give each the full brief plus its own direction and file.
3. **Review** → one reviewer with the brief and every builder report.
4. **Fix loop** → each FIX goes back to *that* builder (SendMessage to the same agent, so it keeps its context) with the reviewer's exact words; then re-review only what changed. At most two loops: if a variant still fails, drop it and tell the owner why.
5. **Canvas** → only PASSED variants get `koala-poc-canvas add` (by you, the lead). Put the reviewer's one-line verdict in `--note`.

Small jobs skip the team: a single `more` variation, a one-line fix after a comment, or a round of two variants can be done directly, still checked with `koala-poc-canvas check` before `add`. Answering a `more` or `mix` request with 2–3 variations is a mini-round: builders in parallel, then the reviewer.

## 3. Building and placing frames

1. **Each variant is its own route**, or one route with a query param (`/playground/login?v=a|b|c`), in a scratch area of the project (a `playground`, `lab` or `dev` route) that does not ship. For apps that need a host to run (a FiveM NUI, an Electron renderer), render the screen with mock data in that route so it works in a plain browser.
2. **Directions, not versions.** 3 or 4 different ideas, one per frame, titled with a letter and the idea: "A · Dense table", "B · Cards by status".
3. **Check before the canvas:** `koala-poc-canvas check --route "/playground/login?v=a" [--device mobile] [--full] [--theme dark]` renders the route without adding it and returns `status`, `errors` (console errors and uncaught exceptions) and a screenshot `file` to open.
4. **Create the canvas:** `koala-poc-canvas init login --title "Login, three directions"` (it becomes current; `--canvas <name>` targets another one).
5. **Add one frame per passed variant**, grouped in rows (by round, breakpoint or question):
   ```bash
   koala-poc-canvas add --route "/playground/login?v=a" --title "A · Single column" --row "Round 1 · Layout" --device desktop --note "Review: pass"
   koala-poc-canvas add --route "/playground/login?v=a" --title "A · Single column" --row Mobile --id login-a-mobile --device mobile
   ```
   Devices: `desktop` 1440×900, `laptop` 1280×800, `tablet` 820×1180, `mobile` 390×844, or `--width --height`. `check.reachable: false` or a non-200 `status` means the route is broken: fix it before handing over. Frames can also be `--url http://…` (another server, not proxied) or `--image shot.png`.
6. **Hand over** the URL from `koala-poc-canvas open`.

## 4. Feedback: comments, drawings, requests

Read all three whenever the owner says they left feedback ("mira lo que he comentado", "I drew on it"):

- `koala-poc-canvas comments` lists open comments: `frameId`, `kind` (`point` or `area`), `x`/`y` (and `area.width/height`) in frame pixels, the frame's scroll at that moment, and `target` (the element under the pin or the area's centre: a `selector` with ids/`data-slot`s and its text). Change that element first; for an area, everything inside it.
- `koala-poc-canvas drawings` lists what the owner drew: `tool` (pen, marker, arrow, rect, ellipse), `color`, `frameId` (or null for the open canvas), `bounds` in frame pixels, `target` (for an arrow, the element under its **head**; otherwise under the drawing's centre), `nearComments` (comments pinned on or next to it: read them together) and a plain-language `describe`. Coordinates alone are hard to read: **always look** with `koala-poc-canvas screenshot <frame> --pins`, which draws the comments and the drawings on the frame. Typical meanings: an arrow says "this, here" or "move this there"; a box or circle marks a region; a marker highlights; a strike-through pen line usually means "remove".
- `koala-poc-canvas context` says which frame the owner has selected or focused now, with its open comments and drawings. "This one" means `focused ?? selected`.
- After changing the code (frames hot-reload on their own): `koala-poc-canvas comments resolve <id> --note "what changed"`, or `koala-poc-canvas comments reply <id> "question"` without resolving. Drawings have no thread: once acted on, take them off with `koala-poc-canvas drawings remove <id...>` and say in chat what you changed for each.

Other commands: `update <frame> [--title --route --url --width --height --device --row --note]`, `remove <frame>`, `list`, `list --all`, `use <canvas>`, `drawings clear [--frame F]`.

## 5. Explore and decide

The canvas is where the owner weighs options before committing to one, the way they used to in Figma: layout options, visual options, then a decision on record.

1. **Rounds are rows.** One row per question, named for it: `Round 1 · Layout`, then `Round 2 · Visual` built on the chosen layout. Settle structure before styling: a layout round keeps the visual plain so the comparison is about the layout.
2. **The owner marks frames** Pick, Maybe or Out (`verdict` in `list`/`context`). Out frames read dimmed and struck through. They are signal for the next round's research.
3. **The owner asks from the canvas.** Run `koala-poc-canvas requests` whenever you read comments. Three kinds:
   - `more`: variations of one frame, with an optional hint. Build 2 or 3 that push the hint in different directions (builders in parallel, then review) and add each with `--from <frame>`: it lands right after the original, same row and size. Title them as children ("A2 · Bolder price").
   - `mix`: two frames or more, and what to take from each. Build one frame that does exactly that, reviewed, added `--from` the first frame.
   - `decide`: the owner chose this frame (its verdict is already Pick), the text is the reason. Run `decide` (below) with that reason, in the owner's words.
   Close each one with `koala-poc-canvas requests done <id> --frames <new ids> --note "what you did"`.
4. **Record the decision:** `koala-poc-canvas decide "<row>" --why "the reason, in a sentence"` (or pass a frame id instead of the row name). The winner is the row's single Pick, or `--winner <frame>`. Every other frame in the row is captured in the owner's theme and **frozen** into an image, so the record survives when you delete the losing routes; `--keep` leaves them live. `koala-poc-canvas decisions` lists them all; `koala-poc-canvas thaw <frame>` brings a frozen frame back to its route.
5. **After a decision:** start the next round's research on the winner, or fold it into the real code when the owner says so. Frozen frames stay as the history of the exploration.

## Rules

- Frames reference routes, never copies. To change a variant, edit its route.
- Only reviewed variants go on the canvas; the owner's time is the scarce resource.
- Builders never share a file. Two agents editing one file in parallel is how variants silently overwrite each other.
- Never edit `.koala-canvas/*.json` by hand: the CLI writes atomically and the page updates live.

## On the canvas, for the owner

Wheel/trackpad pans; Ctrl or ⌘ + wheel, or pinch, zooms smoothly; drag the background (or Space + drag) pans. Click selects, double-click or F focuses a frame (it becomes interactive; Esc goes back; ←/→ step). ⇧1 fits all. **V** moves, **C** comments (click a point or drag an area), **D** draws: 1 pen, 2 marker, 3 arrow, 4 box, 5 circle, E eraser (drag across marks), a colour row, Ctrl Z undo, and a clear button. These keys work even while a focused frame's page has the keyboard. P, M and X mark the selection Pick, Maybe or Out. Shift-click adds frames to the selection. The frame toolbar has More like this and Choose this; with two frames or more selected, Mix.
