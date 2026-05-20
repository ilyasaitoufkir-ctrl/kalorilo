export interface Challenge {
  id: string
  emoji: string
  name: string
  desc: string
  unit: string
  target: number
  metric: 'goalMet' | 'steps' | 'water' | 'streak' | 'activityMinutes' | 'calories'
  color: string
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'kalorie_ziel',
    emoji: '🎯',
    name: 'Kalorienziel',
    desc: 'Täglich das Kalorienziel erreichen',
    unit: 'Tage',
    target: 7,
    metric: 'goalMet',
    color: '#3b82f6',
  },
  {
    id: 'schritte',
    emoji: '👟',
    name: '10.000 Schritte',
    desc: 'Täglich 10.000 Schritte gehen',
    unit: 'Schritte',
    target: 10000,
    metric: 'steps',
    color: '#10b981',
  },
  {
    id: 'wasser',
    emoji: '💧',
    name: '2L Wasser',
    desc: 'Täglich 2 Liter Wasser trinken',
    unit: 'ml',
    target: 2000,
    metric: 'water',
    color: '#0ea5e9',
  },
  {
    id: 'streak',
    emoji: '🔥',
    name: '7-Tage-Streak',
    desc: '7 Tage in Folge das Ziel erreichen',
    unit: 'Tage',
    target: 7,
    metric: 'streak',
    color: '#f59e0b',
  },
  {
    id: 'sport',
    emoji: '💪',
    name: 'Sport-Challenge',
    desc: 'Täglich mindestens 30 Min aktiv sein',
    unit: 'Minuten',
    target: 30,
    metric: 'activityMinutes',
    color: '#8b5cf6',
  },
  {
    id: 'kaloriensparen',
    emoji: '⚖️',
    name: 'Kaloriensparen',
    desc: 'Täglich unter dem Kalorienziel bleiben',
    unit: 'kcal',
    target: 0,
    metric: 'calories',
    color: '#ef4444',
  },
]
