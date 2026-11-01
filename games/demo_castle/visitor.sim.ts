// One of the taxonomy's people: an NPC of npc3d (`plugins/npc3d`) on its `crowd3d` body, drawn by crowd3d as
// a person of its `body`, going about the taxonomy on the fortress plugin's `tour` behaviour
// (`plugins/fortress/fortress.npc3d.ts`): from place to place along nav3d's routes over the taxonomy's
// graph, which pro-ng wrote (`assets/taxonomy.nav.json`), each leg one straight course from place to place along
// the rows' lanes and down the column between them. Like every crowd3d person, it walks through every other
// body. Its numbers are the visitor's definition in `assets/demo_castle.json`: npc3d's, and its `tour`'s
// settings.
// Its own field, beside npc3d's and crowd3d's:
//   home   the place its actor stands it at; '' for one of the tour's places drawn by the scene's die.
// `before` stands it once on the place its `home` tags, `going` that place, from now, facing as its actor has it;
// the rest is npc3d's `npc`.
import type { Kind } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { graph } from '#plugins/nav3d/nav3d.sim.ts'
import { npc, now, pick } from '#plugins/npc3d/npc3d.sim.ts'

export const visitor: Kind = {
  ...npc,
  before(me, _dt, w) {
    const d = me.data
    if (d.going !== null) return
    const tour = def(w, me.kind).behaviors.tour
    const name = tour.graph
    if (d.home === '') d.home = pick(w, tour.places as string[])
    const place = graph(w, name).places.find(p => p.data?.nav3d?.tags?.includes(d.home))
    if (!place) throw new Error(`visitor ${me.id}'s home ${d.home} is no place of the graph ${name}`)
    d.pos = [...place.point.at]
    d.to = [...place.point.at]
    d.going = d.home
    d.since = now(w)
  },
}
