// The kinds of climb and the climb.scene.json file next to this one: the castle stood on the land, and
// a climber who walks on it and climbs it, the seat's `player` row `as` a climber. Where it starts is a
// `start` actor, one per slot. Every number that never changes is the definitions in
// `assets/climb.json`, which the scene's `world.defs` names, or the scene's `world`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { start } from './start.sim.ts'
import { castle } from './castle.sim.ts'
import file from './climb.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, start, castle }

export const scene = file as Scene
