import { useEffect, useRef, useState } from 'react'
import files from '../data/narration-files.json'
import type { Translate } from '../i18n'
import type { ViewId } from '../views'

interface Props {
  view: ViewId | null
  step: number
  /** The step's card is on screen. */
  shown: boolean
  t: Translate
}

const KEY = 'narration'
const remembered = () => {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function Narration({ view, step, shown, t }: Props) {
  const [on, setOn] = useState(remembered)
  const audio = useRef<HTMLAudioElement>(null)
  const spoken = view ? (files as Record<string, string[]>)[view] : undefined
  const file = shown ? spoken?.[step] : undefined

  useEffect(() => {
    const player = audio.current
    if (!player || !on || !file) return
    player.src = `${import.meta.env.BASE_URL}narration/${file}`
    player.play().catch(() => {})
    return () => player.pause()
  }, [on, file])

  const toggle = () => {
    setOn(!on)
    try {
      localStorage.setItem(KEY, on ? 'off' : 'on')
    } catch {
      // The choice then lasts for this visit only.
    }
  }

  return (
    <>
      {spoken && (
        <button className={on ? 'narration on' : 'narration'} onClick={toggle} aria-pressed={on}>
          {on ? t('Narration on') : t('Narration off')}
        </button>
      )}
      <audio ref={audio} />
    </>
  )
}
