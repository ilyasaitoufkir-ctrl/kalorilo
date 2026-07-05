import type { ActivityLog, WhoopData, FoodLog } from '../types'

// ── Stündlicher Energie-Plan ──────────────────────────────────────────────
export interface EnergyBlock {
  time: string
  label: string
  icon: string
  color: string
  tip: string
}

export function generateEnergyPlan(whoopData: WhoopData | null): EnergyBlock[] {
  const r     = whoopData?.recovery      ?? 50
  const sleep = whoopData?.sleepDuration ?? 7
  const tired = sleep < 6 || r < 34
  const high  = r >= 67 && sleep >= 6.5

  return [
    {
      time: '07–09', icon: '🌅', color: '#f59e0b',
      label: 'Aufstehen & Frühstück',
      tip: 'Protein-reiches Frühstück → stabile Energie',
    },
    {
      time: '09–11', icon: '🧠', color: '#60a5fa',
      label: high ? 'Höchste Fokus-Zeit 🧠' : tired ? 'Fokus-Zeit (Pause erlaubt)' : 'Fokus-Zeit',
      tip: 'Kognitive Leistung am Morgen am höchsten',
    },
    {
      time: '11–12', icon: '🚶', color: '#a78bfa',
      label: 'Leichte Aktivität / Dehnen',
      tip: 'Blut in Bewegung bringen ohne zu ermüden',
    },
    {
      time: '12–13', icon: '🍱', color: '#10b981',
      label: 'Mittagessen & Pause',
      tip: 'Komplexe Carbs + Protein für Nachmittag',
    },
    {
      time: '13–15', icon: tired ? '😴' : '⚡', color: '#6b7280',
      label: tired ? 'Energie-Tief – kurze Pause empfohlen' : 'Energie-Tief',
      tip: tired ? '15min Powernap kann Defizit ausgleichen' : 'Leichte Aufgaben bevorzugen',
    },
    {
      time: '15–18', icon: '💪', color: high ? '#10b981' : tired ? '#f59e0b' : '#60a5fa',
      label: high
        ? 'Optimale Trainingszeit 💪🔥'
        : tired ? 'Leichtes Training / Spaziergang'
        : 'Gute Trainingszeit',
      tip: high
        ? `Recovery ${r}% – Vollgas! Intensives Training jetzt`
        : tired ? `Recovery ${r}% – Schone dich, leichtes Training ok`
        : `Recovery ${r}% – Moderates Training optimal`,
    },
    {
      time: '18–20', icon: '🍽️', color: '#f59e0b',
      label: 'Abendessen',
      tip: 'Leichter als Mittagessen, viel Protein',
    },
    {
      time: '20–22', icon: '🧘', color: '#a78bfa',
      label: 'Abwinden & Regeneration',
      tip: 'Kein intensives Training mehr, Strecken ok',
    },
    {
      time: '22–23', icon: '🌙', color: '#6366f1',
      label: `Schlafenszeit`,
      tip: `Ziel: ${whoopData ? Math.round(Math.max(7, Math.min(9, 8))) : 8}h Schlaf für optimale Recovery`,
    },
  ]
}

// ── Muskel-Regenerations-Tracker ──────────────────────────────────────────
export interface MuscleGroup {
  name: string
  emoji: string
  hoursNeeded: number
  pctRecovered: number  // 0–100
  ready: boolean
  lastSport?: string
}

const SPORT_TO_MUSCLES: Record<string, string[]> = {
  'Laufen':          ['Beine', 'Core'],
  'Running':         ['Beine', 'Core'],
  'Radfahren':       ['Beine', 'Core'],
  'Cycling':         ['Beine', 'Core'],
  'Schwimmen':       ['Oberkörper', 'Beine', 'Core'],
  'Krafttraining':   ['Oberkörper', 'Rücken', 'Beine'],
  'Fitness':         ['Oberkörper', 'Rücken', 'Beine'],
  'Crossfit':        ['Ganzkörper'],
  'Yoga':            ['Core'],
  'Fußball':         ['Beine', 'Core'],
  'Basketball':      ['Beine', 'Core'],
  'Tennis':          ['Oberkörper', 'Beine'],
  'Kampfsport':      ['Ganzkörper'],
  'Wandern':         ['Beine'],
  'Kettlebell':      ['Ganzkörper'],
  'Rudern':          ['Rücken', 'Arme', 'Core'],
  'Boxen':           ['Oberkörper', 'Core'],
  'Handball':        ['Oberkörper', 'Beine'],
}

