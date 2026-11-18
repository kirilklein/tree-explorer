import type { Ref } from 'react'
import type { Stop } from '../data/stops'
import type { Translate } from '../i18n'

interface Props {
  stop: Stop
  waiting: boolean
  t: Translate
  ref: Ref<HTMLElement>
}

export function StopCard({ stop, waiting, t, ref }: Props) {
  return (
    <article className={waiting ? 'card waiting' : 'card'} ref={ref}>
      <a className="close" href="#/" aria-label={t('Back to the whole tree')}>
        ×
      </a>
      <h2>{t(stop.label)}</h2>
      {stop.text.map((line) => (
        <p key={line}>{t(line)}</p>
      ))}
      <nav className="steps">
        <a href={`#/${stop.id}/inside`}>{t('Go inside')}</a>
      </nav>
    </article>
  )
}
