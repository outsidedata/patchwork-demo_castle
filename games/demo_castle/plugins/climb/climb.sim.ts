// demo_castle's climb: a walker body (`plugins/walker`) that catches ledges, hangs from them, shimmies
// along them and round onto the next, pulls itself up, lets go and leaps off, as a climber in a tomb
// does. A rule imports it and calls it on its own row; it has no row and no page half. What it climbs
// is handed in, `Holds`: the ledges near a place (`{ a, b, n }`, two ends [x, y, z] and the way out
// from the wall [x, z]), and whether a body has room to stand at a place.
//
// The row: walker's fields, and
//   stick     [x, z], the keys' way: right and forward, each −1 to 1
//   jump      true for the step after the jump key is pressed; this clears it
//   letgo     true for the step after the let-go key is pressed; this clears it
//   hang      the ledge it hangs from as [ax, ay, az, bx, by, bz, nx, nz], or null
//   along     metres along that ledge from its first end to its hands
//   rise      a pull-up under way, [x0, y0, z0, x1, y1, z1, t]: from, to, and the seconds it has run,
//             or null
//   cool      seconds before it may catch a ledge again, after it let go of one or leapt off
//
// Every number is the row's kind's definition's `climb` (`assets/climb.json`), metres and seconds:
//   reach   { above, below, out }: a ledge is caught when, in the air, its point nearest the body
//           across the ground is within `out` of the body's middle, on the ledge's outer side, and
//           from `below` under the top of its head to `above` over it
//   hang    { depth, off }: hanging, its feet `depth` under the ledge and its middle `off` out from it,
//           facing the wall
//   shimmy  metres a second along a ledge, the stick's right or left as the climber faces the wall
//   join    { gap, rise }: at a ledge's end, it goes on onto the ledge whose end is nearest, within
//           `gap` across the ground and `rise` up or down, that faces less than a right angle from it;
//           with none, it stops there
//   pull    { time, in }: the jump key with the stick not back nor to a side pulls it up onto the
//           top, `in` behind the edge at the ledge's height, over `time`, where it has room to stand;
//           with no room it leaps up instead
//   leap    { back: [out, up], side: [along, up], up }: the jump key with the stick back leaps out
//           from the wall, with the stick to a side leaps along it that way, each at those speeds
//   cool    seconds after letting go or leaping before a ledge can be caught again
//
// `climb(me, w, dt, holds, k, body)` is one step: a pull-up's, a hang's, or nothing (false) for a body
// neither hanging nor pulling up, which the rule then walks and asks `catches` of.
// `catches(me, holds, k, body)` catches the best ledge in reach of a body in the air, and is whether
// it did. `body` is the row's walker numbers.
import type { Row, W } from '#engine/engine.ts'
import type { Numbers } from '#plugins/walker/walker.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export type Ledge = { a: number[]; b: number[]; n: number[] }
export type Holds = {
  ledges(x: number, z: number, r: number): Ledge[]
  room(x: number, y: number, z: number): boolean
}

const flat = (l: Ledge) => [...l.a, ...l.b, ...l.n]
const unflat = (h: number[]): Ledge => ({ a: h.slice(0, 3), b: h.slice(3, 6), n: h.slice(6, 8) })
const across = (l: Ledge) => math.hypot(l.b[0] - l.a[0], l.b[2] - l.a[2])

// the ledge's point `u` metres from its first end, across the ground and up as it runs
function at(l: Ledge, u: number): number[] {
  const len = across(l)
  const f = len > 0 ? u / len : 0
  return [l.a[0] + (l.b[0] - l.a[0]) * f, l.a[1] + (l.b[1] - l.a[1]) * f, l.a[2] + (l.b[2] - l.a[2]) * f]
}

// where (x, z) is nearest the ledge across the ground: metres along it from its first end
function nearest(l: Ledge, x: number, z: number): number {
  const dx = l.b[0] - l.a[0], dz = l.b[2] - l.a[2]
  const ll = dx * dx + dz * dz
  const t = ll === 0 ? 0 : Math.max(0, Math.min(1, ((x - l.a[0]) * dx + (z - l.a[2]) * dz) / ll))
  return t * Math.sqrt(ll)
}

// The body hung from ledge l at u: its feet `depth` under the hands, its middle `off` out, facing in.
function hung(me: Row, l: Ledge, u: number, k: any) {
  const p = at(l, u)
  const [nx, nz] = l.n
  me.data.pos = [p[0] + nx * k.hang.off, p[1] - k.hang.depth, p[2] + nz * k.hang.off]
  me.data.yaw = math.atan2(-nx, -nz)
  me.data.vel = [0, 0, 0]
  me.data.want = [0, 0]
  me.data.grounded = false
  me.data.hang = flat(l)
  me.data.along = u
}

