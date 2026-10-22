# demo_castle journal

## 2026-10-21: from boxes to a castle you can walk and climb

demo_castle is the workbench for the library's stone generator (`stone/` in `PATCHWORK_LIBRARY`):
`mason.py` turns a spec of pieces into boxes, `stone.py` writes them as a glb, and this game wears
them with its stone shader. At the start of the day the generator could only sweep boxes along a
line: every wall a flat slab of one thickness, no roofs, no floors, battlements as notches in the top,
and nothing a body could stand on or climb. The work below was done as an experiment, one step shown
at a time.

### What the generator makes now

- **A thickness per piece.** `thickness` on a room, round or wall overrides the structure's, so a keep,
  its curtain and its towers each have their own. A room's or a round's inside starts at its own
  thickness.
- **Wall-walks.** `walk: [thickness, height]` makes the top walkable behind a parapet on the outer edge
  (a wall's front, the left of its path); its `crenels` are cut in the parapet.
- **Corbels.** `corbels: [out, height, gap]` stands the parapet out past the face on a band of corbels.
- **Plinths and string courses.** `plinth: [height, out, steps]` is a stepped base;
  `strings: [[height, out], ...]` are projecting bands a course high. Openings go through both.
- **Floors and roofs.** `floors: [height, ...]` lays slabs over a room's or a round's inside;
  `roof: [rise, overhang]` is a hipped roof on a room or a cone on a round, inside the parapet when the
  piece is walked. They are written as `-floor` and `-roof` nodes beside each chunk's stone and worn
  with the style's floor set (`flagstone_1-4K`) and roof set (`grey_roof_tiles_02_4K-JPG`).
- **Gatehouses and towers that stand out.** No new piece was needed: a gatehouse is a room straddling
  the curtain with an arched opening front and back between two rounds listed before it, and a tower
  stands out of a curtain when it is set forward of its line.
- **A weathered outline.** The style's `weather: [drop, ragged]`: a top the air meets (a merlon, a
  free wall, a ruin) is cut at its stones and each stone sunk by its own hash, up to 70 mm for rough
  stone; an end the air meets is set back course by course. Walks, roofed tops, jambs, plinths,
  string courses and corbels keep their dressed lines.
- **Footings.** A structure's `footing` reaches every wall that far under its foot, so it stands on
  uneven land with no gap under it.
- **The walk file.** Beside the glb, `castle.walk.json`: every structure's `solids` (level blocks of
  stone), `slopes` (floors' and roofs' tops) and `ledges` (edges a hand hangs from, each with the way
  out from the wall).

### Speed

The new pieces overlap their wall all the way round, and generating went from seconds to minutes: a
tower with every feature took over five minutes. Two causes, both found in the code and measured under
the profiler:
- the point-in-stone check walked every nearby box in 5 cm steps each time it was asked; it now uses
  the run index, and finds a round's and a straight run's nearest point exactly;
- every height band re-checked every centimetre of a wall against the walls before it; where a wall
  lies in earlier walls is now worked out once a place and sampled every 5 cm, its edges still found
  exactly.

The old tower went from 26 s to 1.2 s, the keep (1,089 boxes) bakes in about 15 s, and the generator's
tests run in about 16 s.

### Bugs found on the way

- The undersides of parapets, corbels and string courses were left out as if they stood on the
  ground, so you could see into an overhanging parapet between its corbels.
- A wall running the whole way round a tower did not count as solid at the one spot where the ring's
  start meets its end.
- A ruin anywhere in a structure turned on the rule that drops a stone with nothing under it, and
  that rule only counted stone of the same wall: a wall on its plinth counted as floating and fell
  away. Stone of any wall under a course now holds it up.
- A walked roof's eave sat against the walk, and was written as a ledge that faces into the wall.
  Eaves are ledges only where they overhang. A step's top and anything under half a metre over its
  wall's foot is not a ledge.

### The game

- **`main`** (`index.html`): the lineup of the spec's structures, flown over by an eye. It opens on the
  keep, the structure that shows every feature: corner towers standing out of a walked curtain, a
  gatehouse between two towers, a roofed keep with floors, string courses and a stepped plinth, and a
  low broken wall outside the gate to climb.
- **`climb`** (`dev.html?scene=climb`): the keep stood on rolling land (`assets/land.json`, terrain3d,
  meadow and rock) on a 3 m footing, and a climber to walk it and climb it. WASD walks, Space jumps
  (and pulls up while hanging), Space with the stick back or to a side leaps off the wall, A and D
  shimmy while hanging, C lets go, the right mouse button looks. `dev.html`'s panel sets every climbing
  number live.
- **`plugins/stone`**: the stone shader and the floor and roof materials, moved out of the lineup's
  look so the lineup and the castle draw the same way.
- **`plugins/castle`**: the walk file stood where the castle actor's `at` puts it. A body's ground is
  read at its own height, so it walks under an arch, on a floor over a hall and along a walk, and a
  wall stops it; a rising head stops at stone; and it finds the ledges near a place.
- **`plugins/climb`**: catching a ledge in the air, hanging, shimmying on round onto the next ledge,
  pulling up, letting go, and leaping back, sideways or up.
- **`player.sim.ts`**: one `player` kind, the eye in `main` and the climber (`as: "climber"`) in
  `climb`; each act does nothing for the other.

Proven on node: the climber walks up to the gate and into it, catches the low wall's top, pulls up,
stands on it, steps up a higher stone, stops where the wall rises higher than a step, and drops off its
end. Not yet proven: shimmying onto the next ledge, the leaps, and walking through the gate and along
the wall-walk.

### Baking it

The model, the walk file and the textures are not committed. `yarn bake demo_castle` makes them all
again: it cuts the maps `assets/cc0-textures.json` names into `assets/stone/`, and
`assets/demo_castle.bake.ts` runs the library's `stone/stone.py` on `assets/castle.stone.json` and
copies `castle.glb` and `castle.walk.json` in.

### What is left

- Winterfell built with all of this, walked and climbed end to end.
- Walker taking a height that knows the body's own, so the castle's ground need not be read at the
  body's feet by the game.
- A real character in place of the capsule, with climbing animations.
