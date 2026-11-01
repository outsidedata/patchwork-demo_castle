# demo_castle

Run about pro-ng's town, and watch its people go about it.

The town is the library's pro-ng `smallville.town` (its scene `pro-ng/scenes/smallville.town.json`, the game export,
`pro-ng/GAME_EXPORT.md`): a castle of curtain walls with battlements, four round towers with spiral stairs up to their
roofs, a gatehouse with a portcullis, stone stairs up to the walls, and inside the bailey the keep (the great hall with
its stair up into the solar), joined by a passage to the kitchen, the store, the stable, the chapel, the armoury and
the lodging, with the bailey's well, cart, smithy and stores. Outside the gate a cobbled lane runs south past the market
and its alehouse to the tavern (a loft up its stair), the workshop and six huts. Every room is furnished from pro-ng's
kit. Each landmark is its own file (`.art.json`) placed in the town; beside each, its metadata (`.art.metadata.json`)
holds where a person stands in it, the ways between those places, its stairs and its exits, and the town's metadata
holds the streets and which landmarks join which.

The game reads three files of the town and nothing else of it: its geometry, what a body walks on, and its ways.

## Playing

`yarn dev`, then `localhost:5173/games/demo_castle/index.html`. You start on the lane outside the gate, facing it.

| key | what it does |
| --- | --- |
| W A S D | run, the way the camera looks |
| Shift | walk |
| Space | jump |
| right mouse button, dragged | turn and tilt the camera |
| wheel | the camera nearer or further |

You walk on every floor, up every stair (the towers' spirals, the hall's stair to the solar, the tavern's to its loft,
the stone stairs to the walls) and onto every roof that is stood on.

`dev.html` is the testbed: `?graphs=1` draws the town's graph, the panel puts you on any of its places, and the readout
shows where you stand and where each visitor is going.

`dev.html?scene=bridge` is the bridge: a field, a bridge 3 m up across it on two piers, a ramp down from each end, and
a road under it. Its people walk over the bridge, under it on the ground and up and down its ramps, along a graph
written by hand (`assets/bridge.nav.json`), each way one straight line of shapes3d's: up a ramp, across the deck, along
the road. It shows npc3d's people on routes that climb, with people at two heights at one place on the ground. Beside
the bridge a man goes up and down a spiral, three turns rising 3 m, a way of the graph that is a shapes3d spline: he
walks its curve, as crowd3d walks a spline a straight piece at a time.

## How it is made

- **The town drawn** (`castle.client.ts`): `assets/smallville.town.glb` as pro-ng's `procedural.py` cuts it, every
  building one solid, with its roofs' coverings, its timber and its kit; the stone and the wood (`castle.material.ts`,
  pro-ng's own materials) cut each face into its courses of stones or boards, with relief, on the pictures in
  `assets/*.webp`; the kit's iron, thatch, cloth, plaster, rope, glass, slate, shingles and boards each its own look
  worked out in the shader, the kit's wood the timber's look. The lane's and the bailey's cobbles are drawn in their
  colour.
- **What you walk on** (`assets/smallville.town.partial_scene.json`, which `main.scene.json` extends): shapes3d's
  shapes, written by pro-ng's `shapes.py` from the same numbers each solid is cut from: every wall a box, cut at its
  doors and passages; every floor; every roof that is stood on, cut round the stairs that come up through it; each
  stair's straight stretches planes over its treads and its low treads boxes; and each kit part a box from the part
  itself. shapes3d holds them, every kind of them the `masonry` rule (`main.sim.ts`).
- **You** (`player.sim.ts`): a walker on shapes3d's ground at your own feet, so you stand on whatever floor you are on
  and walk under the one over you, drawn by anim as the mechworker, the same body as every visitor, playing your
  rig's idle, walk, run and jump (`assets/player.rig.json`).
- **The ways** (`assets/smallville.town.nav.json`): nav3d's graph, made of shapes3d's shapes, written by pro-ng's
  `town_nav.py` from the landmarks' and the town's metadata: in each landmark the places set by hand (by the hall fire,
  behind the tavern's counter, at the altar) and the ways between them, each stair a way up its curve from its foot to
  its top (pro-ng's `stairs.py`), each landmark's exits joined by hand where landmarks meet (the passage to the hall
  and the kitchen) or to the street it faces, and along each street a way from place to place. Each place is named
  `<landmark>/<place>`, and each way's word (`room`, `door`, `stair`, `passage`, `street`, `ground`) is in its data.
- **The people** (`visitor.sim.ts`): 30 npc3d NPCs on its crowd3d body, not walkers. Each goes on the fortress plugin's
  `tour` (`plugins/fortress/fortress.npc3d.ts`): it rolls a place from its definition's `places` (`assets/demo_castle.json`,
  forty of the town's places: the hall, the solar, the kitchen, the chapel, the stalls, the towers' roofs, the tavern,
  the huts), walks there along nav3d's route at a steady walk, each leg at the graph's heights so it climbs every stair,
  and stands a while. crowd3d draws every one of them, in the town and on the bridge, as the one Mixamo body, the
  library's mechworker. They walk through each other, and through you.

## Baking

`yarn bake demo_castle` (`assets/demo_castle.bake.ts`) cuts the town with the library's pro-ng (`procedural.py` in
Blender, which writes the walk shapes beside the glb), packs the glb with `pack.mjs`, writes the town's ways with
`town_nav.py`, cuts the stone's, the mortar's and the wood's pictures to 1024 pixels square as WebP, bakes the one
body every person in the game wears, you and every visitor, the library's mechworker, with your rig's idle, walk, run
and jump clips (`assets/player.rig.json`), writing the table anim plays by back into the rig. The body comes from the
library, the clips from `~/troupe-collection`. Change the town in the library and bake again.

## Tests

`yarn vitest run games/demo_castle/demo_castle.sim.test.ts`: you run north up the lane and in through the gate onto the
gatehouse's floor; a visitor walks the town to one of its places and stops on it at its height, its course written once
a leg; and on the bridge, visitors walk over the bridge at its height, under it on the ground, and up its ramps.
