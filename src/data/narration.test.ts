import { describe, expect, it } from 'vitest'
import { VIEWS, type ViewId } from '../views'
import files from './narration-files.json'
import narration from './narration.json'

const { model, voice, texts } = narration
const spoken = Object.keys(import.meta.glob('/public/narration/*.mp3')).map((path) => path.split('/').at(-1))

async function fileOf(view: string, step: number, text: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${model}|${voice}|${text}`))
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${view}-${step + 1}-${hex.slice(0, 8)}.mp3`
}

describe.each(Object.keys(VIEWS) as ViewId[])('the narration of the %s view', (view) => {
  it('has one text for each step', async () => {
    const { default: loaded } = await VIEWS[view]()
    expect(texts[view].length).toBe(loaded.steps.length)
  })

  it('lists only sound files that were spoken from the current text', async () => {
    const listed = (files as Record<string, string[]>)[view] ?? []
    for (const [step, file] of listed.entries()) {
      expect(file).toBe(await fileOf(view, step, texts[view][step]))
      expect(spoken).toContain(file)
    }
  })
})
