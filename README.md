# Patchwork

A multiplayer game engine for the browser, written in TypeScript, for building games with an AI
agent.

- Server-authoritative multiplayer, client-side prediction, server-side rollback
- Deterministic physics: Box2D v3 and Box3D compiled to WebAssembly
- 2D with PixiJS, 3D with three.js
- 57 plugins and 13 addons
- Rules and skills for Claude Code in `.claude/`
- Static site export for GitHub Pages and itch.io

## Quickstart

```
git clone --origin upstream https://github.com/outsidedata/patchwork.git mygame
cd mygame
yarn install
yarn new-game mygame
yarn vite
```

Open `http://localhost:5173/games/mygame/index.html`.

## Features

- **Multiplayer.** The server runs the game. Each player's page runs the scene ahead of the server,
  so input shows on the next frame. The server applies late input on the step it was made. A game
  runs in one tab, against a WebSocket server, or on a simulated bad network.
- **Determinism.** Physics runs the same WebAssembly on the server and in the browser. The `math`
  plugin gives `sin`, `cos`, `pow` and the rest identical results on Node and every browser, so
  prediction matches the server.
- **Source.** The engine, plugins and addons are folders in your repo. Each file starts with a
  header describing it, and has tests beside it.
- **Agents.** `.claude/` holds the rules and a skill per kind of work: kinds, levels, HUDs, plugins,
  multiplayer, testing, publishing.
- **Publishing.** `yarn publish_gh_pages_game <game>` puts a game on GitHub Pages. The multiplayer server is
  one Node process.

## Plugins and addons

### 3D rendering

- [`render3d`](plugins/render3d/): three.js with shadow maps, GTAO ambient occlusion, bloom, neutral
  tone mapping and exposure.
- [`lights3d`](plugins/lights3d/): clustered Forward+ shading, as many point lights as a scene
  likes, each pixel lit only by the lights that reach it.
- [`cel3d`](plugins/cel3d/): toon shading on every material, stepped light bands and ink outlines.
- [`dither3d`](plugins/dither3d/): the PS1 look, 15-bit colour, 4×4 ordered dithering and chunky
  low-resolution pixels.
- [`cull3d`](plugins/cull3d/): frustum culling and distance LOD for instanced cities and forests,
  drawn front to back.
- [`sprite3d`](plugins/sprite3d/): billboard sprite-sheet characters standing in a 3D world.
- [`solids`](plugins/solids/): low-poly models built from solids in JSON.
- [`environment3d`](plugins/environment3d/), [`chasecamera3d`](plugins/chasecamera3d/),
  [`stats`](plugins/stats/): a lighting rig, a third-person over-the-shoulder camera, an FPS panel.

### Open worlds

- [`terrain3d`](plugins/terrain3d/): infinite procedural terrain from a field of noise nodes with
  domain warp, biomes, texture layers placed by rules, sea and flooding, geometry rings that follow
  the camera, baked ground textures and web workers. Server and client compute identical heights.
- [`scatter3d`](plugins/scatter3d/): procedural forests, grass and boulders as instanced meshes,
  streamed round the camera, trunks and rocks solid to bodies and bullets.
- [`skydome3d`](plugins/skydome3d/): a day-night cycle, sun and moon, clouds and their shadows, fog,
  rain, snow, dust, wind and lightning, the same on every seat.
- [`ocean3d`](plugins/ocean3d/): an FFT ocean from a JONSWAP spectrum with foam and shoaling,
  deterministic on server and client, with wave-height queries for buoyancy.

### Physics and vehicles

- [`box3d`](plugins/box3d/) and [`box2d`](plugins/box2d/): Box3D and Box2D v3 rigid bodies, joints,
  sensors, ray casts and shape queries, deterministic WebAssembly, rewound for late input.
- [`box3dvehicle`](plugins/box3dvehicle/): drivable cars from one description, wheel joints, a
  spring-damper suspension, throttle, brake and steering.
