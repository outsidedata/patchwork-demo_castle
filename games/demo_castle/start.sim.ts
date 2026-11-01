// Where a seat's body starts: a `start` actor of the scene, one per slot, a row at its `pos` for the
// slot in `slot`, and nothing else. The `player` row puts its seat's body on the start of its slot.
// It has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
