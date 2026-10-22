// demo_castle's castle: a stone structure stood in the world, what its bodies stand, walk and climb on.
// A rule imports it; it has no row and no page half. The castle is the scene's one `castle` actor,
// which names its `structure` in the walk file (`assets/castle.walk.json`, written beside the glb by
// the library's `stone/stone.py`) and stands it with every point of it moved by `at` [x, y, z], where
// the structure's y = 0 meets the land. The walk file is the loader `json` entry the castle's
// definition names as `walk`.
//
// `placed(w)` is that structure in the world, worked out once a walk file, structure and `at`, and
// kept with the walk file: its solids (level blocks), slopes (floors' and roofs' tops) and ledges, each
// in a grid of CELL-metre cells by the ground it covers.
//
// `ground(w, me, under)` is the walker ground (`plugins/walker`) the body `me` stands on this step, at
// the height its feet are at when it is asked: where a block or a slope covers (x, z), one whose top is
// at or under the body's feet plus its kind's `step` is ground it may stand on, and the highest of them
// and `under`'s height is the ground; one that stands from under the feet plus a step to over the
// body's feet (it reaches into the body's height) is a wall, and its top is the height, which walker's
// step rule refuses. So a body walks on a floor over a hall, through an arch under a walk and along the
// walk itself, and stops at every wall. Its solids are `under`'s.
//
// `ceiling(w, x, z, y)` is the lowest bottom of a block or a slope over (x, z) above y, or Infinity:
// where a rising head meets stone.
//
// `ledges(w, x, z, r)` is every ledge with a point within r of (x, z) across the ground, each `{ a, b,
// n }`: its two ends [x, y, z] and the way out from the wall [x, z], in the order the walk file lists
// them.
//
// `room(w, x, y, z, tall, step)` is whether a body standing at (x, y, z) has no stone from `step` over
// its feet to `tall` over them, at its middle: where a climber pulling up has somewhere to stand.
import type { Row, W } from '#engine/engine.ts'
import type { Ground } from '#plugins/walker/walker.sim.ts'
import { def, json } from '#plugins/loader/loader.sim.ts'

// the side of a cell of the grid the castle's pieces are found in, metres
const CELL = 1
// how far a point may lie outside a block's footprint and still be in it, metres: the walk file's
// numbers are rounded to a tenth of a millimetre
const EDGE = 2e-4

export type Ledge = { a: number[]; b: number[]; n: number[] }
type Placed = {
  solids: Float64Array; slopes: Float64Array; ledges: Ledge[]
  cells: Map<string, { solids: number[]; slopes: number[]; ledges: number[] }>
}

const kept = new WeakMap<object, Map<string, Placed>>()

const key = (i: number, j: number) => `${i},${j}`

function place(walk: any, name: string, at: number[]): Placed {
  const s = walk.structures[name]
  if (!s) throw new Error(`castle: the walk file has no structure ${name}`)
  const [ox, oy, oz] = at
  const cells: Placed['cells'] = new Map()
  const cell = (i: number, j: number) => {
    const k = key(i, j)
    let c = cells.get(k)
    if (!c) cells.set(k, c = { solids: [], slopes: [], ledges: [] })
    return c
  }
  const spread = (xs: number[], zs: number[], pad: number, add: (c: { solids: number[]; slopes: number[]; ledges: number[] }) => void) => {
    const i0 = Math.floor((Math.min(...xs) - pad) / CELL), i1 = Math.floor((Math.max(...xs) + pad) / CELL)
    const j0 = Math.floor((Math.min(...zs) - pad) / CELL), j1 = Math.floor((Math.max(...zs) + pad) / CELL)
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) add(cell(i, j))
  }
  // a block: its four corners moved by `at`, its bottom and top
  const solids = new Float64Array(s.solids.length * 10)
  s.solids.forEach((b: number[], n: number) => {
    for (let c = 0; c < 4; c++) {
      solids[n * 10 + c * 2] = b[c * 2] + ox
      solids[n * 10 + c * 2 + 1] = b[c * 2 + 1] + oz
    }
    solids[n * 10 + 8] = b[8] + oy
    solids[n * 10 + 9] = b[9] + oy
    const xs = [0, 1, 2, 3].map(c => solids[n * 10 + c * 2]), zs = [0, 1, 2, 3].map(c => solids[n * 10 + c * 2 + 1])
    spread(xs, zs, EDGE, c => c.solids.push(n))
  })
  const slopes = new Float64Array(s.slopes.length * 10)
  s.slopes.forEach((t: number[], n: number) => {
    for (let c = 0; c < 3; c++) {
      slopes[n * 10 + c * 3] = t[c * 3] + ox
      slopes[n * 10 + c * 3 + 1] = t[c * 3 + 1] + oy
      slopes[n * 10 + c * 3 + 2] = t[c * 3 + 2] + oz
    }
    slopes[n * 10 + 9] = t[9]
    spread([0, 1, 2].map(c => slopes[n * 10 + c * 3]), [0, 1, 2].map(c => slopes[n * 10 + c * 3 + 2]), EDGE, c => c.slopes.push(n))
  })
  const ledges: Ledge[] = s.ledges.map((l: number[], n: number) => {
    const it = { a: [l[0] + ox, l[1] + oy, l[2] + oz], b: [l[3] + ox, l[4] + oy, l[5] + oz], n: [l[6], l[7]] }
    spread([it.a[0], it.b[0]], [it.a[2], it.b[2]], 0, c => c.ledges.push(n))
    return it
  })
  return { solids, slopes, ledges, cells }
}