- [`flight3d`](plugins/flight3d/): fixed-wing flight from stability-derivative aerodynamics with
  stall, ailerons, elevator and rudder, deterministic.
- [`walker`](plugins/walker/): a kinematic character controller on any terrain, round trees and
  rocks.

### Characters and animation

- [`anim`](plugins/anim/): Mixamo skeletal animation, gaits from ground speed, jumps and landings,
  root-motion one-shots, animation events and an upper-body layer over the legs.
- [`ik3d`](plugins/ik3d/): inverse kinematics, hands and feet that reach what a body holds or uses.
- [`interact`](plugins/interact/): getting into a car and driving it, boarding, sitting, climbing
  in, as clips parented to the machine with IK hands and feet.
- [`ragdoll3d`](plugins/ragdoll3d/): physics ragdolls on Mixamo skeletons, deterministic on every
  seat, and getting up again.
- [`dismember3d`](plugins/dismember3d/): per-limb hits, severed limbs as physics pieces, blood, and
  cars that run bodies over.

### Combat and AI

- [`hitscan3d`](plugins/hitscan3d/): hitscan weapons with lag compensation, each shot tested against
  the world as the shooter saw it.
- [`volley3d`](plugins/volley3d/): rockets, shells, grenades and missiles with splash damage, trails
  and explosions.
- [`volley2d`](plugins/volley2d/): bullet-hell patterns, each bullet computed from its volley's age;
  the network sends only the volleys.
- [`cover3d`](plugins/cover3d/): cover finding for AI, the spots behind trees and rocks out of a
  threat's sight.
- [`nav`](plugins/nav/): windowed A*, distance fields, line of sight and string-pulled routes.

### 2D games

- [`render2d`](plugins/render2d/): PixiJS with world layers, a zooming camera, pixel-perfect integer
  scaling and sharp HiDPI.
- [`sprite2d`](plugins/sprite2d/), [`particle2d`](plugins/particle2d/),
  [`light2d`](plugins/light2d/): sprite-sheet animation with shadows, particle effects, and 2D
  lighting.
- [`tilemap`](plugins/tilemap/): Tiled `.tmj` maps with Box2D colliders and live edits.
- [`grid`](plugins/grid/): large editable tile maps for city builders and sims, synced in chunks.
- [`mapgen`](plugins/mapgen/): procedural levels from a recipe and a seed, rooms, set pieces and
  actors.
- [`vision`](plugins/vision/): fog of war with visible, explored and unexplored cells.
- [`pancamera`](plugins/pancamera/) and [`roomcamera`](plugins/roomcamera/): an RTS camera with edge
  scrolling and zoom, and a room-by-room adventure camera.

### Multiplayer and networking

- [`predict`](addons/predict/): client-side prediction, the page runs its scene ahead of the server.
- [`rewind`](addons/rewind/): server-side rollback, late input applied on the step it was made.
- [`interest`](addons/interest/) and [`vision`](addons/vision/): interest management and server-side
  fog of war, each seat sent only the rows near it or the rows its team sees.
- [`socket`](addons/socket/) and [`loopback`](addons/loopback/): WebSocket with binary frames, and an
  in-memory transport with simulated latency and packet loss.
- [`simulator`](addons/simulator/): pages and server under any latency and packet loss, run faster
  than real time, every frame and packet logged as JSONL.
- [`recorder`](addons/recorder/): deterministic record and replay, any step rebuilt from the inputs.
- [`accounts`](addons/accounts/), [`persist`](addons/persist/), [`party`](plugins/party/),
  [`chat`](plugins/chat/): logins, saved characters, parties with invites and member frames, and
  zone, global, party and whisper chat.
- [`scenemanager`](addons/scenemanager/): many scenes in one server, title, menus and levels, seats
  moved between them.

### Audio and music

