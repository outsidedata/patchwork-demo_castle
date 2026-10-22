// The row one seat possesses. `addons/player` spawns it and writes the slot it gave the connection into
// `seat`, and every seat is sent it. A page running the scene ahead (`addons/predict`) draws its own
// from its copy, so it answers the key on the next frame. Its numbers are the player's definition in
// the scene's data file (`world.defs`). It is one of two things, by its `as`:
//
// The eye (no `as`), main's: what the camera sits on as it flies over the structures (chasecamera3d,
// `dist` metres behind it), and what it chooses to see of them. Its own:
//   pos        [x, y, z], the eye, in metres.
//   look       `{ yaw, pitch, dist }`: chasecamera3d's orbit; the eye looks along yaw and down by pitch.
//   lift       0: the camera's pivot is the eye itself.
//   stick      [x, z], the keys' way, right and forward; `up` and `down`, the climb keys held; `fast`,
//              the boost key held.
//   pace       the fly speed's multiplier, which the wheel moves, from `pace.min` to `pace.max`.
//   mode       `lineup`, every structure in a row, or `one`, one structure alone.
//   structure  which structure `one` draws, an index into the lineup's `structures`.
// `before` stands it once on the scene's `start` actor for its slot, `up` metres over the ground at the
// start's `at`, looking along its `yaw` and down by its `pitch`. Each step after, it flies `speed`·pace
// metres a second along the way it looks, forward and back, and across it, level, right and left, and
// `climb`·pace straight up or down; all of it `boost` times faster while `fast` is held. It never comes
// nearer than `clear` metres to the ground, the plane y = 0, nor goes higher than `ceiling` or further
// than `reach` from the middle.
//
// The climber (`as: "climber"`), the climb scene's: a walker body (`plugins/walker`, its numbers
// `world.walker.kinds.climber`) on the land and on the castle (`plugins/castle`), which climbs its
// ledges (`plugins/climb`, its numbers the definition's `climb`). Its own, beside walker's and climb's
// fields: `look` (the camera's orbit about it, `lift` metres over its feet), `stick`. `before` stands
// it once on its slot's `start`, on the ground at the start's `at`, facing its `yaw`. Each step a hang
// or a pull-up is climb's; otherwise it walks `run` metres a second the way the stick points from the
// camera's yaw, jumps on the jump key, stops rising where its head meets stone, and catches a ledge in
// reach while in the air.
//
// The acts are the page's keys: `stick(x, y)` (y down, as a stick reads) and `look(dyaw, dpitch)` for
// both; the eye's `up`, `down` and `fast` (1 held, 0 let go), `pace(d)` the wheel, `mode`, the other
// view, and `structure(by)`, by −1 or 1, round the lineup; the climber's `jump` and `letgo`. An act for
// the other thing does nothing. A seat's message arrives from outside the program, so each act refuses
// arguments of the wrong kind and writes nothing.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf, numbers, relative, walk } from '#plugins/walker/walker.sim.ts'
import * as castle from './plugins/castle/castle.sim.ts'
import { catches, climb, type Holds } from './plugins/climb/climb.sim.ts'

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x))
const held = (v: unknown) => v === 0 || v === 1
const way = (v: unknown) => typeof v === 'number' && Math.abs(v) <= 1
const climber = (me: Row) => me.data.as === 'climber'

function fly(me: Row, w: W, dt: number) {
  const d = me.data
  const k = def(w, me.kind)
  const { yaw, pitch } = d.look
  const cy = math.cos(yaw), sy = math.sin(yaw), cp = math.cos(pitch), sp = math.sin(pitch)
  const forward = [sy * cp, -sp, cy * cp]
  const right = [-cy, 0, sy]
  const boost = d.fast ? k.boost : 1
  const run = k.speed * d.pace * boost, rise = k.climb * d.pace * boost * ((d.up ? 1 : 0) - (d.down ? 1 : 0))
  const [sx, sz] = d.stick
  const x = clamp(d.pos[0] + (forward[0] * sz + right[0] * sx) * run * dt, -k.reach, k.reach)
  const z = clamp(d.pos[2] + (forward[2] * sz + right[2] * sx) * run * dt, -k.reach, k.reach)
  const y = d.pos[1] + (forward[1] * sz * run + rise) * dt
  d.pos = [x, clamp(y, k.clear, k.ceiling), z]
}

function scramble(me: Row, w: W, dt: number) {
  const d = me.data
  const k = def(w, me.kind)
  const body = numbers(me, w)
  const holds: Holds = {
    ledges: (x, z, r) => castle.ledges(w, x, z, r),
    room: (x, y, z) => castle.room(w, x, y, z, body.height, body.step),
  }
  if (climb(me, w, dt, holds, k.climb, body)) return
  const [wx, wz] = relative(d.stick, d.look.yaw)
  d.want = [wx * k.run, wz * k.run]
  d.face = null
  // a rising head stops at the stone over it
  const [x, y, z] = d.pos
  if (d.vel[1] > 0 && castle.ceiling(w, x, z, y + body.height / 2) < y + body.height + d.vel[1] * dt) d.vel = [d.vel[0], 0, d.vel[2]]
  walk(me, w, dt, castle.ground(w, me, groundOf(w)))
  d.letgo = false
  catches(me, holds, k.climb, body)
}

export const player: Kind = {
  before(me, _dt, w) {
    const d = me.data
    if (d.stood) return
    const start = w.find('start', s => s.data.slot === d.seat).data
    const [x, z] = start.at
    if (climber(me)) {
      d.pos = [x, groundOf(w).height(x, z), z]
      d.yaw = start.yaw
      d.look = { ...d.look, yaw: start.yaw, pitch: start.pitch }
    } else {
      d.pos = [x, def(w, me.kind).clear + start.up, z]
      d.look = { ...d.look, yaw: start.yaw, pitch: start.pitch }
    }
    d.stood = true
  },
  tick(me, dt, w) {
    if (!me.data.stood) return
    if (climber(me)) scramble(me, w, dt)
    else fly(me, w, dt)
  },
  acts: {
    stick(me, _w, _seat, x: unknown, y: unknown) {
      if (way(x) && way(y)) me.data.stick = [x, 0 - (y as number)]
    },
    up(me, _w, _seat, v: unknown) { if (!climber(me) && held(v)) me.data.up = !!v },
    down(me, _w, _seat, v: unknown) { if (!climber(me) && held(v)) me.data.down = !!v },
    fast(me, _w, _seat, v: unknown) { if (!climber(me) && held(v)) me.data.fast = !!v },
    pace(me, w, _seat, by: unknown) {
      if (climber(me) || !finite(by)) return
      const p = def(w, me.kind).pace
      me.data.pace = clamp(me.data.pace * math.exp(-(by as number) * p.step), p.min, p.max)
    },
    look(me, w, _seat, dyaw: unknown, dpitch: unknown) {
      if (!finite(dyaw, dpitch)) return
      const c = def(w, me.kind).camera
      const l = me.data.look
      me.data.look = { ...l, yaw: wrap(l.yaw + (dyaw as number)), pitch: clamp(l.pitch + (dpitch as number), c.minPitch, c.maxPitch) }
    },
    mode(me) { if (!climber(me)) me.data.mode = me.data.mode === 'lineup' ? 'one' : 'lineup' },
    structure(me, w, _seat, by: unknown) {
      if (climber(me) || (by !== 1 && by !== -1)) return
      const n = def(w, 'lineup').structures.length
      me.data.structure = (me.data.structure + by + n) % n
    },
    jump(me) { if (climber(me)) me.data.jump = true },
    letgo(me) { if (climber(me)) me.data.letgo = true },
  },
}