// The castle actor, its walk file, and that structure where it stands.
export function placed(w: W): Placed {
  const me = w.find('castle') as Row
  const k = def(w, 'castle')
  const walk = json(w, k.walk)
  const { structure, at } = me.data
  let byAt = kept.get(walk)
  if (!byAt) kept.set(walk, byAt = new Map())
  const k2 = `${structure}@${at.join(',')}`
  let p = byAt.get(k2)
  if (!p) byAt.set(k2, p = place(walk, structure, at))
  return p
}

// whether (x, z) is inside block n's convex footprint
function inBlock(s: Float64Array, n: number, x: number, z: number) {
  let sign = 0
  for (let c = 0; c < 4; c++) {
    const ax = s[n * 10 + c * 2], az = s[n * 10 + c * 2 + 1]
    const bx = s[n * 10 + ((c + 1) % 4) * 2], bz = s[n * 10 + ((c + 1) % 4) * 2 + 1]
    const ex = bx - ax, ez = bz - az
    const cross = ex * (z - az) - ez * (x - ax)
    const len = Math.sqrt(ex * ex + ez * ez)
    if (len === 0) continue
    const d = cross / len
    if (d > EDGE) { if (sign < 0) return false; sign = sign || 1 }
    else if (d < -EDGE) { if (sign > 0) return false; sign = sign || -1 }
  }
  return true
}

// the top of slope n over (x, z), or undefined where (x, z) is outside it
function onSlope(t: Float64Array, n: number, x: number, z: number): number | undefined {
  const x0 = t[n * 10], y0 = t[n * 10 + 1], z0 = t[n * 10 + 2]
  const x1 = t[n * 10 + 3], y1 = t[n * 10 + 4], z1 = t[n * 10 + 5]
  const x2 = t[n * 10 + 6], y2 = t[n * 10 + 7], z2 = t[n * 10 + 8]
  const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2)
  if (d === 0) return undefined
  const u = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d
  const v = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d
  const e = 1e-6
  if (u < -e || v < -e || u + v > 1 + e) return undefined
  return u * y0 + v * y1 + (1 - u - v) * y2
}

// Every span of stone over (x, z): [bottom, top] of each block and slope there.
function spans(p: Placed, x: number, z: number): number[][] {
  const c = p.cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!c) return []
  const out: number[][] = []
  for (const n of c.solids) if (inBlock(p.solids, n, x, z)) out.push([p.solids[n * 10 + 8], p.solids[n * 10 + 9]])
  for (const n of c.slopes) {
    const top = onSlope(p.slopes, n, x, z)
    if (top !== undefined) out.push([top - p.slopes[n * 10 + 9], top])
  }
  return out
}

export function ground(w: W, me: Row, under: Ground): Ground {
  const p = placed(w)
  const k = w.world.walker.kinds[typeof me.data.as === 'string' ? me.data.as : me.kind]
  const feet = me.data.pos[1]
  const over = feet + k.step, head = feet + k.height
  return {
    height(x, z) {
      let floor = under.height(x, z), wall = -Infinity
      for (const [lo, hi] of spans(p, x, z)) {
        if (hi <= over + 1e-9) floor = Math.max(floor, hi)
        else if (lo < head) wall = Math.max(wall, hi)
      }
      return wall > -Infinity ? Math.max(wall, floor) : floor
    },
    ...(under.depth && { depth: under.depth }),
    solids: under.solids,
  }
}

export function ceiling(w: W, x: number, z: number, y: number): number {
  let low = Infinity
  for (const [lo] of spans(placed(w), x, z)) if (lo > y && lo < low) low = lo
  return low
}

export function room(w: W, x: number, y: number, z: number, tall: number, step: number): boolean {
  return !spans(placed(w), x, z).some(([lo, hi]) => hi > y + step && lo < y + tall)
}

export function ledges(w: W, x: number, z: number, r: number): Ledge[] {
  const p = placed(w)
  const seen = new Set<number>()
  const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL)
  const j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL)
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const n of p.cells.get(key(i, j))?.ledges ?? []) seen.add(n)
  return [...seen].sort((a, b) => a - b).map(n => p.ledges[n])
}
