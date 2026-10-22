// One seat's `player` row (`player.sim.ts`). The eye draws nothing: the camera sits on it. The climber
// is drawn for every seat's row as a capsule `body.radius` round and its walker kind's height tall, its
// feet on the row's `pos`, turned to its `yaw`, in `body.colour`, with a nose of `body.nose` showing
// which way it faces, casting and taking shadows. For the seat's own row, the one that is `mine`, its
// keys and mouse, and the camera. Every key is the player's definition (`keys`), and each names the
// `player` row's act of the same name: the stick (left, right, forward and back); the eye's `up`,
// `down` and `fast` held, `mode`, and `next` and `previous` the structure; the climber's `jump` and
// `letgo`. The mouse dragged with `drag` held sends `look` with its pixels times `sens`, right turning
// the view right and down tilting it down; the wheel sends the eye's `pace` with the pixels it turned.
// Each frame chasecamera3d follows the row.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds, Input } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

// Whether the row is this seat's, and the climber's body.
let ours = false
let body: THREE.Group | undefined

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  const k = def(plugins.wire, row.kind)
  if (row.data.as === 'climber') {
    const T = plugins.render3d.THREE as typeof THREE
    const tall = plugins.wire.scene.world.walker.kinds.climber.height
    const r = k.body.radius
    const skin = plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.body.colour, roughness: 0.8 }))
    const trunk = new T.Mesh(new T.CapsuleGeometry(r, tall - 2 * r, 6, 16), skin)
    trunk.position.y = tall / 2
    const nose = new T.Mesh(new T.BoxGeometry(...(k.body.nose as [number, number, number])), skin)
    nose.position.set(0, tall * 0.8, r)
    body = new T.Group()
    for (const m of [trunk, nose]) {
      m.castShadow = m.receiveShadow = true
      body.add(m)
    }
    plugins.render3d.scene.add(body)
  }
  if (!ours) return
  const keys = k.keys
  // chasecamera3d looks along (sin yaw, cos yaw), so a larger yaw turns the view left: right on the
  // mouse is less yaw. A larger pitch lifts the camera over the row and looks down.
  const look = (dx: number, dy: number): Input => ['look', -dx * k.sens, dy * k.sens]
  if (row.data.as === 'climber') {
    plugins.player.bind({
      stick: [{ keys: keys.stick, send: (x, y) => ['stick', x, y] }],
      press: { [keys.jump]: ['jump'], [keys.letgo]: ['letgo'] },
      drag: { key: keys.drag, send: look },
    } satisfies Binds)
    return
  }
  plugins.player.bind({
    stick: [{ keys: keys.stick, send: (x, y) => ['stick', x, y] }],
    hold: [
      { keys: keys.up, send: v => ['up', v] },
      { keys: keys.down, send: v => ['down', v] },
      { keys: keys.fast, send: v => ['fast', v] },
    ],
    press: {
      [keys.mode]: ['mode'],
      [keys.next]: ['structure', 1],
      [keys.previous]: ['structure', -1],
    },
    drag: { key: keys.drag, send: look },
    wheel: dy => ['pace', dy],
  } satisfies Binds)
}

export function tick(row: Row, plugins: Plugins) {
  if (body) {
    const [x, y, z] = row.data.pos
    body.position.set(x, y, z)
    body.rotation.y = row.data.yaw
  }
  if (ours) plugins.chasecamera3d.follow(row.id)
}

export function remove(plugins: Plugins) {
  if (body) {
    plugins.render3d.scene.remove(body)
    body.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } })
    body = undefined
  }
  if (ours) plugins.player.unbind()
}
