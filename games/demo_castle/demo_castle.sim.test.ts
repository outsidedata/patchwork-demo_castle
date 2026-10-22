// demo_castle: the manager booted as its page boots it and main loaded; a seat joins, its `player`
// row, its eye, stands on its slot's start and flies along the way it looks; and the keys choose the
// view: the lineup or one structure alone, and which structure.
import { expect, test } from 'vitest'
import { boot, type Arg, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_castle.sim.ts'
import file from './demo_castle.scene.json' with { type: 'json' }
import main from './main.scene.json' with { type: 'json' }
import defs from './assets/demo_castle.json' with { type: 'json' }

const DT = file.prefabs.engine.dt

// A seat on main, its eye stood: the truth, a way to press, and the eye's row there.
const seated = async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const last = heard[heard.length - 1]
  const me = possessed(last.packet.rows)!
  let seq = 0
  const press = (action: string, ...args: Arg[]) =>
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id: me.id, action, args } })
  const eye = () => room.rows.find(r => r.id === me.id)! as Row
  return { truth, press, eye }
}

test('a seat\'s eye stands on its start and flies the way it looks at its speed', async () => {
  const { truth, press, eye } = await seated()
  const start = main.actors.find(a => a.is === 'start')!
  expect(eye().data.pos).toEqual([start.at![0], defs.player.clear + start.up!, start.at![1]])
  press('stick', 0, -1)
  for (let i = 0; i < 60; i++) truth.step(DT)
  // yaw θ looks along (sin θ, cos θ), down by the start's pitch
  const run = defs.player.speed * DT * 60
  const level = run * Math.cos(start.pitch!)
  expect(eye().data.pos[0]).toBeCloseTo(start.at![0] + level * Math.sin(start.yaw!), 6)
  expect(eye().data.pos[2]).toBeCloseTo(start.at![1] + level * Math.cos(start.yaw!), 6)
})

test('the keys choose the view and the structure', async () => {
  const { truth, press, eye } = await seated()
  const structures = defs.lineup.structures.length
  const { mode, structure } = main.prefabs.player

  press('mode')
  truth.step(DT)
  expect(eye().data.mode).toBe(mode === 'one' ? 'lineup' : 'one')
  press('mode')
  truth.step(DT)
  expect(eye().data.mode).toBe(mode)

  press('structure', -1)
  truth.step(DT)
  expect(eye().data.structure).toBe((structure + structures - 1) % structures)
  press('structure', 1)
  truth.step(DT)
  expect(eye().data.structure).toBe(structure)
  // round the lineup from its last to its first
  for (let i = structure; i < structures; i++) press('structure', 1)
  truth.step(DT)
  expect(eye().data.structure).toBe(0)
})