// Let go: hanging from nothing, the body moving at vel, not catching a ledge for `cool`.
function off(me: Row, vel: number[], k: any) {
  me.data.hang = null
  me.data.vel = vel
  me.data.cool = k.cool
}

export function catches(me: Row, holds: Holds, k: any, body: Numbers): boolean {
  if (me.data.grounded || me.data.cool > 0) return false
  const [x, y, z] = me.data.pos
  const head = y + body.height
  let best: { l: Ledge; u: number; d: number } | undefined
  for (const l of holds.ledges(x, z, k.reach.out + 1)) {
    const u = nearest(l, x, z)
    const p = at(l, u)
    if (p[1] < head - k.reach.below || p[1] > head + k.reach.above) continue
    const vx = x - p[0], vz = z - p[2]
    const d = math.hypot(vx, vz)
    if (d > k.reach.out || vx * l.n[0] + vz * l.n[1] < 0) continue
    if (!best || d < best.d) best = { l, u, d }
  }
  if (!best) return false
  hung(me, best.l, best.u, k)
  return true
}

// The ledge it goes on onto past an end of l at point p, and where on it: the nearest end within
// `gap` and `rise` of p, facing less than a right angle from l, and the metres past that end it has
// gone on.
function joined(l: Ledge, p: number[], past: number, holds: Holds, k: any): { l: Ledge; u: number } | undefined {
  let best: { l: Ledge; u: number; d: number } | undefined
  for (const o of holds.ledges(p[0], p[2], k.join.gap + 0.5)) {
    if (o.a.every((v, i) => v === l.a[i]) && o.b.every((v, i) => v === l.b[i])) continue
    if (o.n[0] * l.n[0] + o.n[1] * l.n[1] <= 0) continue
    for (const [end, u] of [[o.a, past], [o.b, across(o) - past]] as [number[], number][]) {
      const d = math.hypot(end[0] - p[0], end[2] - p[2])
      if (d > k.join.gap || Math.abs(end[1] - p[1]) > k.join.rise) continue
      if (!best || d < best.d) best = { l: o, u: Math.max(0, Math.min(across(o), u)), d }
    }
  }
  return best
}

export function climb(me: Row, w: W, dt: number, holds: Holds, k: any, body: Numbers): boolean {
  const d = me.data
  d.cool = Math.max(0, (d.cool ?? 0) - dt)
  if (d.rise) {
    const [x0, y0, z0, x1, y1, z1, t0] = d.rise
    const t = t0 + dt
    const f = Math.min(1, t / k.pull.time)
    // up first, then over the edge
    const up = Math.min(1, f * 2), over = Math.max(0, f * 2 - 1)
    d.pos = [x0 + (x1 - x0) * over, y0 + (y1 - y0) * up, z0 + (z1 - z0) * over]
    d.vel = [0, 0, 0]
    d.jump = false
    if (f >= 1) {
      d.rise = null
      d.grounded = false
    } else d.rise = [x0, y0, z0, x1, y1, z1, t]
    return true
  }
  if (!d.hang) return false
  const l = unflat(d.hang)
  const [nx, nz] = l.n
  const [sx, sz] = d.stick
  const jump = d.jump, letgo = d.letgo
  d.jump = false
  d.letgo = false
  if (letgo) {
    // dropped: a little out from the wall, so the hands do not catch the same edge at once
    off(me, [nx * 0.5, 0, nz * 0.5], k)
    return true
  }
  // facing the wall, its right is (nz, −nx)
  const lx = l.b[0] - l.a[0], lz = l.b[2] - l.a[2]
  const len = across(l)
  const ux = len > 0 ? lx / len : 0, uz = len > 0 ? lz / len : 0
  const rightward = ux * nz - uz * nx >= 0 ? 1 : -1
  if (jump) {
    const p = at(l, d.along)
    if (sz < -0.5) {
      off(me, [nx * k.leap.back[0], k.leap.back[1], nz * k.leap.back[0]], k)
      return true
    }
    if (Math.abs(sx) > 0.5) {
      const s = Math.sign(sx) * rightward
      off(me, [ux * s * k.leap.side[0], k.leap.side[1], uz * s * k.leap.side[0]], k)
      return true
    }
    const top = [p[0] - nx * k.pull.in, p[1], p[2] - nz * k.pull.in]
    if (holds.room(top[0], top[1], top[2])) {
      d.hang = null
      d.rise = [...d.pos, ...top, 0]
      return true
    }
    off(me, [0, k.leap.up, 0], k)
    return true
  }
  // shimmy along the ledge, and on round its ends
  let u = d.along + sx * rightward * k.shimmy * dt
  let on = l
  if (u < 0 || u > len) {
    const end = u < 0 ? l.a : l.b
    const next = joined(l, end, u < 0 ? -u : u - len, holds, k)
    if (next) { on = next.l; u = next.u } else u = Math.max(0, Math.min(len, u))
  }
  hung(me, on, u, k)
  return true
}
