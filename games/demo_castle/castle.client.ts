// The castle (`castle.sim.ts`) as it stands: its row's `structure` out of the loader's `model`, worn by
// the game's stone plugin (`plugins/stone`), every chunk moved by the row's `at`, so it stands where its
// bodies walk on it. The light is a hemisphere light of `hemi` and a sun, a directional light from
// `sun.from`, casting shadows over `sun.shadow.half` metres each way of the camera's foot, which it
// follows. Every number is the castle's definition. The model and the textures are asked of the loader
// at once and the castle built the first frame all are there.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { dispose, structure, wears, type Built } from './plugins/stone/stone.plugin.ts'

let built: Built | undefined
let added: THREE.Object3D[] = []
let sun: THREE.DirectionalLight

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const k = def(plugins.wire, row.kind)
  const hemi = new T.HemisphereLight(k.hemi.sky, k.hemi.ground, k.hemi.intensity)
  sun = new T.DirectionalLight(k.sun.colour, k.sun.intensity)
  sun.castShadow = true
  const s = k.sun.shadow
  sun.shadow.mapSize.set(s.map, s.map)
  Object.assign(sun.shadow.camera, { left: -s.half, right: s.half, top: s.half, bottom: -s.half, near: 1, far: s.far })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = s.bias
  added = [hemi, sun, sun.target]
  for (const o of added) plugins.render3d.scene.add(o)
  for (const name of wears(k)) plugins.loader.load(name)
}

export function tick(row: Row, plugins: Plugins) {
  const k = def(plugins.wire, row.kind)
  if (!built) {
    if (wears(k).some(name => plugins.loader.get(name) === undefined)) return
    built = structure(plugins, k, row.data.structure)
    plugins.render3d.scene.add(built.group)
  }
  const [x, y, z] = row.data.at
  built.group.position.set(x, y, z)
  // the sun follows the camera's foot, so its shadows fall where the eye is looking
  const cam = (plugins.render3d.camera as THREE.Camera).position
  const from = k.sun.from as number[], far = k.sun.shadow.far / 2
  sun.position.set(cam.x + from[0] * far, cam.y + from[1] * far, cam.z + from[2] * far)
  sun.target.position.set(cam.x, cam.y, cam.z)
}

export function remove(plugins: Plugins) {
  for (const o of added) plugins.render3d.scene.remove(o)
  if (built) {
    plugins.render3d.scene.remove(built.group)
    dispose(built.made)
  }
  built = undefined
  added = []
}
