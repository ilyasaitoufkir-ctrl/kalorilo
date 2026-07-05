import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

interface Schedule {
  hour: number
  minute: number
  title: string
  body: string
  tag: string
}

const ICON = '/icons/icon-192.png'

const BASE_SCHEDULES: Schedule[] = [
  { hour: 7,  minute: 0,  title: '🌅 Guten Morgen!',       body: 'Dein heutiger Plan ist bereit. Fang den Tag stark an!', tag: 'morning' },
  { hour: 12, minute: 0,  title: '🥗 Mittagszeit!',         body: 'Zeit für deine Mahlzeit – vergiss nicht zu tracken!',   tag: 'lunch' },
  { hour: 18, minute: 0,  title: '⚡ Abend Check-in',       body: 'Wie war dein Tag? Trag deine Aktivitäten ein!',         tag: 'evening' },
  { hour: 22, minute: 0,  title: '😴 Schlafenszeit',         body: 'Zeit zum Schlafen für optimale Recovery. Gute Nacht!', tag: 'sleep' },
  { hour: 10, minute: 0,  title: '💧 Wasser trinken!',       body: 'Hast du heute schon genug Wasser getrunken?',          tag: 'water-10' },
  { hour: 14, minute: 0,  title: '💧 Wasser trinken!',       body: 'Zwischendurch Wasser nicht vergessen! Ziel: 2500 ml',  tag: 'water-14' },
  { hour: 16, minute: 0,  title: '💧 Wasser trinken!',       body: 'Noch ein Glas Wasser – du schaffst dein Tagesziel!',   tag: 'water-16' },
  { hour: 20, minute: 0,  title: '💧 Wasser trinken!',       body: 'Letztes Glas Wasser für heute – bleib hydratisiert!',  tag: 'water-20' },
]

function msUntilNext(hour: number, minute: number): number {
  const now = new Date()
  const target = new Date()
  target.setHours(hour, minute, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)
  return target.getTime() - now.getTime()
}

function fireNotification(title: string, body: string, tag: string) {
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: ICON, tag: `kalorilo-${tag}`, silent: false })
  } catch {
    // Some browsers block Notification constructor – silently ignore
  }
}

export function useNotifications() {
  const profile  = useStore((s) => s.profile)
  const whoopData = useStore((s) => s.whoopData)
  const setupDone = useRef(false)
  const timers    = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!('Notification' in window) || setupDone.current) return
    setupDone.current = true

    const init = async () => {
      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (perm !== 'granted') return

      const name = profile?.name?.split(' ')[0] ?? ''

      function schedule(s: Schedule) {
        const body = s.tag === 'morning' && name
          ? `Guten Morgen, ${name}! ${s.body}`
          : s.body

        const timer = setTimeout(() => {
          fireNotification(s.title, body, s.tag)
          schedule(s)         // re-schedule same time tomorrow
        }, msUntilNext(s.hour, s.minute))

        timers.current.push(timer)
      }

      BASE_SCHEDULES.forEach(schedule)

      // Whoop sync notification (fires whenever whoopData changes – handled separately)
    }

    init()

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      setupDone.current = false
    }
  }, []) // run once on mount

  // Whoop sync toast (fires when new whoopData arrives)
  const prevWhoop = useRef<string | null>(null)
  useEffect(() => {
    if (!whoopData) return
    const key = `${whoopData.date}-${whoopData.recovery}`
    if (prevWhoop.current === key) return
    prevWhoop.current = key
    if (Notification.permission !== 'granted') return
    fireNotification(
      '⌚ Whoop Daten aktualisiert',
      `Recovery: ${whoopData.recovery}% · HRV: ${whoopData.hrv} ms`,
      'whoop-sync',
    )
  }, [whoopData])
}
