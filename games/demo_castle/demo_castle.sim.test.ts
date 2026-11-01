// demo_castle: the manager booted as its page boots it and main loaded, on pro-ng's town as
// `yarn bake demo_castle` wrote it. A seat joins on the lane outside the gate and runs north up it on the
// cobbles; and the visitors go about the town until one reaches a place along nav3d's route. On bridge, the visitors
// walk over the bridge at its height, under it on the ground, and up and down its ramps.
import { expect, test } from 'vitest'
import { boot, type Row, type Scene, type W } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { bodies } from '#plugins/npc3d/npc3d.sim.ts'
import { sim } from './demo_castle.sim.ts'
import file from './demo_castle.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

// The game booted with its entry `entry` and a seat in it, which steps only while a seat is in it.
async function main(entry = 'main') {
  const top = { ...file, prefabs: { ...file.prefabs, scenemanager: { ...file.prefabs.scenemanager, entry } } }
  const truth = boot(top as Scene, sim)
  const room = (await load(truth, import.meta.url)).get(entry)!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  return { truth, room, heard, seat }
}

test('a seat starts on the lane outside the gate and runs north up it into the gatehouse', async () => {
  const { truth, room, heard, seat } = await main()
  const last = heard[heard.length - 1]
  const me = () => room.rows.find(r => r.kind === 'player')!
  // the lane runs north (−z) to the gate's south face at z 19
  expect(me().data.pos[0]).toBeCloseTo(0, 5)
  expect(me().data.pos[2]).toBeCloseTo(22, 5)
  // up the lane, as the W key sends it, facing the gate
  seat.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.packet.n, id: me().id, action: 'stick', args: [0, -1] } })
  for (let i = 0; i < 1 / DT; i++) truth.step(DT)
  const [x, y, z] = me().data.pos
  // in through the gate's south face (z 19), on the gatehouse's floor, 2 cm up
  expect(z).toBeLessThan(19)
  expect(Math.abs(x)).toBeLessThan(1.3)
  expect(y).toBeCloseTo(0.02, 3)
  expect(me().data.grounded).toBe(true)
})

test('a visitor walks the town to one of its places and stops on it, its course written once a leg', async () => {
  const { truth, room } = await main()
  // a rule's view of the truth, as far as the loader and nav3d read it
  const w = { world: room.world, find: (kind: string) => room.rows.find(r => r.kind === kind)! } as unknown as W
  const places = graph(w, 'town').places
  const visitors = room.rows.filter(r => r.kind === 'visitor') as Row[]
  const time = () => room.rows.find(r => r.kind === 'npc3d')!.data.time
  const node = (name: string) => places.find(p => p.data?.nav3d?.tags?.includes(name))!.point
  // each visitor's walk: the row's lane (z) it set out from, how many times its course was written and how many legs
  type Walk = { from: number; writes: number; legs: number; since: number; leg: number }
  const walks = new Map<number, Walk>()
  let arrived: { v: Row; walk: Walk } | undefined
  for (let i = 0; i < 120 / DT && !arrived; i++) {
    truth.step(DT)
    for (const v of visitors) {
      let walk = walks.get(v.id)
      if (typeof v.data.going === 'string' && v.data.speed > 0 && !walk) walks.set(v.id, walk = { from: v.data.pos[2], writes: 1, legs: 1, since: v.data.since, leg: v.data.route?.leg ?? 0 })
      if (!walk) continue
      if (v.data.since !== walk.since) { walk.writes++; walk.since = v.data.since }
      if ((v.data.route?.leg ?? walk.leg) !== walk.leg) { walk.legs++; walk.leg = v.data.route.leg }
      if (v.data.speed === 0) {
        walks.delete(v.id)
        if (Math.abs(node(v.data.going).at[2] - walk.from) > 1) arrived = { v, walk }
      }
    }
  }
  expect(arrived).toBeDefined()
  const { v, walk } = arrived!
  // it stands on its place, at its height
  const [x, y, z] = bodies.crowd3d.where(v, time())
  const at = node(v.data.going).at
  expect(x).toBeCloseTo(at[0], 5)
  expect(z).toBeCloseTo(at[2], 5)
  expect(y).toBeCloseTo(at[1], 5)
  // its course was written as it set out on each leg and as it stopped, never every step
  expect(walk.legs).toBeGreaterThan(1)
  expect(walk.writes).toBeLessThanOrEqual(walk.legs + 1)
})

test('on bridge, visitors walk over the bridge at its height, under it on the ground, and up its ramps', async () => {
  const { truth, room } = await main('bridge')
  const visitors = room.rows.filter(r => r.kind === 'visitor') as Row[]
  const time = () => room.rows.find(r => r.kind === 'npc3d')!.data.time
  // the deck's top is 3 m up, from x −8 to 8, 2.5 m across z; the ramps run from it to the ground at x ±16
  let over = false, under = false, ramp = false
  for (let i = 0; i < 120 / DT && !(over && under && ramp); i++) {
    truth.step(DT)
    for (const v of visitors) {
      if (v.data.speed === 0) continue
      const [x, y, z] = bodies.crowd3d.where(v, time())
      const deck = Math.abs(x) < 8 && Math.abs(z) < 1.25
      if (deck && Math.abs(y - 3) < 1e-6) over = true
      if (deck && Math.abs(y) < 1e-6) under = true
      // on a ramp, its feet at the ramp's height there: 0 at its foot, 3 at its top
      if (Math.abs(x) > 9 && Math.abs(x) < 15 && Math.abs(z) < 1.25 && Math.abs(y - (16 - Math.abs(x)) * 0.375) < 1e-6) ramp = true
    }
  }
  expect({ over, under, ramp }).toEqual({ over: true, under: true, ramp: true })
})
