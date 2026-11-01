// The kinds of bridge and the bridge.scene.json file next to this one: a field, a bridge 3 m up across it
// from x −8 to 8 on two piers, a ramp down from each end to the ground at x ±16, and a road under it
// along z; the visitors going between them along the scene's hand-written graph (`assets/bridge.nav.json`),
// over the bridge at its height and under it on the ground; and the spiraller, a man going up and down
// the graph's spiral, a link whose course is a shapes3d spline, as a visitor goes, on his own two places. Every number of them that never changes is its
// definition in `assets/bridge.json`, which the scene's `world.defs` names. Where each seat's body starts
// is a `start` actor of the scene file, one per slot. The field, the ramps, the deck and the piers are
// shapes3d's, drawn by solids from their looks, and each is `masonry`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { npc3d } from '#plugins/npc3d/npc3d.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { visitor } from './visitor.sim.ts'
import { masonry } from './masonry.sim.ts'
import file from './bridge.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, npc3d, player, start, visitor, spiraller: visitor, field: masonry, ramp: masonry, deck: masonry, pier: masonry }

export const scene = file as Scene
