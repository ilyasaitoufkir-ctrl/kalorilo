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
  kettlebell?: boolean   // shows kettlebell weight selector
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
  // Extended fields added in v2
  sleepDuration?: number   // hours
  deepSleep?: number       // hours (slow-wave sleep)
  remSleep?: number        // hours
  respiratoryRate?: number // breaths/min
  caloriesBurned?: number  // kcal from workouts
  dailyBurn?: number       // kcal total from cycle
}

export interface WhoopDayHistory {
  date: string
  recovery: number
  hrv: number
  sleepQuality: number
  sleepDuration: number
  strain: number
  caloriesBurned: number
  dailyBurn?: number   // total cycle burn incl. NEAT (from /cycle endpoint)
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

export interface BodyAnalysis {
  bodyFatRange: string
  muscleScore: number          // 1–10
  bodyType: string             // Ektomorph / Mesomorph / Endomorph
  strengths: string[]
  improvements: string[]
  recommendation: string
  // legacy compat
  muscleTonus?: string
  fitnessLevel?: string
  observations?: string[]
  recommendations?: string[]
}

export interface BeforeAfterPhoto {
  id: string
  date: string
  photo: string
  weight?: number
  note?: string
  analysis?: BodyAnalysis
}


export type TabId = 'home' | 'food' | 'sport' | 'stats' | 'ai' | 'profile' | 'friends'

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

// ── Kalo AI Companion ──────────────────────────────────────────────────────
export interface UserPersonality {
  favoriteFoods: string[]
  weaknesses: string[]           // z.B. "abends Süßigkeiten"
  stressEatingPattern: boolean
  hungerTimes: string[]
  motivations: string[]
  successPatterns: string[]
  failPatterns: string[]
  moodHistory: { date: string; mood: string; note?: string }[]
  dailyQuestion: string
  dailyQuestionDate: string
}

// ── Extended coaching profile (from 8-step onboarding) ────────────────────
export interface CoachingProfile {
  mainGoals: string[]
  dietType: string
  mealsPerDay: number
  eatsBreakfast: boolean
  mealTimes: string
  favoriteFoods: string
  dislikedFoods: string
  allergies: string
  alcoholConsumption: string
  caffeineLevel: string
  trainingDaysPerWeek: number
  sportTypes: string[]
  trainingDurationMin: number
  trainingTime: string
  trainingIntensity: string
  sleepTime: string
  wakeTime: string
  sleepQualityRating: string
  naps: boolean
  sleepDisruptors: string
  healthLimitations: string
  currentSupplements: string
  stressLevel: string
  dailySittingHours: string
  workType: string
  whoopUsageDuration: string
  avgRecovery: string
  avgHrv: string
  whoopGoals: string
  healthMotivation: string
  pastFailures: string
  motivationStyle: string
  disciplineLevel: string
  biggestChallenge: string
  aiPersonalizationSummary?: string
  completedAt: number
}

export const DEFAULT_PERSONALITY: UserPersonality = {
  favoriteFoods: [],
  weaknesses: [],
  stressEatingPattern: false,
  hungerTimes: [],
  motivations: [],
  successPatterns: [],
  failPatterns: [],
  moodHistory: [],
  dailyQuestion: '',
  dailyQuestionDate: '',
}

// ── Precise Photo Scanner ──────────────────────────────────────────────────
export interface PlateIngredient {
  name: string
  weight_g: number
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number   // 0–1
}

export interface DetailedPlateAnalysis {
  dish: string
  ingredients: PlateIngredient[]
  total: { calories: number; protein: number; carbs: number; fat: number }
  confidence_overall: number
  notes: string
}
