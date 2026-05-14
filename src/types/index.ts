export type Gender = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Goal = 'lose' | 'maintain' | 'gain'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Intensity = 'light' | 'medium' | 'intense'

export interface UserProfile {
  name: string
  age: number
  weight: number      // kg
  height: number      // cm
  gender: Gender
  activityLevel: ActivityLevel
  targetWeight: number
  targetWeeks: number
  goal: Goal
  profilePhoto?: string
}

export interface Macros {
  calories: number
  protein: number     // g
  fat: number         // g
  carbs: number       // g
  fiber?: number      // g
}

export interface FoodItem {
  id: string
  name: string
  brand?: string
  category: string
  macros: Macros      // per 100g
  serving?: number    // default serving in g
  barcode?: string
}

export interface FoodLog {
  id: string
  date: string        // ISO date
  mealType: MealType
  foodItem: FoodItem
  amount: number      // g
  macros: Macros      // calculated
  timestamp: number
  aiEstimated?: boolean
}

export interface SportActivity {
  id: string
  name: string
  icon: string
  metLight: number
  metMedium: number
  metIntense: number
  category: string
}

export interface ActivityLog {
  id: string
  date: string
  sport: SportActivity
  duration: number    // minutes
  intensity: Intensity
  caloriesBurned: number
  steps?: number
  timestamp: number
}

export interface WeightEntry {
  date: string
  weight: number
}

export interface WaterLog {
  date: string
  amount: number      // ml
}

export interface DailyStats {
  date: string
  totalCalories: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
  caloriesBurned: number
  waterAmount: number
  steps: number
  goalMet: boolean
}

export interface CustomRecipe {
  id: string
  name: string
  ingredients: { foodItem: FoodItem; amount: number }[]
  totalMacros: Macros
  servings: number
  photo?: string
  createdAt: number
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface WhoopData {
  recovery: number        // 0–100
  hrv: number             // ms
  restingHR: number
  sleepQuality: number    // 0–100
  strain: number          // 0–21
  date: string
}

export interface ApiKeys {
  anthropic: string
  openai: string
  spoonacular: string
  whoopClientId: string
  whoopClientSecret: string
  whoopAccessToken: string
}

export interface Reminder {
  id: string
  time: string            // HH:MM
  label: string
  enabled: boolean
}

export interface CheatDay {
  date: string
  note?: string
}

export interface BeforeAfterPhoto {
  id: string
  date: string
  photo: string
  weight?: number
  note?: string
}

export type TabId = 'home' | 'food' | 'sport' | 'stats' | 'ai' | 'profile'

export interface WeeklyPlan {
  id: string
  createdAt: number
  days: {
    day: string
    meals: { mealType: MealType; description: string; calories: number; protein: number; carbs: number; fat: number }[]
    totalCalories: number
  }[]
  shoppingList: string[]
}

export interface FridgeScanResult {
  ingredients: string[]
  rawResponse: string
}
