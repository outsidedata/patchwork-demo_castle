// The row one seat possesses, and the body it runs about the fortress as: a walker (`plugins/walker`, its
// numbers `world.walker.kinds.player`) on the fortress's shapes, shapes3d's ground at its own feet
// (`plugins/shapes3d`), so it stands on the floor it is on and walks under the one over it; drawn by anim
// (`world.anim.kinds.player`), which plays its rig's idle, walk, run and jump by how it moves.
// `addons/player` spawns it and writes its slot into `seat`; every seat is sent it. Its numbers are the
// player's definition in `assets/demo_castle.json`. Its own fields, beside walker's and anim's:
//   look    `{ yaw, pitch, dist }`, chasecamera3d's orbit about it, `lift` metres over its feet: the
//           camera looks along yaw and down by pitch, from dist metres back.
//   stick   [x, z], the keys' way, right and forward.
//   slow    whether the walk key is held.
//   stood   whether `before` has stood it on its start.
// `before` stands it once on its slot's `start`, at the start's `pos`, facing its `yaw`, and the camera
// behind it. Each step it walks the definition's `run` metres a second (`walk` while `slow`) the way the
// stick points from the camera's yaw, jumps on the jump key, and is animated.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads), `look(dyaw, dpitch)` within
// the camera's `minPitch` and `maxPitch`, `zoom(d)` the wheel, the camera's distance times e to the
// d·`zoom`, within `minDist` and `maxDist`, `slow(held)`, 1 held and 0 let go, and `jump`. A seat's message
// arrives from outside the program, so each act refuses arguments of the wrong kind and writes nothing.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { ground } from '#plugins/shapes3d/shapes3d.walker.ts'
import { numbers, relative, walk } from '#plugins/walker/walker.sim.ts'
import { animate } from '#plugins/anim/anim.sim.ts'

const wrap = (a: number) => math.atan2(math.sin(a), math.cos(a))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const way = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1

export const player: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.stood) return
    const start = w.find('start', s => s.data.slot === d.seat).data
    d.pos = [...start.pos]
    d.yaw = start.yaw
    d.look = { ...d.look, yaw: start.yaw }
    d.stood = true
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood) return
    const k = def(w, me.kind)
    const [x, z] = relative(d.stick, d.look.yaw)
    const pace = d.slow ? k.walk : k.run
    d.want = [x * pace, z * pace]
    d.face = null
    walk(me, w, dt, ground(w, d.pos[1], numbers(me, w)))
    animate(me, w, dt)
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    look(me, w, _seat, dyaw: unknown, dpitch: unknown) {
      if (!finite(dyaw, dpitch)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw + (dyaw as number)), pitch: clamp(l.pitch + (dpitch as number), c.minPitch, c.maxPitch) }
    },
    zoom(me, w, _seat, by: unknown) {
      if (!finite(by)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, dist: clamp(l.dist * math.exp((by as number) * c.zoom), c.minDist, c.maxDist) }
    },
    slow(me, _w, _seat, v: unknown) {
      if (v === 0 || v === 1) me.data.slow = v === 1
    },
    jump(me) {
      me.data.jump = true
    },
  },
}