- [`audio`](plugins/audio/): positional 3D and 2D sound with distance rolloff, and loops.
- [`audiodaw`](plugins/audiodaw/): a DAW in the browser on Tone.js, instrument rack, effect chains,
  sends, MIDI patterns and clips.
- [`synthaudio`](plugins/synthaudio/): procedural music as notes, a song in one JSON file, played
  live from keys.

### HUD, input and cinematics

- [`ui`](plugins/ui/): HUD and menus on PixiJS, anchored panels, buttons, bars, modals, keyboard and
  gamepad focus.
- [`renderdom`](plugins/renderdom/): an HTML and CSS layer scaled over the game canvas.
- [`player`](plugins/player/): keyboard, mouse, drag and gamepad input, rebindable actions, and
  getting in and out of vehicles, mounts and turrets.
- [`cutscene`](plugins/cutscene/): in-engine cinematics from a cue file, shots, follows, letterbox,
  fades, subtitles and camera shake.
- [`particle3d`](plugins/particle3d/): sparks, smoke, blood and trails; the network sends each effect
  once.
- [`store`](plugins/store/): settings that stay in the browser, volume, brightness, rebound keys.

### Tools

- [`loader`](plugins/loader/): one catalogue of glTF models, textures, sprite sheets, Tiled maps,
  fonts, sounds and JSON, decoded once, and encrypted wads for licensed art.
- [`playtester`](plugins/playtester/): bots that play the game through the same input a person uses.
- [`math`](plugins/math/): deterministic `sin`, `cos`, `atan2`, `exp`, `log` and `pow`.
- [`local`](plugins/local/), [`shipped`](plugins/shipped/), [`heard`](addons/heard/),
  [`player`](addons/player/): client-only actors, a game's own plugins, a message log for tests, and
  player seats.

<details>
<summary><b>What each plugin is built on, and the plugins it trades with</b></summary>

A plugin lives in the world (rows, the step), in the player's browser (drawing, input, camera,
sound, UI), or both: a server half, `<p>.sim.ts`, and a browser half, `<p>.plugin.ts`. A **mod** is
a file one plugin writes for another, so the two share data through the scene file: terrain3d's mod
for walker gives walker the height of the ground. "for" lists the plugins this one writes a mod for,
"from" the plugins that write one for it.

