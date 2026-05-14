import type { UserProfile } from '../types'

export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

export function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

export function getDayName(dateStr: string): string {
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  return days[new Date(dateStr).getDay()]
}

export function getDaysUntilGoal(profile: UserProfile): number {
  return profile.targetWeeks * 7
}

export function getDaysElapsed(_profile: UserProfile, startDate?: string): number {
  if (!startDate) return 0
  const start = new Date(startDate)
  const now = new Date()
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export function getProgressPercent(current: number, goal: number): number {
  if (goal === 0) return 0
  return Math.min(100, Math.round((current / goal) * 100))
}

export function getBMI(weight: number, heightCm: number): number {
  const h = heightCm / 100
  return Math.round((weight / (h * h)) * 10) / 10
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Untergewicht'
  if (bmi < 25) return 'Normalgewicht'
  if (bmi < 30) return 'Übergewicht'
  return 'Adipositas'
}

export function getMacroTargets(calorieTarget: number) {
  return {
    protein: Math.round((calorieTarget * 0.30) / 4),
    fat: Math.round((calorieTarget * 0.25) / 9),
    carbs: Math.round((calorieTarget * 0.45) / 4),
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return formatDate(d)
  })
}

export function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return formatDate(d)
  })
}

export function waterGoal(): number {
  return 2500 // ml
}

export function motivationalQuotes(): string[] {
  return [
    'Du bist stärker als deine Ausreden! 💪',
    'Jeder Schritt zählt – auch der kleinste.',
    'Heute ist der beste Tag, um anzufangen.',
    'Fortschritt, nicht Perfektion.',
    'Du schaffst das – ein Mahlzeit nach der anderen.',
    'Dein Körper dankt dir für jeden gesunden Moment.',
    'Konsistenz schlägt Intensität. Bleib dran!',
    'Investiere in deine Gesundheit – du hast nur diesen Körper.',
    'Schwierige Wege führen zu schönen Aussichten.',
    'Jeder Tropfen Schweiß ist ein Schritt Richtung Ziel.',
    'Dein zukünftiges Ich wird dir dankbar sein.',
    'Kleine Gewohnheiten, große Ergebnisse.',
    'Stärke wächst, wenn man aufhört, es einfach zu machen.',
    'Der einzige schlechte Tag ist der, an dem du aufgibst.',
    'Sei die bessere Version von dir selbst – jeden Tag.',
  ]
}

export function getTodayQuote(): string {
  const quotes = motivationalQuotes()
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return quotes[dayOfYear % quotes.length]
}

export function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function imageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
