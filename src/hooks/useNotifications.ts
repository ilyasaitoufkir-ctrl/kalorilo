import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

const ICON = '/icons/icon-192.png'

function notify(title: string, body: string, tag: string) {
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: ICON, tag: `kalorilo-${tag}` })
  } catch { /* ignore */ }
}

function msUntilNext(hour: number, minute: number): number {
  const now    = new Date()
  const target = new Date()
  target.setHours(hour, minute, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)
  return target.getTime() - now.getTime()
}

function buildSmartNotification(
  hour: number,
  minute: number,
): { title: string; body: string; tag: string } | null {
  const s = useStore.getState()
  const { profile, foodLogs, waterLogs, activityLogs, whoopData } = s
  if (!profile) return null

  const today      = new Date().toISOString().split('T')[0]
  const foods      = foodLogs.filter((l) => l.date === today)
  const water      = waterLogs.find((w) => w.date === today)?.amount ?? 0
  const acts       = activityLogs.filter((l) => l.date === today)

  const calories   = Math.round(foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0))
  const protein    = Math.round(foods.reduce((s, f) => s + (f.macros?.protein  ?? 0), 0))
  const wt = Number(profile.weight)||75, ht = Number(profile.height)||175, ag = Number(profile.age)||25
  const bmr  = profile.gender === 'male' ? 10*wt+6.25*ht-5*ag+5 : 10*wt+6.25*ht-5*ag-161
  const mlt: Record<string,number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }
  const target     = Math.round(bmr * (mlt[profile.activityLevel] ?? 1.55))
  const wGoal      = 2500
  const protGoal   = Math.round(wt * 2)
  const remaining  = target - calories
  const wLeft      = wGoal - water
  const protLeft   = protGoal - protein
  const name       = profile.name.split(' ')[0]
  const recovery   = whoopData?.recovery ?? 50
  const hasTracked = foods.length > 0
  const hasTrainedToday = acts.length > 0

  // Check 3 consecutive days without training
  const noTraining3Days = [-1, -2, -3].map((d) => {
    const dd = new Date(); dd.setDate(dd.getDate() + d)
    return dd.toISOString().split('T')[0]
  }).every((date) => !activityLogs.some((l) => l.date === date))

  const key = `${hour}:${minute}`
  switch (key) {
    case '7:0':
      return {
        title: '🌅 Guten Morgen!',
        body: `Guten Morgen, ${name}! Dein Tagesplan ist bereit 💪`,
        tag: 'morning',
      }
    case '8:0':
      return {
        title: '🍳 Zeit für Frühstück!',
        body: `${name}, Frühstücksziel: ca. ${Math.round(target * 0.25)} kcal`,
        tag: 'breakfast',
      }
    case '10:0': {
      if (water < 300)
        return { title: '💧 Hast du schon getrunken?', body: 'Ziel: 500ml bis jetzt. Trink ein großes Glas!', tag: 'water-10' }
      return { title: '💧 Wasser-Check', body: `${water}ml getrunken – weiter so! Ziel: ${wGoal}ml`, tag: 'water-10' }
    }
    case '12:30': {
      if (!hasTracked)
        return { title: '⚠️ Noch nichts eingetragen!', body: `${name}, du hast heute noch nichts getrackt. Frühstück vergessen?`, tag: 'no-track-lunch' }
      return {
        title: '🍱 Mittagessen!',
        body: remaining > 0
          ? `${name}, noch ${remaining} kcal übrig`
          : `Kalorien fast erreicht – bewusst beim Mittag!`,
        tag: 'lunch',
      }
    }
    case '14:0':
      return {
        title: '💧 Wasser Erinnerung',
        body: water >= 1500
          ? `${water}ml – gut! Noch ${wLeft}ml bis zum Ziel`
          : `Erst ${water}ml – Ziel: 1.5L bis jetzt trinken`,
        tag: 'water-14',
      }
    case '16:0': {
      if (recovery >= 80)
        return { title: '🔥 Top Recovery!', body: `Recovery ${recovery}% – perfekter Tag für intensives Training!`, tag: 'train-high' }
      if (recovery < 34)
        return { title: '😴 Ruhetag empfohlen', body: `Recovery nur ${recovery}% – schone dich, ${name}. Spaziergang statt Sport!`, tag: 'train-low' }
      if (noTraining3Days && !hasTrainedToday)
        return { title: '💪 Zeit zu trainieren!', body: `${name}, 3 Tage kein Training – dein Körper ist bereit!`, tag: 'train-3days' }
      return { title: '💪 Optimale Trainingszeit!', body: `Recovery ${recovery}% – jetzt ist deine optimale Trainingszeit`, tag: 'train-moderate' }
    }
    case '19:0': {
      if (remaining > 300)
        return { title: '🍽️ Abendessen – Spielraum da!', body: `Noch ${remaining} kcal übrig, ${name}`, tag: 'dinner-under' }
      if (remaining < -150)
        return { title: '🍽️ Abendessen – Achtung!', body: `Schon ${Math.abs(remaining)} kcal drüber – leichte Kost heute Abend`, tag: 'dinner-over' }
      return { title: '🍽️ Abendessen', body: `Noch ${remaining} kcal übrig – gute Entscheidungen!`, tag: 'dinner' }
    }
    case '21:30': {
      if (!hasTracked)
        return { title: '⚠️ Nichts eingetragen heute!', body: `${name}, du hast heute noch keine Mahlzeit erfasst. 5min Nacherfassen?`, tag: 'no-track-eve' }
      if (protLeft > 30)
        return { title: '💪 Protein fehlt!', body: `Noch ${protLeft}g Protein bis zum Ziel – Proteinshake jetzt?`, tag: 'protein-eve' }
      if (wLeft > 500)
        return { title: '💧 Wasser fehlt noch!', body: `Noch ${wLeft}ml bis ${wGoal}ml – trink jetzt noch etwas!`, tag: 'water-eve' }
      return { title: '😴 Bald Schlafenszeit', body: `${name}, letzte Chance zur Mahlzeit – dann bald schlafen!`, tag: 'bedtime-soon' }
    }
    case '22:30':
      return { title: '🌙 Zeit zum Schlafen!', body: `${name}, für optimale Recovery jetzt schlafen gehen. Gute Nacht! 💤`, tag: 'sleep' }
    default:
      return null
  }
}

