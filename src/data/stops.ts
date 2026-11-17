import type { Vec3 } from '../scene/camera'
import type { Shot } from '../scene/shot'
import { SITES } from '../scene/sites'
import type { ViewId } from '../views'

export interface Stop {
  id: 'leaves' | 'trunk' | 'roots'
  label: string
  anchor: Vec3
  shot: Shot
  text: string[]
  view: ViewId
}

export const STOPS: Stop[] = [
  {
    id: 'leaves',
    label: 'Leaves',
    anchor: SITES.leaf.label.toArray(),
    shot: SITES.leaf.shot,
    text: [
      'Leaves are where the tree makes its food.',
      'Using the energy in sunlight, a leaf turns carbon dioxide from the air and water from the roots into sugar. This is photosynthesis.',
      'Tiny pores called stomata let gases in and out, and the tree loses water vapour through them.',
    ],
    view: 'cell',
  },
  {
    id: 'trunk',
    label: 'Trunk',
    anchor: SITES.trunk.label.toArray(),
    shot: SITES.trunk.shot,
    text: [
      'Most of a trunk is dead wood. The living part is a thin ring just under the bark, built around a layer called the cambium.',
      'Outside the cambium, the phloem carries sugars down from the leaves. Inside it, the sapwood (xylem) carries water up from the roots.',
      'The heartwood in the centre is dead and gives the tree its strength. The bark protects it all.',
    ],
    view: 'section',
  },
  {
    id: 'roots',
    label: 'Roots',
    anchor: SITES.root.label.toArray(),
    shot: SITES.root.shot,
    text: [
      'Roots anchor the tree in the ground and take up water and minerals from the soil.',
      'Most of this uptake happens through fine root hairs near the root tips, usually helped by fungi that live on the roots.',
    ],
    view: 'rock',
  },
]
