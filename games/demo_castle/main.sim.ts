// The kinds of main and the main.scene.json file next to this one: the seat's eye, its `player` row;
// where it starts; and the lineup, the structures on show. Every number of them that never changes
// is its definition in `assets/demo_castle.json`, which the scene's `world.defs` names. Where each
// seat's eye starts is a `start` actor of the scene file, one per slot.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { lineup } from './lineup.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, lineup }

export const scene = file as Scene
