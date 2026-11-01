// One seat's `player` row (`player.sim.ts`). anim draws the body, every seat's. For the
// seat's own row, the one that is `mine`, its keys and mouse, and the camera, which chasecamera3d holds on
// the row. Every key is the player's definition's `keys`, each naming the act of its name: the stick
// (left, right, forward and back), `slow` held and `jump`. The mouse dragged with `drag` held sends `look`
// with its pixels times `sens`, right turning the view right and down tilting it down; the wheel sends
// `zoom` with the pixels it turned.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Binds, Input } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  const k = def(plugins.wire, row.kind)
  // chasecamera3d looks along (sin yaw, cos yaw), so a larger yaw turns the view left: right on the
  // mouse is less yaw. A larger pitch lifts the camera over the row and looks down.
  const look = (dx: number, dy: number): Input => ['look', -dx * k.sens, dy * k.sens]
  plugins.player.bind({
    stick: [{ keys: k.keys.stick, send: (x, y) => ['stick', x, y] }],
    hold: [{ keys: [k.keys.slow], send: v => ['slow', v > 0 ? 1 : 0] }],
    press: { [k.keys.jump]: ['jump'] },
    drag: { key: k.keys.drag, send: look },
    wheel: dy => ['zoom', dy],
  } satisfies Binds)
  plugins.chasecamera3d.follow(row.id)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
