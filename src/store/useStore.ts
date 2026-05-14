import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  UserProfile, FoodLog, ActivityLog, WeightEntry, WaterLog,
  CustomRecipe, AIMessage, WhoopData, ApiKeys, Reminder,
  CheatDay, BeforeAfterPhoto, WeeklyPlan, TabId, DailyStats
} from '../types'

interface AppState {
  // Navigation
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  // Dark mode
  darkMode: 'auto' | 'light' | 'dark'
  setDarkMode: (m: 'auto' | 'light' | 'dark') => void

  // Apple Health / Steps
  stepsToday: number
  setStepsToday: (steps: number) => void
  healthCalories: number
  setHealthCalories: (cal: number) => void

  // Profile
  profile: UserProfile | null
  setProfile: (p: UserProfile) => void

  // API Keys
  apiKeys: ApiKeys
  setApiKeys: (keys: Partial<ApiKeys>) => void

  // Food logs
  foodLogs: FoodLog[]
  addFoodLog: (log: FoodLog) => void
  removeFoodLog: (id: string) => void

  // Activity logs
  activityLogs: ActivityLog[]
  addActivityLog: (log: ActivityLog) => void
  removeActivityLog: (id: string) => void

  // Weight history
  weightHistory: WeightEntry[]
  addWeightEntry: (entry: WeightEntry) => void

  // Water
  waterLogs: WaterLog[]
  addWater: (date: string, amount: number) => void
  getWaterForDate: (date: string) => number

  // Custom recipes
  customRecipes: CustomRecipe[]
  addCustomRecipe: (recipe: CustomRecipe) => void
  removeCustomRecipe: (id: string) => void

  // AI chat history
  aiMessages: AIMessage[]
  addAIMessage: (msg: AIMessage) => void
  clearAIMessages: () => void

  // Whoop
  whoopData: WhoopData | null
  setWhoopData: (data: WhoopData) => void

  // Reminders
  reminders: Reminder[]
  setReminders: (r: Reminder[]) => void

  // Cheat days
  cheatDays: CheatDay[]
  addCheatDay: (d: CheatDay) => void
  removeCheatDay: (date: string) => void

  // Before/After photos
  beforeAfterPhotos: BeforeAfterPhoto[]
  addBeforeAfterPhoto: (p: BeforeAfterPhoto) => void
  removeBeforeAfterPhoto: (id: string) => void

  // Weekly plans
  weeklyPlans: WeeklyPlan[]
  addWeeklyPlan: (plan: WeeklyPlan) => void

  // Selectors
  getFoodLogsForDate: (date: string) => FoodLog[]
  getActivityLogsForDate: (date: string) => ActivityLog[]
  getStatsForDate: (date: string) => DailyStats
  getStreak: () => number
  getDailyCalorieTarget: () => number
}

