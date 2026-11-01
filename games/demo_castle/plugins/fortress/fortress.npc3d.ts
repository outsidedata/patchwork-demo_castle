// fortress's mod for npc3d (`addons/scenemanager`'s mods): the visitors' going about the fortress. A scene
// with `world.npc3d.mods: { behaviors: 'fortress' }` has npc3d take its behaviour:
//   tour  goes from place to place of the fortress's graph. Its score is its `weight`. It rolls one of
//         `places`, the tags of the graph's places (`data.nav3d.tags`), other than the one it is going to
//         (its row's `going`), and walks there along npc3d's route (`world.npc3d.mods.route`, nav3d's) on
//         `clip` at `speed`, to the graph's place the tag names, its height and all, so a person climbs each
//         stair the route goes up; there it stands on `stand` for seconds rolled within `stay`. A place with
//         no way there from where it stands (nav3d's `route` over `graph`) it stands on `stand` for seconds
//         rolled within `rest`, and rolls again. A tag none of the graph's places has throws, naming it.
// Its row's `going` is the place it is going to, or got to last.
import { graph, route } from '#plugins/nav3d/nav3d.sim.ts'
import { roll, travel, type Behavior } from '#plugins/npc3d/npc3d.sim.ts'

export function behaviors(): Record<string, Behavior> {
  const tour: Behavior = {
    score: (_me, _w, set) => set.weight,
    start(me, w, set, time, body) {
      const others = set.places.filter((p: string) => p !== me.data.going)
      const going = others[Math.min(others.length - 1, Math.floor(w.die() * others.length))]
      const place = graph(w, set.graph).places.find(p => p.data?.nav3d?.tags?.includes(going))
      if (!place) throw new Error(`${me.kind}'s tour goes to ${going}, which no place of the graph ${set.graph} tags`)
      if (!route(w, set.graph, body.where(me, time), going)) {
        body.stand(me, w, time, set.stand)
        me.data.until = time + roll(w, set.rest)
        return
      }
      me.data.going = going
      me.data.until = travel(me, w, time, body, place.point.at, set.speed, set.clip)
    },
    arrive(me, w, set, time, body) {
      body.stand(me, w, time, set.stand)
      me.data.until = time + roll(w, set.stay)
    },
  }
  return { tour }
}
