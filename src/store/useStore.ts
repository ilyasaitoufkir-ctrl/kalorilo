import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  UserProfile, FoodLog, ActivityLog, WeightEntry, WaterLog,
  CustomRecipe, AIMessage, WhoopData, WhoopDayHistory, ApiKeys, Reminder,
  CheatDay, BeforeAfterPhoto, WeeklyPlan, TabId, DailyStats, RunSession,
  UserPersonality, CoachingProfile,
} from '../types'
import { DEFAULT_PERSONALITY } from '../types'

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

  // Whoop OAuth2 tokens
  whoopTokens: { accessToken: string; refreshToken: string; expiresAt: number } | null
  setWhoopTokens: (t: { accessToken: string; refreshToken: string; expiresAt: number }) => void
  clearWhoopTokens: () => void
  // Extended sync data (sleep duration, burned cals from Whoop)
  whoopExtended: { sleepDuration: number; caloriesBurned: number; date: string } | null

  // Social / Groups
  userId: string
  firebaseConfig: { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string } | null
  setFirebaseConfig: (cfg: AppState['firebaseConfig']) => void
  groupIds: string[]
  addGroupId: (id: string) => void
  removeGroupId: (id: string) => void

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
  whoopHistory: WhoopDayHistory[]
  setWhoopHistory: (h: WhoopDayHistory[]) => void
  whoopLastSyncAt: number   // unix ms of last successful sync

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

  // Clear all user data (called on logout)
  clearUserData: () => void

  // Run sessions
  runSessions: RunSession[]
  addRunSession: (session: RunSession) => void
  removeRunSession: (id: string) => void

  // Supplements
  supplements: { id: string; name: string }[]
  supplementChecked: Record<string, string> // id → date checked
  addSupplement: (name: string) => void
  removeSupplement: (id: string) => void
  toggleSupplement: (id: string) => void

  // Daily score history (date → 0-100)
  scoreHistory: Record<string, number>
  setDailyScore: (date: string, score: number) => void

  // Extended coaching profile (from onboarding)
  coachingProfile: CoachingProfile | null
  setCoachingProfile: (p: CoachingProfile) => void

  // Adaptive coaching plans (AI-generated, cached)
  trainingPlan: string | null
  setTrainingPlan: (plan: string) => void
  nutritionPlan: string | null
  setNutritionPlan: (plan: string) => void

  // Daily AI score comment (cached per day)
  scoreComment: string
  scoreCommentDate: string
  setScoreComment: (comment: string, date: string) => void

  // Kalo AI personality
  userPersonality: UserPersonality
  updatePersonality: (updates: Partial<UserPersonality>) => void

  // Kalo conversation (separate from general AI)
  kaloMessages: AIMessage[]
  addKaloMessage: (msg: AIMessage) => void
  clearKaloMessages: () => void

  // Portion history (photo scanner learning)
  portionHistory: Record<string, number>  // food name → typical grams
  updatePortionHistory: (food: string, grams: number) => void

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

      darkMode: 'dark',
      setDarkMode: (m) => set({ darkMode: m }),

      stepsToday: 0,
      setStepsToday: (steps) => set({ stepsToday: steps }),
      healthCalories: 0,
      setHealthCalories: (cal) => set({ healthCalories: cal }),

      whoopTokens: null,
      setWhoopTokens: (t) => set({ whoopTokens: t }),
      clearWhoopTokens: () => set({ whoopTokens: null }),
      whoopExtended: null,

      userId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      firebaseConfig: null,
      setFirebaseConfig: (cfg) => set({ firebaseConfig: cfg }),
      groupIds: [],
      addGroupId: (id) => set((s) => ({ groupIds: s.groupIds.includes(id) ? s.groupIds : [...s.groupIds, id] })),
      removeGroupId: (id) => set((s) => ({ groupIds: s.groupIds.filter((g) => g !== id) })),

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
      whoopHistory: [],
      setWhoopHistory: (h) => set({ whoopHistory: h }),
      whoopLastSyncAt: 0,

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

      runSessions: [],
      addRunSession: (session) => set((s) => ({ runSessions: [session, ...s.runSessions] })),
      removeRunSession: (id) => set((s) => ({ runSessions: s.runSessions.filter((r) => r.id !== id) })),

      supplements: [
        { id: 'sup-1', name: 'Vitamin D3' },
        { id: 'sup-2', name: 'Omega-3' },
        { id: 'sup-3', name: 'Magnesium' },
      ],
      supplementChecked: {},
      addSupplement: (name) => set((s) => ({
        supplements: [...s.supplements, { id: `sup-${Date.now()}`, name }],
      })),
      removeSupplement: (id) => set((s) => {
        const checked = { ...s.supplementChecked }
        delete checked[id]
        return { supplements: s.supplements.filter((s) => s.id !== id), supplementChecked: checked }
      }),
      toggleSupplement: (id) => set((s) => {
        const today = new Date().toISOString().split('T')[0]
        const checked = { ...s.supplementChecked }
        if (checked[id] === today) delete checked[id]
        else checked[id] = today
        return { supplementChecked: checked }
      }),

      scoreHistory: {},
      setDailyScore: (date, score) => set((s) => ({
        scoreHistory: { ...s.scoreHistory, [date]: score },
      })),

      coachingProfile: null,
      setCoachingProfile: (p) => set({ coachingProfile: p }),

      trainingPlan: null,
      setTrainingPlan: (plan) => set({ trainingPlan: plan }),
      nutritionPlan: null,
      setNutritionPlan: (plan) => set({ nutritionPlan: plan }),

      scoreComment: '',
      scoreCommentDate: '',
      setScoreComment: (comment, date) => set({ scoreComment: comment, scoreCommentDate: date }),

      // Kalo personality
      userPersonality: DEFAULT_PERSONALITY,
      updatePersonality: (updates) => set((s) => ({
        userPersonality: { ...s.userPersonality, ...updates },
      })),

      // Kalo messages (separate chat history)
      kaloMessages: [],
      addKaloMessage: (msg) => set((s) => ({
        kaloMessages: [...s.kaloMessages.slice(-150), msg],
      })),
      clearKaloMessages: () => set({ kaloMessages: [] }),

      // Portion history
      portionHistory: {},
      updatePortionHistory: (food, grams) => set((s) => ({
        portionHistory: { ...s.portionHistory, [food.toLowerCase()]: grams },
      })),

      clearUserData: () => set({
        profile: null,
        foodLogs: [], activityLogs: [], weightHistory: [], waterLogs: [],
        customRecipes: [], aiMessages: [], kaloMessages: [], whoopData: null,
        cheatDays: [], beforeAfterPhotos: [], weeklyPlans: [], runSessions: [],
        apiKeys: defaultApiKeys, activeTab: 'home',
        whoopTokens: null, groupIds: [],
        userPersonality: DEFAULT_PERSONALITY, portionHistory: {},
        trainingPlan: null, nutritionPlan: null, scoreComment: '', scoreCommentDate: '',
      }),

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
        const { profile, whoopData } = get()
        if (!profile) return 2000
        const { age, weight, height, gender, activityLevel, goal, targetWeight, targetWeeks } = profile
        // Mifflin-St Jeor BMR
        const bmr = gender === 'male'
          ? 10 * weight + 6.25 * height - 5 * age + 5
          : 10 * weight + 6.25 * height - 5 * age - 161
        const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
        const tdee = bmr * activityMultipliers[activityLevel]
        const weeklyDelta = (weight - targetWeight) * 7700 / (targetWeeks || 12)
        let base = 0
        if (goal === 'lose') base = Math.max(1200, Math.round(tdee - weeklyDelta / 7))
        else if (goal === 'gain') base = Math.round(tdee + Math.abs(weeklyDelta) / 7)
        else base = Math.round(tdee)
        // Whoop recovery adjustment: low recovery → rest, high → can push
        if (whoopData?.recovery) {
          const r = whoopData.recovery
          if (r < 34) base = Math.max(1200, base - 200)
          else if (r > 66) base = base + 150
        }
        // Strain bonus: heavy training day → more calories
        if (whoopData?.strain && whoopData.strain > 14) base = base + 150
        return base
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
        // Migrate old tab IDs
        if ((state.activeTab as string) === 'dashboard') state.activeTab = 'home'
        if ((state.activeTab as string) === 'fridge') state.activeTab = 'ai'
        // Dark mode als Standard setzen falls noch 'auto'
        if ((state.darkMode as string) === 'auto') state.darkMode = 'dark'
      },
      partialize: (state) => ({
        darkMode: state.darkMode,
        stepsToday: state.stepsToday,
        healthCalories: state.healthCalories,
        whoopTokens: state.whoopTokens,
        whoopExtended: state.whoopExtended,
        userId: state.userId,
        firebaseConfig: state.firebaseConfig,
        groupIds: state.groupIds,
        profile: state.profile,
        apiKeys: state.apiKeys,
        foodLogs: state.foodLogs,
        activityLogs: state.activityLogs,
        weightHistory: state.weightHistory,
        waterLogs: state.waterLogs,
        customRecipes: state.customRecipes,
        aiMessages: state.aiMessages,
        whoopData: state.whoopData,
        whoopHistory: state.whoopHistory,
        reminders: state.reminders,
        cheatDays: state.cheatDays,
        beforeAfterPhotos: state.beforeAfterPhotos,
        weeklyPlans: state.weeklyPlans,
        runSessions: state.runSessions,
        supplements: state.supplements,
        supplementChecked: state.supplementChecked,
        coachingProfile: state.coachingProfile,
        scoreHistory: state.scoreHistory,
        trainingPlan: state.trainingPlan,
        nutritionPlan: state.nutritionPlan,
        scoreComment: state.scoreComment,
        scoreCommentDate: state.scoreCommentDate,
      }),
    }
  )
)
