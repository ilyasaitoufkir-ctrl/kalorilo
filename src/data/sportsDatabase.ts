import type { SportActivity } from '../types'

export const SPORTS_DATABASE: SportActivity[] = [
  { id: 'sp1', name: 'Laufen', icon: '🏃', metLight: 7.0, metMedium: 9.8, metIntense: 12.8, category: 'Ausdauer' },
  { id: 'sp2', name: 'Krafttraining', icon: '🏋️', metLight: 3.0, metMedium: 5.0, metIntense: 6.0, category: 'Kraft' },
  { id: 'sp3', name: 'Radfahren', icon: '🚴', metLight: 4.0, metMedium: 8.0, metIntense: 12.0, category: 'Ausdauer' },
  { id: 'sp4', name: 'Schwimmen', icon: '🏊', metLight: 5.8, metMedium: 8.3, metIntense: 10.0, category: 'Ausdauer' },
  { id: 'sp5', name: 'Fußball', icon: '⚽', metLight: 5.0, metMedium: 7.0, metIntense: 10.0, category: 'Mannschaft' },
  { id: 'sp6', name: 'Basketball', icon: '🏀', metLight: 4.5, metMedium: 6.5, metIntense: 8.0, category: 'Mannschaft' },
  { id: 'sp7', name: 'Tennis', icon: '🎾', metLight: 4.5, metMedium: 6.0, metIntense: 8.0, category: 'Rückschlag' },
  { id: 'sp8', name: 'Volleyball', icon: '🏐', metLight: 3.0, metMedium: 4.0, metIntense: 6.0, category: 'Mannschaft' },
  { id: 'sp9', name: 'Boxen', icon: '🥊', metLight: 6.0, metMedium: 9.0, metIntense: 12.8, category: 'Kampfsport' },
  { id: 'sp10', name: 'Yoga', icon: '🧘', metLight: 2.5, metMedium: 3.3, metIntense: 4.0, category: 'Flexibilität' },
  { id: 'sp11', name: 'Pilates', icon: '🤸', metLight: 3.0, metMedium: 3.8, metIntense: 4.8, category: 'Flexibilität' },
  { id: 'sp12', name: 'HIIT', icon: '⚡', metLight: 7.0, metMedium: 10.0, metIntense: 14.0, category: 'Kraft' },
  { id: 'sp13', name: 'CrossFit', icon: '🔥', metLight: 7.0, metMedium: 9.0, metIntense: 12.0, category: 'Kraft' },
  { id: 'sp14', name: 'Klettern', icon: '🧗', metLight: 5.0, metMedium: 7.5, metIntense: 9.5, category: 'Kraft' },
  { id: 'sp15', name: 'Wandern', icon: '🥾', metLight: 3.5, metMedium: 5.5, metIntense: 7.0, category: 'Ausdauer' },
  { id: 'sp16', name: 'Skifahren', icon: '⛷️', metLight: 5.0, metMedium: 7.0, metIntense: 9.0, category: 'Winter' },
  { id: 'sp17', name: 'Kampfsport', icon: '🥋', metLight: 5.0, metMedium: 7.5, metIntense: 10.5, category: 'Kampfsport' },
  { id: 'sp18', name: 'Tanzen', icon: '💃', metLight: 3.0, metMedium: 5.0, metIntense: 7.5, category: 'Ausdauer' },
  { id: 'sp19', name: 'Rudern', icon: '🚣', metLight: 4.8, metMedium: 7.0, metIntense: 9.8, category: 'Ausdauer' },
  { id: 'sp20', name: 'Surfen', icon: '🏄', metLight: 3.0, metMedium: 5.0, metIntense: 7.0, category: 'Wasser' },
  { id: 'sp21', name: 'Badminton', icon: '🏸', metLight: 4.5, metMedium: 5.5, metIntense: 7.0, category: 'Rückschlag' },
  { id: 'sp22', name: 'Tischtennis', icon: '🏓', metLight: 3.0, metMedium: 4.0, metIntense: 5.5, category: 'Rückschlag' },
  { id: 'sp23', name: 'Spazierengehen', icon: '🚶', metLight: 2.5, metMedium: 3.5, metIntense: 4.5, category: 'Ausdauer' },
  { id: 'sp24', name: 'Spinning', icon: '🚲', metLight: 6.8, metMedium: 8.5, metIntense: 11.0, category: 'Ausdauer' },
  { id: 'sp25', name: 'Aerobic', icon: '🏋️‍♀️', metLight: 5.0, metMedium: 6.5, metIntense: 8.5, category: 'Ausdauer' },
  { id: 'sp26', name: 'Skateboarden', icon: '🛹', metLight: 3.0, metMedium: 4.5, metIntense: 6.0, category: 'Ausdauer' },
  { id: 'sp27', name: 'Handball', icon: '🤾', metLight: 5.0, metMedium: 8.0, metIntense: 10.0, category: 'Mannschaft' },
  { id: 'sp28', name: 'Golf', icon: '⛳', metLight: 3.5, metMedium: 4.3, metIntense: 5.0, category: 'Präzision' },
  { id: 'sp29', name: 'Springseil', icon: '🪢', metLight: 8.0, metMedium: 10.0, metIntense: 13.0, category: 'Ausdauer' },
  { id: 'sp30', name: 'Hometrainer', icon: '🛞', metLight: 3.5, metMedium: 5.5, metIntense: 8.0, category: 'Ausdauer' },
]

export function calculateCaloriesBurned(
  weightKg: number,
  durationMin: number,
  met: number
): number {
  return Math.round((met * 3.5 * weightKg * durationMin) / (200))
}

export const SPORT_CATEGORIES = [...new Set(SPORTS_DATABASE.map((s) => s.category))]
