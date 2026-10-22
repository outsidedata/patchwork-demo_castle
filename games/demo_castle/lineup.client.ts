// The structures on show, drawn from the loader's `model` (`assets/castle.glb`, written by
// `assets/demo_castle.bake.ts`), each a structure's chunk of stone, floors or roofs, its extras naming
// its `structure` and its `part`, on a flat ground under a sun and a sky light. Every number is the
// lineup's definition in `assets/demo_castle.json`.
//
// The stones, the floors and the roofs are worn by the game's stone plugin (`plugins/stone`).
//
// Each structure is built in its own place in the world; the lineup moves it, every chunk alike, so
// its bounds' middle is on z = 0 and the structures stand in a row along x, each `gap` metres clear of
// the next, the row's middle at x = 0, the first on the left of an eye looking along +z.
//
// What it draws is what the seat's own `player` row chose:
//   lineup   every structure of `structures` in the row
//   one      the row's `structure` alone, at x = 0
// Each structure shown has a label at its front foot, `label.below` metres under the ground: its name
// and its triangles. The caption, over the top left, says the view and the triangles of everything
// drawn, then the keys (`help`).
//
// The ground is a square `ground.size` across at y = 0; the light is a hemisphere light of `hemi` and a
// sun, a directional light from `sun.from`, casting shadows over `sun.shadow.half` metres each way of
// the camera's foot. Every mesh casts and takes shadows. The model and the textures are asked of the
// loader at once and the structures built the first frame all are there; a bake writes a new glb, and
// the page reloads with it.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type * as THREE from 'three'
import { def } from '#plugins/loader/loader.sim.ts'
import { possessed } from '#plugins/player/player.plugin.ts'
import { dispose, structure, wears, type Built } from './plugins/stone/stone.plugin.ts'

let structures: Built[] | undefined
let added: THREE.Object3D[] = []
let sun: THREE.DirectionalLight

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const ground = new T.Mesh(
    new T.PlaneGeometry(k.ground.size, k.ground.size).rotateX(-Math.PI / 2),
    plugins.render3d.dress(new T.MeshStandardMaterial({ color: k.ground.colour, roughness: 1 })),
  )
  ground.receiveShadow = true
  const hemi = new T.HemisphereLight(k.hemi.sky, k.hemi.ground, k.hemi.intensity)
  sun = new T.DirectionalLight(k.sun.colour, k.sun.intensity)
  sun.castShadow = true
  const s = k.sun.shadow
  sun.shadow.mapSize.set(s.map, s.map)
  Object.assign(sun.shadow.camera, { left: -s.half, right: s.half, top: s.half, bottom: -s.half, near: 1, far: s.far })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = s.bias
  added = [ground, hemi, sun, sun.target]
  for (const o of added) plugins.render3d.scene.add(o)
  for (const name of wears(k)) plugins.loader.load(name)
}

// Every structure of `structures`, hidden until it is shown.
function build(plugins: Plugins, k: any): Built[] {
  return (k.structures as string[]).map(name => {
    const s = structure(plugins, k, name)
    s.group.visible = false
    plugins.render3d.scene.add(s.group)
    return s
  })
}

// x of each of `widths` laid in a row `gap` apart, the row's middle at 0, the first on the left of an
// eye looking along +z, where +x is to its left.
const row = (widths: number[], gap: number) => {
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)
  let x = total / 2
  return widths.map(w => { const at = x - w / 2; x -= w + gap; return at })
}

export function tick(me: Row, plugins: Plugins) {
  const { ui, wire, render3d } = plugins
  const k = def(wire, me.kind)
  if (!structures) {
    if (wears(k).some(name => plugins.loader.get(name) === undefined)) return
    structures = build(plugins, k)
  }
  const eye = possessed(wire.rows)
  if (!eye) return
  const { mode, structure } = eye.data
  const camera = render3d.camera as THREE.Camera
  const cam = camera.position
  // the sun follows the camera's foot, so its shadows fall where the eye is looking
  const from = k.sun.from as number[]
  sun.position.set(cam.x + from[0] * k.sun.shadow.far / 2, from[1] * k.sun.shadow.far / 2, cam.z + from[2] * k.sun.shadow.far / 2)
  sun.target.position.set(cam.x, 0, cam.z)

  for (const s of structures) s.group.visible = false
  // what is shown: each structure moved to x along the row
  const shown = mode === 'one' ? [structure as number] : structures.map((_, i) => i)
  const xs = row(shown.map(i => structures![i].max.x - structures![i].min.x), k.gap)
  let drawn = 0
  shown.forEach((i, j) => {
    const s = structures![i]
    // the structure's bounds' middle to (x, 0): every chunk moved alike
    const dx = xs[j] - (s.min.x + s.max.x) / 2
    const dz = -(s.min.z + s.max.z) / 2
    s.group.visible = true
    s.group.position.set(dx, 0, dz)
    drawn += s.tris
    const label = ui.show('labels', `structure ${i}`, () => new ui.PIXI.Text({ text: '', style: ui.style('label') })) as InstanceType<typeof ui.PIXI.Text>
    label.text = `${k.structures[i]}\n${s.tris} tris`
    label.anchor.set(0.5, 0)
    ui.pin(label, [xs[j], -k.label.below, s.min.z + dz])
  })

  const c = k.caption
  const text = (key: string, style: string, at_: number[], words: string) => {
    const t = ui.show('caption', key, () => new ui.PIXI.Text({ text: '', style: ui.style(style) })) as InstanceType<typeof ui.PIXI.Text>
    t.position.set(at_[0], at_[1])
    t.text = words
  }
  text('title', 'caption.title', c.title, mode === 'one' ? k.structures[structure] : 'every structure')
  text('view', 'caption.text', c.lines, 'boxes, their stones and mortar drawn by the stone shader')
  text('tris', 'caption.text', [c.lines[0], c.lines[1] + c.line], `${drawn} triangles drawn  pace ×${eye.data.pace.toFixed(2)}`)
  text('keys', 'caption.keys', [c.lines[0], c.lines[1] + 2 * c.line + 4], k.help)
}

export function remove(plugins: Plugins) {
  for (const o of added) plugins.render3d.scene.remove(o)
  for (const s of structures ?? []) {
    plugins.render3d.scene.remove(s.group)
    dispose(s.made)
  }
  structures = undefined
  added = []
}
