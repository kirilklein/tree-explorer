// Speaks the narration texts with ElevenLabs. A text that already has its file is not spoken again.
// usage: node scripts/narrate.mjs [--dry] [--voices] [--only <view>/<step>] [--voice <id>] [--out <dir>] [--cap <chars>]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)

const { model, voice: defaultVoice, texts } = JSON.parse(readFileSync('src/data/narration.json', 'utf8'))
const voice = option('voice', defaultVoice)
const out = option('out', 'public/narration')
const cap = Number(option('cap', 12000))
const only = option('only', null)

const fileOf = (view, step, text, voiceId = defaultVoice) =>
  `${view}-${step + 1}-${createHash('sha1').update(`${model}|${voiceId}|${text}`).digest('hex').slice(0, 8)}.mp3`

const api = async (path, init = {}) => {
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${(await response.text()).slice(0, 400)}`)
  return response
}

const jobs = Object.entries(texts)
  .flatMap(([view, list]) => list.map((text, step) => ({ view, step, text, file: fileOf(view, step, text, voice) })))
  .filter(({ view, step }) => !only || only === `${view}/${step + 1}`)
const missing = jobs.filter(({ file }) => !existsSync(`${out}/${file}`))
const spend = missing.reduce((sum, { text }) => sum + text.length, 0)
console.log(`${jobs.length} texts, ${missing.length} to speak, ${spend} characters (cap ${cap}), model ${model}, voice ${voice}`)

if (flag('voices')) {
  const { voices } = await (await api('/v1/voices')).json()
  for (const v of voices) console.log(v.voice_id, '|', v.name, '|', Object.values(v.labels ?? {}).join(', '))
} else if (!flag('dry')) {
  if (spend > cap) throw new Error(`${spend} characters is over the cap of ${cap}`)
  const models = await (await api('/v1/models')).json()
  const speaking = models.filter((m) => m.can_do_text_to_speech).map((m) => m.model_id)
  if (!speaking.includes(model)) throw new Error(`no speech model "${model}"; there are: ${speaking.join(', ')}`)
  mkdirSync(out, { recursive: true })
  for (const { text, file } of missing) {
    const response = await api(`/v1/text-to-speech/${voice}?output_format=mp3_44100_96`, {
      method: 'POST',
      body: JSON.stringify({ text, model_id: model }),
    })
    writeFileSync(`${out}/${file}`, Buffer.from(await response.arrayBuffer()))
    console.log('spoke', file, text.length)
  }
  if (!only && voice === defaultVoice && out === 'public/narration') {
    const files = Object.fromEntries(Object.entries(texts).map(([view, list]) => [view, list.map((text, step) => fileOf(view, step, text))]))
    writeFileSync('src/data/narration-files.json', `${JSON.stringify(files, null, 2)}\n`)
  }
}