| plugin | built on | mods |
|---|---|---|
| [`anim`](plugins/anim/) | three.js, loader | for ik3d, interact, ragdoll3d |
| [`audio`](plugins/audio/) | Web Audio | for box3dvehicle, cutscene |
| [`audiodaw`](plugins/audiodaw/) | Tone.js | |
| [`box2d`](plugins/box2d/) | box2d.js, loader, rewind | from tilemap |
| [`box3d`](plugins/box3d/) | box3d.js, loader, rewind | for box3dvehicle · from box3dvehicle, ragdoll3d, scatter3d, terrain3d |
| [`box3dvehicle`](plugins/box3dvehicle/) | box3d, three.js, particle3d, scatter3d | for box3d, interact, scatter3d · from audio, box3d, dismember3d, hitscan3d, terrain3d |
| [`cel3d`](plugins/cel3d/) | three.js, render3d | |
| [`chasecamera3d`](plugins/chasecamera3d/) | three.js, render3d | |
| [`chat`](plugins/chat/) | PixiJS, ui | for party |
| [`cover3d`](plugins/cover3d/) | | from scatter3d |
| [`cull3d`](plugins/cull3d/) | three.js, render3d | |
| [`cutscene`](plugins/cutscene/) | PixiJS, three.js, loader, ui | from audio, terrain3d |
| [`dismember3d`](plugins/dismember3d/) | three.js, anim, hitscan3d, ragdoll3d, particle3d | for box3dvehicle, hitscan3d · from terrain3d |
| [`dither3d`](plugins/dither3d/) | three.js, render3d | |
| [`environment3d`](plugins/environment3d/) | three.js, render3d | |
| [`flight3d`](plugins/flight3d/) | render3d, loader | from terrain3d |
| [`grid`](plugins/grid/) | render2d, loader | |
| [`hitscan3d`](plugins/hitscan3d/) | rewind | for box3dvehicle, volley3d · from dismember3d, ragdoll3d, scatter3d, terrain3d, walker |
| [`ik3d`](plugins/ik3d/) | three.js | from anim, interact |
| [`interact`](plugins/interact/) | three.js, anim, loader | for ik3d · from anim, box3dvehicle |
| [`light2d`](plugins/light2d/) | render2d | |
| [`lights3d`](plugins/lights3d/) | three.js, render3d | |
| [`loader`](plugins/loader/) | three.js, fflate, fzstd | |
| [`local`](plugins/local/) | | |
| [`mapgen`](plugins/mapgen/) | math | |
| [`math`](plugins/math/) | | |
| [`nav`](plugins/nav/) | math | |
| [`ocean3d`](plugins/ocean3d/) | three.js, render3d | from skydome3d, terrain3d |
| [`pancamera`](plugins/pancamera/) | render2d | |
| [`particle2d`](plugins/particle2d/) | render2d, loader | |
| [`particle3d`](plugins/particle3d/) | render3d, loader | |
| [`party`](plugins/party/) | PixiJS, ui | from chat |
| [`persist`](plugins/persist/) | persist addon | |
| [`player`](plugins/player/) | player addon | |
| [`playtester`](plugins/playtester/) | player | |
| [`ragdoll3d`](plugins/ragdoll3d/) | three.js, anim, box3d, hitscan3d | for box3d, hitscan3d · from anim, scatter3d, terrain3d, walker |
| [`render2d`](plugins/render2d/) | PixiJS | |
| [`render3d`](plugins/render3d/) | three.js | |
| [`renderdom`](plugins/renderdom/) | | |
| [`roomcamera`](plugins/roomcamera/) | render2d | |
| [`scatter3d`](plugins/scatter3d/) | three.js, box3d | for box3d, cover3d, hitscan3d, ragdoll3d, terrain3d, walker · from box3dvehicle, terrain3d |
| [`scenemanager`](plugins/scenemanager/) | scenemanager addon | |
| [`shipped`](plugins/shipped/) | | |
| [`skydome3d`](plugins/skydome3d/) | three.js, loader, render3d | for ocean3d · from terrain3d |
| [`solids`](plugins/solids/) | render3d, loader | from terrain3d |
| [`sprite2d`](plugins/sprite2d/) | render2d, loader | |
| [`sprite3d`](plugins/sprite3d/) | render3d, loader | |
| [`stats`](plugins/stats/) | three.js | |
| [`store`](plugins/store/) | | |
| [`synthaudio`](plugins/synthaudio/) | Tone.js, loader | |
| [`terrain3d`](plugins/terrain3d/) | three.js, loader, box3d, scatter3d | for box3d, box3dvehicle, cutscene, dismember3d, flight3d, hitscan3d, ocean3d, ragdoll3d, scatter3d, skydome3d, solids, walker · from scatter3d |
| [`tilemap`](plugins/tilemap/) | render2d, loader, box2d | for box2d |
| [`ui`](plugins/ui/) | PixiJS, player | |
| [`vision`](plugins/vision/) | render2d, vision addon | |
| [`volley2d`](plugins/volley2d/) | render2d, loader | |
| [`volley3d`](plugins/volley3d/) | loader, particle3d | from hitscan3d |
| [`walker`](plugins/walker/) | hitscan3d | for hitscan3d, ragdoll3d · from scatter3d, terrain3d |

An addon holds a truth (seats, connections, sockets, files, timers, more than one truth) and runs
where the truth is.