const SCHEDULE: Array<[number, number]> = [
  [7, 0], [8, 0], [10, 0], [12, 30],
  [14, 0], [16, 0], [19, 0], [21, 30], [22, 30],
]

const PROTEIN_GOAL = 170

const PROTEIN_SCHEDULE: Array<[number, number]> = [
  [7, 30], [10, 0], [12, 0], [14, 0], [17, 0], [19, 0], [20, 30], [22, 0],
]

function buildProteinNotification(
  hour: number,
  minute: number,
): { title: string; body: string; tag: string } | null {
  const today   = new Date().toISOString().split('T')[0]
  const protein = Math.round(
    useStore.getState().foodLogs
      .filter((l) => l.date === today)
      .reduce((s, f) => s + (f.macros?.protein ?? 0), 0)
  )
  const remaining = Math.max(0, PROTEIN_GOAL - protein)
  const key = `${hour}:${minute}`

  switch (key) {
    case '7:30':
      if (protein < 10)
        return { title: '🌅 Protein-Start!', body: `Heute Ziel: ${PROTEIN_GOAL}g Protein. Empfehlung: 4 Eier + 200g Skyr = 55g 💪`, tag: 'protein-730' }
      return null
    case '10:0':
      if (protein < 30)
        return { title: '⚡ Protein-Check 10h', body: `Erst ${protein}g! Noch ${remaining}g fehlen. Jetzt: 250g Magerquark = 28g`, tag: 'protein-10' }
      return null
    case '12:0':
      if (protein < 50)
        return { title: '🍗 Mittagszeit!', body: `Erst ${protein}g Protein. Noch ${remaining}g! Jetzt 250g Hähnchenbrust = 55g!`, tag: 'protein-12' }
      return null
    case '14:0':
      if (protein < 85)
        return { title: '⏰ Halbzeit Protein!', body: `Erst ${protein}g von ${PROTEIN_GOAL}g. Noch ${remaining}g – jetzt nachlegen!`, tag: 'protein-14' }
      return null
    case '17:0':
      if (protein < 120)
        return { title: '🚨 Protein-Alarm!', body: `Noch ${remaining}g bis 22 Uhr! Proteinshake oder 200g Thunfisch. Jetzt! 💪`, tag: 'protein-17' }
      return null
    case '19:0':
      if (protein < 140)
        return { title: '🍽️ Abendessen – Protein', body: `Noch ${remaining}g Protein. Empfehlung: 200g Lachs + 250g Magerquark!`, tag: 'protein-19' }
      return null
    case '20:30':
      if (protein < 155)
        return { title: '⚠️ Letzte Chance!', body: `Noch ${remaining}g Protein! Magerquark, Shake oder Hüttenkäse – jetzt!`, tag: 'protein-2030' }
      return null
    case '22:0':
      return {
        title: protein >= PROTEIN_GOAL ? '🏆 Protein-Ziel erreicht!' : '📊 Protein Tagesabschluss',
        body:  protein >= PROTEIN_GOAL
          ? `${protein}g Protein heute! Perfekt für Muskelaufbau! 🔥`
          : `Heute ${protein}g von ${PROTEIN_GOAL}g. ${remaining}g gefehlt. Morgen früher starten!`,
        tag: 'protein-22',
      }
    default:
      return null
  }
}

