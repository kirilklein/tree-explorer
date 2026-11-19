import { describe, expect, it } from 'vitest'
import { STOPS } from '../data/stops'
import { VIEWS, type ViewId } from '../views'
import { ru } from './ru'

const sources = import.meta.glob(['/src/views/*/index.ts', '/src/components/*.tsx', '/src/App.tsx'], { query: '?raw', import: 'default', eager: true })
const found = (pattern: RegExp) => Object.values(sources).flatMap((code) => [...(code as string).matchAll(pattern)].map((match) => match[2]))

describe('the Russian text', () => {
  it('covers every step card', async () => {
    for (const view of Object.keys(VIEWS) as ViewId[]) {
      const { default: loaded } = await VIEWS[view]()
      for (const { title, text } of loaded.steps) for (const line of [title, ...text]) expect(ru, line).toHaveProperty([line])
    }
  })

  it('covers every stop card', () => {
    for (const { label, text } of STOPS) for (const line of [label, ...text]) expect(ru, line).toHaveProperty([line])
  })

  it('covers every label in the views', () => {
    const labels = found(/\{ text: (['"])(.+?)\1, at:/g)
    expect(labels.length).toBeGreaterThan(50)
    for (const label of labels) expect(ru, label).toHaveProperty([label])
  })

  it('covers every button and hint', () => {
    const words = found(/\bt\((['"])(.+?)\1\)/g)
    expect(words.length).toBeGreaterThan(8)
    for (const word of words) expect(ru, word).toHaveProperty([word])
  })

  it('has no entry that the site no longer shows', async () => {
    const shown = new Set([...found(/\{ text: (['"])(.+?)\1, at:/g), ...found(/\bt\((['"])(.+?)\1\)/g)])
    for (const { label, text } of STOPS) for (const line of [label, ...text]) shown.add(line)
    for (const view of Object.keys(VIEWS) as ViewId[]) {
      const { default: loaded } = await VIEWS[view]()
      for (const { title, text } of loaded.steps) for (const line of [title, ...text]) shown.add(line)
    }
    expect(Object.keys(ru).filter((key) => !shown.has(key))).toEqual([])
  })
})
