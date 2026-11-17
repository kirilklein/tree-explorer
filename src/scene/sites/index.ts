import { generateTree } from '../tree'
import { leafSite } from './leaf'
import { rootSite } from './root'
import { trunkSite } from './trunk'

export const TREE = generateTree()

export const SITES = { root: rootSite(TREE), leaf: leafSite(TREE), trunk: trunkSite(TREE) }

export type Sites = typeof SITES