export function useNotifications() {
  const whoopData   = useStore((s) => s.whoopData)
  const foodLogsLen = useStore((s) => s.foodLogs.length)
  const setupDone   = useRef(false)
  const timers      = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevWhoop   = useRef<string | null>(null)
  const prevFoodLen = useRef(-1)

  useEffect(() => {
    if (!('Notification' in window) || setupDone.current) return
    setupDone.current = true

    const init = async () => {
      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (perm !== 'granted') return

      function schedule(hour: number, minute: number) {
        const timer = setTimeout(() => {
          const n = buildSmartNotification(hour, minute)
          if (n) notify(n.title, n.body, n.tag)
          schedule(hour, minute) // re-schedule for tomorrow
        }, msUntilNext(hour, minute))
        timers.current.push(timer)
      }

      SCHEDULE.forEach(([h, m]) => schedule(h, m))

      // Protein schedule (separate loop)
      function scheduleProtein(hour: number, minute: number) {
        const timer = setTimeout(() => {
          const n = buildProteinNotification(hour, minute)
          if (n) notify(n.title, n.body, n.tag)
          scheduleProtein(hour, minute)
        }, msUntilNext(hour, minute))
        timers.current.push(timer)
      }
      PROTEIN_SCHEDULE.forEach(([h, m]) => scheduleProtein(h, m))

      // Immediate recovery alert on app open
      const r = useStore.getState().whoopData?.recovery
      const nm = useStore.getState().profile?.name?.split(' ')[0] ?? ''
      if (r !== undefined) {
        if (r >= 80)
          notify('🔥 Top Recovery!', `${r}% – perfekter Tag für intensives Training!`, 'whoop-high-open')
        else if (r < 34)
          notify('⚠️ Niedrige Recovery', `${r}% – Ruhetag empfohlen, ${nm}. Schone dich!`, 'whoop-low-open')
      }
    }

    init()

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      setupDone.current = false
    }
  }, [])

  // After-meal protein notification
  useEffect(() => {
    if (prevFoodLen.current === -1) { prevFoodLen.current = foodLogsLen; return }
    if (foodLogsLen <= prevFoodLen.current) { prevFoodLen.current = foodLogsLen; return }
    prevFoodLen.current = foodLogsLen
    if (Notification.permission !== 'granted') return
    const today   = new Date().toISOString().split('T')[0]
    const protein = Math.round(
      useStore.getState().foodLogs
        .filter((l) => l.date === today)
        .reduce((s, f) => s + (f.macros?.protein ?? 0), 0)
    )
    if (protein === 0) return
    const remaining = Math.max(0, PROTEIN_GOAL - protein)
    if (remaining > 100)
      notify('✅ Mahlzeit getrackt!', `Noch ${remaining}g Protein heute. Nächste Mahlzeit in 2–3h einplanen!`, 'after-meal')
    else if (remaining > 50)
      notify('💪 Gut gemacht!', `Noch ${remaining}g Protein. Du schaffst das!`, 'after-meal')
    else if (remaining > 0)
      notify('🎯 Fast am Ziel!', `Nur noch ${remaining}g Protein! Ein Shake reicht!`, 'after-meal')
    else
      notify('🏆 Protein-Ziel erreicht!', `${protein}g Protein heute! Ernährungs-Score: Ausgezeichnet! 🔥`, 'protein-goal')
  }, [foodLogsLen])

  // Whoop sync notification
  useEffect(() => {
    if (!whoopData) return
    const key = `${whoopData.date}-${whoopData.recovery}`
    if (prevWhoop.current === key) return
    prevWhoop.current = key
    if (Notification.permission !== 'granted') return
    notify(
      '⌚ Whoop Daten aktualisiert',
      `Recovery: ${whoopData.recovery}% · HRV: ${whoopData.hrv}ms · Schlaf: ${whoopData.sleepQuality}%`,
      'whoop-sync',
    )
  }, [whoopData])
}
