import { useMemo } from 'react'
import Experience from './experience/Experience'
import Overlay from './ui/Overlay'
import { eden } from './state'

const detectTier = () => {
  // explicit override: ?tier=0|1|2 (essence / life / abundance)
  const forced = new URLSearchParams(location.search).get('tier')
  if (forced !== null && ['0', '1', '2'].includes(forced)) return Number(forced)
  const ua = navigator.userAgent
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && screen.width < 1100)
  eden.mobile = mobile
  if (mobile) return 0
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 8
  return cores >= 8 && mem >= 8 ? 2 : 1
}

export default function App() {
  useMemo(() => {
    eden.tier = detectTier()
    // ?t=0.375 — begin the journey mid-world (tests, deep links)
    const t = parseFloat(new URLSearchParams(location.search).get('t'))
    if (!Number.isNaN(t)) {
      eden.target = eden.progress = Math.min(Math.max(t, 0), 1)
    }
  }, [])
  return (
    <>
      <Experience />
      <Overlay />
    </>
  )
}
