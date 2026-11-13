import type { Pose, Vec3 } from '../scene/camera'
import type { ViewId } from '../views'

export interface Stop {
  id: 'leaves' | 'trunk' | 'roots'
  label: string
  anchor: Vec3
  pose: Pose
  text: string[]
  view: ViewId
}

export const OVERVIEW: Pose = { position: [17, 6, 23], target: [0, 2.4, 0] }

export const STOPS: Stop[] = [
  {
    id: 'leaves',
    label: 'Leaves',
    anchor: [2.5, 8.5, 3],
    pose: { position: [7.5, 10.5, 9], target: [2, 7.2, 2] },
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
    anchor: [0.3, 1.8, 0.4],
    pose: { position: [5.5, 2.4, 8.5], target: [0, 1.8, 0] },
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
    anchor: [2, -1.2, 2],
    pose: { position: [8.5, 1.6, 10], target: [1.8, -1.5, 1.8] },
    text: [
      'Roots anchor the tree in the ground and take up water and minerals from the soil.',
      'Most of this uptake happens through fine root hairs near the root tips, usually helped by fungi that live on the roots.',
    ],
    view: 'rock',
  },
]
