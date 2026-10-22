// The castle the climb scene stands on the land: one actor, no rule. Its `structure` names a structure
// of the walk file and the glb, and `at` [x, y, z] is where that structure's origin stands in the world,
// y on the land. What its bodies stand and climb on is the game's castle plugin
// (`plugins/castle/castle.sim.ts`), which reads this row; how it looks is `castle.client.ts`.
import type { Kind } from '#engine/engine.ts'

export const castle: Kind = {}