const defaultApiKeys: ApiKeys = {
  anthropic: import.meta.env.VITE_ANTHROPIC_KEY ?? '',
  openai: import.meta.env.VITE_OPENAI_KEY ?? '',
  spoonacular: '',
  whoopClientId: '',
  whoopClientSecret: '',
  whoopAccessToken: '',
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),

      darkMode: 'auto',
      setDarkMode: (m) => set({ darkMode: m }),

      stepsToday: 0,
      setStepsToday: (steps) => set({ stepsToday: steps }),
      healthCalories: 0,
      setHealthCalories: (cal) => set({ healthCalories: cal }),

      profile: null,
      setProfile: (profile) => set({ profile }),

      apiKeys: defaultApiKeys,
      setApiKeys: (keys) => set((s) => ({ apiKeys: { ...s.apiKeys, ...keys } })),

      foodLogs: [],
      addFoodLog: (log) => set((s) => ({ foodLogs: [...s.foodLogs, log] })),
      removeFoodLog: (id) => set((s) => ({ foodLogs: s.foodLogs.filter((l) => l.id !== id) })),

      activityLogs: [],
      addActivityLog: (log) => set((s) => ({ activityLogs: [...s.activityLogs, log] })),
      removeActivityLog: (id) => set((s) => ({ activityLogs: s.activityLogs.filter((l) => l.id !== id) })),

      weightHistory: [],
      addWeightEntry: (entry) =>
        set((s) => {
          const filtered = s.weightHistory.filter((w) => w.date !== entry.date)
          return { weightHistory: [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date)) }
        }),

      waterLogs: [],
      addWater: (date, amount) =>
        set((s) => {
          const existing = s.waterLogs.find((w) => w.date === date)
          if (existing) {
            return { waterLogs: s.waterLogs.map((w) => w.date === date ? { ...w, amount: w.amount + amount } : w) }
          }
          return { waterLogs: [...s.waterLogs, { date, amount }] }
        }),
      getWaterForDate: (date) => get().waterLogs.find((w) => w.date === date)?.amount ?? 0,

      customRecipes: [],
      addCustomRecipe: (recipe) => set((s) => ({ customRecipes: [...s.customRecipes, recipe] })),
      removeCustomRecipe: (id) => set((s) => ({ customRecipes: s.customRecipes.filter((r) => r.id !== id) })),

      aiMessages: [],
      addAIMessage: (msg) => set((s) => ({ aiMessages: [...s.aiMessages, msg] })),
      clearAIMessages: () => set({ aiMessages: [] }),

      whoopData: null,
      setWhoopData: (data) => set({ whoopData: data }),

      reminders: [
        { id: '1', time: '08:00', label: 'Frühstück eintragen', enabled: true },
        { id: '2', time: '12:30', label: 'Mittagessen eintragen', enabled: true },
        { id: '3', time: '19:00', label: 'Abendessen eintragen', enabled: true },
      ],
      setReminders: (reminders) => set({ reminders }),

      cheatDays: [],
      addCheatDay: (d) => set((s) => ({ cheatDays: [...s.cheatDays.filter((c) => c.date !== d.date), d] })),
      removeCheatDay: (date) => set((s) => ({ cheatDays: s.cheatDays.filter((c) => c.date !== date) })),

      beforeAfterPhotos: [],
      addBeforeAfterPhoto: (p) => set((s) => ({ beforeAfterPhotos: [...s.beforeAfterPhotos, p] })),
      removeBeforeAfterPhoto: (id) => set((s) => ({ beforeAfterPhotos: s.beforeAfterPhotos.filter((p) => p.id !== id) })),

      weeklyPlans: [],
      addWeeklyPlan: (plan) => set((s) => ({ weeklyPlans: [plan, ...s.weeklyPlans.slice(0, 4)] })),

      getFoodLogsForDate: (date) => get().foodLogs.filter((l) => l.date === date),
      getActivityLogsForDate: (date) => get().activityLogs.filter((l) => l.date === date),

      getStatsForDate: (date) => {
        const foods = get().getFoodLogsForDate(date)
        const activities = get().getActivityLogsForDate(date)
        const water = get().getWaterForDate(date)
        const totalCalories = foods.reduce((s, f) => s + f.macros.calories, 0)
        const caloriesBurned = activities.reduce((s, a) => s + a.caloriesBurned, 0)
        const target = get().getDailyCalorieTarget()
        return {
          date,
          totalCalories,
          totalProtein: foods.reduce((s, f) => s + f.macros.protein, 0),
          totalFat: foods.reduce((s, f) => s + f.macros.fat, 0),
          totalCarbs: foods.reduce((s, f) => s + f.macros.carbs, 0),
          caloriesBurned,
          waterAmount: water,
          steps: activities.reduce((s, a) => s + (a.steps ?? 0), 0),
          goalMet: Math.abs((totalCalories - caloriesBurned) - target) <= 200,
        }
      },

      getStreak: () => {
        const today = new Date().toISOString().split('T')[0]
        let streak = 0
        let d = new Date()
        while (true) {
          const dateStr = d.toISOString().split('T')[0]
          const stats = get().getStatsForDate(dateStr)
          if (stats.goalMet || dateStr === today) {
            if (stats.goalMet) streak++
            else break
          } else break
          d.setDate(d.getDate() - 1)
          if (streak > 365) break
        }
        return streak
      },

      getDailyCalorieTarget: () => {
        const { profile } = get()
        if (!profile) return 2000
        const { age, weight, height, gender, activityLevel, goal, targetWeight, targetWeeks } = profile
        // Mifflin-St Jeor
        const bmr = gender === 'male'
          ? 10 * weight + 6.25 * height - 5 * age + 5
          : 10 * weight + 6.25 * height - 5 * age - 161
        const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
        const tdee = bmr * activityMultipliers[activityLevel]
        const weeklyDelta = (weight - targetWeight) * 7700 / (targetWeeks || 12)
        if (goal === 'lose') return Math.max(1200, Math.round(tdee - weeklyDelta / 7))
        if (goal === 'gain') return Math.round(tdee + Math.abs(weeklyDelta) / 7)
        return Math.round(tdee)
      },
    }),
    {
      name: 'kalorilo-store',
      // Nach der Hydration: env-Keys einsetzen falls im Store leer
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const envAnth = import.meta.env.VITE_ANTHROPIC_KEY ?? ''
        const envOAI  = import.meta.env.VITE_OPENAI_KEY ?? ''
        if (envAnth && !state.apiKeys.anthropic) state.apiKeys.anthropic = envAnth
        if (envOAI  && !state.apiKeys.openai)    state.apiKeys.openai    = envOAI
        // Migrate old 'dashboard' tab to 'home'
        if ((state.activeTab as string) === 'dashboard') state.activeTab = 'home'
        if ((state.activeTab as string) === 'fridge') state.activeTab = 'ai'
      },
      partialize: (state) => ({
        darkMode: state.darkMode,
        stepsToday: state.stepsToday,
        healthCalories: state.healthCalories,
        profile: state.profile,
        apiKeys: state.apiKeys,
        foodLogs: state.foodLogs,
        activityLogs: state.activityLogs,
        weightHistory: state.weightHistory,
        waterLogs: state.waterLogs,
        customRecipes: state.customRecipes,
        aiMessages: state.aiMessages,
        whoopData: state.whoopData,
        reminders: state.reminders,
        cheatDays: state.cheatDays,
        beforeAfterPhotos: state.beforeAfterPhotos,
        weeklyPlans: state.weeklyPlans,
      }),
    }
  )
)
