// The shapes of the game's scenes. In main, the town's: every kind pro-ng wrote into
// `assets/smallville.town.partial_scene.json` (its walls, floors, tops, stairs, supports and kit parts, each a
// shapes3d box, cylinder or plane, `world.shapes3d.kinds`) and every actor placing one, which main's scene extends,
// each handed out under its name by `main.sim.ts` and drawn by none of them: the solids are (`castle.client.ts`).
// In bridge, its field, ramps, deck and piers (`bridge.sim.ts`), drawn by solids from their looks. Every
// one of those kinds is this rule. shapes3d's ground stands the player on them. It has no rule.
import type { Kind } from '#engine/engine.ts'

export const masonry: Kind = {}
