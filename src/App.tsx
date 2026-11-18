import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Hotspots, type Pin } from './components/Hotspots'
import { Narration } from './components/Narration'
import { StepCard } from './components/StepCard'
import { StopCard } from './components/StopCard'
import { STOPS } from './data/stops'
import { initialLang, LANGS, remember, translator } from './i18n'
import { parseRoute } from './route'
import { createScene, type SceneHandle } from './scene/createScene'
import { VIEWS } from './views'
import type { View, ViewInstance } from './views/types'

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const [scene, setScene] = useState<SceneHandle | null>(null)
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  const [settled, setSettled] = useState(true)
  const [lang, setLang] = useState(initialLang)
  const t = useMemo(() => translator(lang), [lang])
  const [active, setActive] = useState<{ view: View; instance: ViewInstance } | null>(null)
  const { stop } = route
  const view = active?.view
  const instance = active?.instance
  const step = view ? Math.min(route.step, view.steps.length - 1) : 0

  useEffect(() => {
    const handle = createScene(mountRef.current!)
    setScene(handle)
    return handle.dispose
  }, [])

  useEffect(() => scene?.onSettle(setSettled), [scene])

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const viewId = route.view
  useEffect(() => {
    if (!scene || !viewId) return
    let live = true
    VIEWS[viewId]().then(({ default: next }) => {
      if (live) setActive({ view: next, instance: scene.showView(next, STOPS.find((s) => s.view === viewId) ?? null)! })
    })
    return () => {
      live = false
      scene.showView(null)
      setActive(null)
    }
  }, [scene, viewId])

  useLayoutEffect(() => {
    if (!viewId) scene?.showStop(stop)
    else if (instance) scene?.showStep(step)
  }, [scene, instance, step, stop, viewId])

  useEffect(() => {
    if (!scene) return
    const updateInset = () => {
      const card = cardRef.current?.getBoundingClientRect()
      if (!card) scene.setInset({ left: 0, bottom: 0 })
      else if (card.top > window.innerHeight / 3) scene.setInset({ left: 0, bottom: window.innerHeight - card.top })
      else scene.setInset({ left: card.right, bottom: 0 })
    }
    updateInset()
    window.addEventListener('resize', updateInset)
    return () => window.removeEventListener('resize', updateInset)
  }, [scene, route, view])

  const pins = useMemo<Pin[]>(() => {
    if (instance) {
      const shown = (instance.labels ?? []).filter((label) => !label.steps || label.steps.includes(step))
      return settled ? shown.map((label) => ({ ...label, text: t(label.text) })) : []
    }
    if (!scene || route.view || !settled) return []
    return STOPS.map((s) => ({ text: t(s.label), at: s.anchor, href: s === stop ? `#/${s.id}/inside` : `#/${s.id}`, active: s === stop }))
  }, [scene, instance, step, route.view, stop, settled, t])

  return (
    <>
      <div className="scene" ref={mountRef} />
      <header className="title">
        <h1>Tree Explorer</h1>
        <p>{route.view ? t('Drag to look around.') : t('Drag to look around. Click a label to zoom in.')}</p>
      </header>
      <nav className="langs">
        {LANGS.map(({ id, label }) => (
          <button
            key={id}
            className={id === lang ? 'on' : undefined}
            aria-pressed={id === lang}
            onClick={() => {
              setLang(id)
              remember(id)
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <Narration view={view ? route.view : null} step={step} shown={settled} t={t} />
      {scene && <Hotspots scene={scene} pins={pins} cover={cardRef} />}
      {route.view
        ? view && (
            <StepCard
              key={`${route.view}/${step}`}
              steps={view.steps}
              step={step}
              stop={stop}
              waiting={!settled}
              t={t}
              ref={cardRef}
            />
          )
        : stop && <StopCard key={stop.id} stop={stop} waiting={!settled} t={t} ref={cardRef} />}
      {!stop && !route.view && settled && (
        <a className="water-button" href="#/water">
          {t('Follow the water')}
        </a>
      )}
    </>
  )
}