| addon | built on |
|---|---|
| [`accounts`](addons/accounts/) | persist, loopback |
| [`heard`](addons/heard/) | rewind |
| [`interest`](addons/interest/) | |
| [`loopback`](addons/loopback/) | |
| [`persist`](addons/persist/) | rewind |
| [`player`](addons/player/) | rewind, vision |
| [`predict`](addons/predict/) | player, rewind |
| [`recorder`](addons/recorder/) | loopback |
| [`rewind`](addons/rewind/) | |
| [`scenemanager`](addons/scenemanager/) | loopback, player, rewind |
| [`simulator`](addons/simulator/) | heard, loopback, player, predict, socket |
| [`socket`](addons/socket/) | ws, loopback |
| [`vision`](addons/vision/) | |

</details>

## How a game is made

- A **scene** is a file: how a world starts and which plugins it uses. Its `world` holds its fixed
  numbers, its `prefabs` what a new row of each kind starts as, and its `actors` the rows it starts
  with. A game's manager scene holds its scenes.
- A **row** is one thing in the world, and its **kind** is what it is. A kind's code is its actor:
  its rule, `<kind>.sim.ts`, run on the server every step, and its look, `<kind>.client.ts`, run in
  the page.
- A running world is a **truth**, and one tick of its time a **step**. Every step it sends each
  seat a packet of the rows it may see.
- A **seat** is a player's place in a truth. What it plays as is its own `player` row, and a press
  is a message asking that row to act.
- A **plugin** lives in the world or in the browser; an **addon** holds a truth. The engine,
  [`engine/`](engine/), is frozen; everything new is a plugin, an addon, or a game's own kind.

`yarn new-game <name>` writes `games/<name>/`: one scene, `main`, on render2d, with a seat that
starts at a `start` actor and moves a square with the arrow keys. `index.html` plays the whole game
in one tab. For players together, run its server from the repo's root with
`node --experimental-strip-types games/<name>/<name>.server.ts` and open `client.html`, one window
a player.

The example games are their own repo. Clone it as `games/` and open any of them as
`games/<game>/index.html`:

```
git clone https://github.com/outsidedata/patchwork-games.git games
```

## Requirements

- Node 22.6 or later (it runs TypeScript with `--experimental-strip-types`).
- Yarn 1.
- To bake art: Blender, the library of raw parts the bakes read, the native gltfpack 1.3 or later
  (the native build packs WebP textures), and ImageMagick built with libwebp. Copy
  `.env.example` to `.env` and set `BLENDER`, `PATCHWORK_LIBRARY`, `GLTFPACK` and `MAGICK` where
  yours differ from the defaults it lists. Playing a game needs only Node and Yarn.

`yarn health` checks all of it: it runs each tool and prints what passes, what fails and how to fix
it.

## Commands

| command | what it does |
|---|---|
| `yarn health` | Whether this machine has what Patchwork needs: Node, the packages, and for baking, Blender, the library, gltfpack and ImageMagick. |
| `yarn new-game <name>` | `games/<name>/`: a game of one scene and a seat. |
| `yarn vite` | Serves the repo, so `games/<name>/index.html` plays. |
| `yarn bake <game>` | The game's art made again from the library: every glb its scripts build, packed, and its texture maps cut. |
| `yarn publish_gh_pages_game <game> [--owner <owner>]` | The game published to GitHub Pages as `<owner>/patchwork-<game>`, or its published repo brought up to date. |
| `yarn produce_static_site <game> [--base /<path>/]` | The game as a static site in `dist/`, its page at the site's root. `--base` is the path the host serves it under: `/<repo>/` on GitHub Pages. In a repo whose `games/` holds that game alone, it also copies the game's `README.md` over the repo's. |
| `yarn test` | Every test but the ones that draw a game in a page. |
| `yarn test:view [<file>]` | The tests that draw a game in a page (`.view.test.tsx`). |
| `yarn vitest run <file>` | One test file. |
| `yarn tsc` | The typecheck. |
| `yarn lint` | ESLint. |

## Putting a game online