const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  'Beine':       48,
  'Oberkörper':  48,
  'Rücken':      48,
  'Core':        24,
  'Arme':        48,
  'Ganzkörper':  72,
}

const MUSCLE_EMOJI: Record<string, string> = {
  'Beine': '🦵', 'Oberkörper': '💪', 'Rücken': '🏋️',
  'Core': '🎯', 'Arme': '💪', 'Ganzkörper': '⚡',
}

export function getMuscleRecovery(activityLogs: ActivityLog[]): MuscleGroup[] {
  const now     = Date.now()
  const cutoff  = now - 7 * 24 * 3600 * 1000
  const recent  = activityLogs.filter((l) => new Date(l.date).getTime() >= cutoff)

  if (recent.length === 0) return []

  // Last workout time per muscle
  const lastHit: Record<string, { ms: number; sport: string }> = {}
  recent.forEach((log) => {
    const muscles = SPORT_TO_MUSCLES[log.sport.name] ?? ['Ganzkörper']
    // approximate workout time as midnight of that day
    const ms = new Date(log.date).getTime() + (log.timestamp ? log.timestamp % 86400000 : 12 * 3600 * 1000)
    muscles.forEach((m) => {
      if (!lastHit[m] || ms > lastHit[m].ms)
        lastHit[m] = { ms, sport: log.sport.name }
    })
  })

  return Object.entries(MUSCLE_RECOVERY_HOURS)
    .filter(([m]) => lastHit[m])
    .map(([muscle, needed]) => {
      const { ms: lastMs, sport } = lastHit[muscle]
      const elapsed   = (now - lastMs) / 3600000        // hours
      const pct       = Math.min(100, Math.round((elapsed / needed) * 100))
      return {
        name: muscle,
        emoji: MUSCLE_EMOJI[muscle] ?? '💪',
        hoursNeeded: needed,
        pctRecovered: pct,
        ready: pct >= 100,
        lastSport: sport,
      }
    })
    .sort((a, b) => a.pctRecovered - b.pctRecovered) // least recovered first
}

// ── Wochentag-Muster ──────────────────────────────────────────────────────
export interface WeekdayPattern {
  day: string
  short: string
  avgCalories: number
  avgProtein: number
  workoutDays: number
  entries: number
}

export function getWeekdayPatterns(foodLogs: FoodLog[], activityLogs: ActivityLog[], days = 30): WeekdayPattern[] {
  const now   = new Date()
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }

  const DAY_NAMES = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']
  const SHORTS    = ['So','Mo','Di','Mi','Do','Fr','Sa']
  const buckets: Record<string, { cals: number[]; prot: number[]; workouts: number }> = {}
  DAY_NAMES.forEach((d) => { buckets[d] = { cals: [], prot: [], workouts: 0 } })

  dates.forEach((date) => {
    const foods = foodLogs.filter((l) => l.date === date)
    if (!foods.length) return
    const cals = foods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0)
    const prot = foods.reduce((s, f) => s + (f.macros?.protein  ?? 0), 0)
    const dayName = DAY_NAMES[new Date(date).getDay()]
    buckets[dayName].cals.push(cals)
    buckets[dayName].prot.push(prot)
    if (activityLogs.some((l) => l.date === date)) buckets[dayName].workouts++
  })

  return ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].map((day) => {
    const b = buckets[day]
    const n = b.cals.length
    const idx = DAY_NAMES.indexOf(day)
    return {
      day,
      short: SHORTS[idx],
      avgCalories: n > 0 ? Math.round(b.cals.reduce((a, x) => a + x, 0) / n) : 0,
      avgProtein:  n > 0 ? Math.round(b.prot.reduce((a, x) => a + x, 0) / n) : 0,
      workoutDays: b.workouts,
      entries: n,
    }
  })
}
