// Where a seat's eye starts: a `start` actor of the scene, one per slot, for the slot in `slot`: `up`
// metres over the ground at `at` [x, z], looking along `yaw` and down by `pitch`. The `player` row
// stands its seat's eye there. It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