`yarn publish_gh_pages_game <game>` puts the game on GitHub Pages, and run again it publishes the
game's changes. It makes `~/<owner>/patchwork-<game>` from the engine and `games/<game>/`, adds a
GitHub Actions workflow that builds the site on every push, builds it once to check it, commits, and
pushes to `<owner>/patchwork-<game>`, creating the repo and Pages the first time. The game is played
at `https://<owner>.github.io/patchwork-<game>/`. The steps are the header of
[`scripts/publish_gh_pages_game.ts`](scripts/publish_gh_pages_game.ts).

The build itself is `yarn produce_static_site <game> --base /<repo>/`, which writes `dist/` for any
static host; how the site is laid out is the header of
[`scripts/produce_static_site.ts`](scripts/produce_static_site.ts). Running the server for players
together is [`publishing-a-game`](.claude/skills/publishing-a-game/SKILL.md).

## For agents

Start at [`.claude/CLAUDE.md`](.claude/CLAUDE.md): the commands, and where every fact lives. Then
[`prime-directive`](.claude/skills/prime-directive/SKILL.md): the engine is frozen, where every new
thing goes, and which phase skill carries each kind of work. Beside it in
[`.claude/skills/`](.claude/skills/) are the phase skills: making a game (`starting-a-game` through
`auditing-a-game`) and distributing it (`going-multiplayer`, `persisting-players`,
`committing-a-game`, `publishing-a-game`).

Whether a game can be built on Patchwork is answered from the lists above and the headers of those
files: each says what the piece does, what it is handed and what it hands back.

## Your repo

It has two remotes:

- `upstream`: Patchwork. You read from it and never push to it.
- `origin`: your own repo, which you add when you make it (`git remote add origin <url>`, then
  `git push -u origin master`).

Everything you change is a commit in your repo: your game, a new plugin such as
`plugins/terrain4d/`, an edit to Patchwork's own `plugins/terrain3d/`. You push to `origin`.

## Taking updates

1. `git fetch upstream`: downloads Patchwork's new release. It changes none of your files.
2. `git switch -c update-core`: a branch to merge on, so `master` is untouched until the merge is
   proven.
3. `git merge upstream/master`: joins Patchwork's changes into yours.
4. `yarn install`, `yarn tsc`, the tests beside what Patchwork changed, and your game played.
5. `git switch master`, `git merge update-core`, `git push origin master`.

A game made on an older Patchwork runs on the release it was made on: `git clone --branch <tag>
--depth 1 https://github.com/outsidedata/patchwork.git`.

Git merges line by line, file by file:

- A file only you have (`plugins/terrain4d/`, `games/mygame/`): Patchwork has no such file, so the
  merge never touches it.
- A file only Patchwork changed: takes Patchwork's version.
- A file both changed, in different places: both changes kept.
- A file both changed on the same lines, a file one side deleted and the other changed, or a file
  both created at the same path (Patchwork later ships its own `terrain4d`): the merge stops and
  names the file, with both versions marked inside it. Nothing is overwritten. You, or your agent,
  write what the lines should be and commit; `git merge --abort` puts everything back as it was
  before step 3.
- `yarn.lock` in conflict: take Patchwork's (`git checkout --theirs yarn.lock`) and run
  `yarn install`, which writes it again with both sides' dependencies.

A merge with no conflict can still break your game: Patchwork renames a function `terrain4d` calls,
and the lines never touched each other. Step 4 is how that is found: `yarn tsc` names every call
that no longer matches, and the tests and the game show the rest.

## Giving back

A plugin worth having in Patchwork goes to it as a pull request from a fork of
`outsidedata/patchwork` on GitHub; once merged, the next update brings it back as Patchwork's. The
steps are in [`publishing-a-game`](.claude/skills/publishing-a-game/SKILL.md), Giving back.

## Licence

MIT ([`LICENSE`](LICENSE)), Copyright (c) 2026 Outside Data. Make games, sell them, keep the money.
