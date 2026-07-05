import type { FoodItem, Macros, MealType, BodyAnalysis, UserPersonality, PlateIngredient, DetailedPlateAnalysis } from '../types'

// ── Voice Input Parsing ────────────────────────────────────────────────────
export interface VoiceParseResult {
  type: 'food' | 'water' | 'sport' | 'unknown'
  mealType?: MealType
  items?: { name: string; amount: number; calories: number; protein: number; fat: number; carbs: number }[]
  amount?: number
  sport?: { name: string; duration: number; caloriesBurned: number }
}

export async function parseVoiceInput(text: string, apiKey: string): Promise<VoiceParseResult> {
  console.log('[parseVoice] Input:', text)
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Parse diese deutsche Spracheingabe für eine Kalorie-Tracking App: "${text}"

Antworte NUR mit validem JSON ohne Markdown:
- Essen: {"type":"food","mealType":"breakfast|lunch|dinner|snack","items":[{"name":"Hähnchenbrust","amount":150,"calories":248,"protein":46.5,"fat":5.4,"carbs":0}]}
- Wasser: {"type":"water","amount":300}
- Sport: {"type":"sport","name":"Laufen","duration":30,"caloriesBurned":280}
- Unklar: {"type":"unknown"}

Schätze typische Portionsgrößen. mealType: breakfast=Frühstück, lunch=Mittagessen, dinner=Abendessen, snack=Snack.`,
    }],
  })
  const data = await res.json()
  const raw: string = data.content?.[0]?.text ?? '{}'
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{"type":"unknown"}'
  try { return JSON.parse(json) } catch { return { type: 'unknown' } }
}

const ANTHROPIC_MODEL = 'claude-sonnet-4-5'

// Anthropic-Browser-Header (erforderlich für direkte Browser-Calls)
function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  }
}

async function anthropicPost(apiKey: string, body: object): Promise<Response> {
  if (!apiKey?.trim()) throw new Error('Kein Anthropic API Key eingetragen. Bitte unter Profil → API Keys eintragen.')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const e = await res.json(); msg = e?.error?.message ?? msg } catch { /* ignore */ }
    throw new Error(`Anthropic API Fehler: ${msg}`)
  }
  return res
}

// ── Open Food Facts ────────────────────────────────────────────────────────
export async function fetchByBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
    const data = await res.json()
    if (data.status !== 1) return null
    const p = data.product
    const n = p.nutriments ?? {}
    return {
      id: barcode,
      name: p.product_name || p.product_name_de || 'Unbekanntes Produkt',
      brand: p.brands,
      category: p.categories_tags?.[0]?.replace('en:', '') ?? 'Sonstiges',
      barcode,
      macros: {
        calories: Math.round(n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0)),
        protein: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
        fat: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
        carbs: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
        fiber: Math.round((n['fiber_100g'] ?? 0) * 10) / 10,
      },
      serving: p.serving_quantity ? parseFloat(p.serving_quantity) : 100,
    }
  } catch (e) {
    console.error('[Barcode] Fehler:', e)
    return null
  }
}

// ── Claude Vision – Restaurant Menu Scanner ───────────────────────────────
export type MenuDishRating = 'good' | 'ok' | 'bad'

export interface MenuDish {
  name: string
  calories: number
  protein: number
  fat: number
  carbs: number
  rating: MenuDishRating
  reason: string
}

export interface MenuAnalysis {
  dishes: MenuDish[]
  summary: string
}

export async function analyzeMenuPhoto(
  base64Image: string,
  remainingCalories: number,
  remainingProtein: number,
  calorieTarget: number,
  apiKey: string,
): Promise<MenuAnalysis> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 2500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        {
          type: 'text',
          text: `Du bist ein Ernährungsberater. Analysiere diese Speisekarte.

HEUTIGER RESTBEDARF DES NUTZERS:
- Verbleibende Kalorien: ${remainingCalories} kcal (von ${calorieTarget} kcal Tagesziel)
- Verbleibendes Eiweiß: ${remainingProtein}g

AUFGABE:
1. Lese alle Gerichte von der Karte aus
2. Schätze Kalorien, Eiweiß, Fett, Kohlenhydrate pro Gericht (typische Restaurantportionen)
3. Bewerte jedes Gericht: "good" / "ok" / "bad"
   - good ✅: Kalorien ≤ verbleibende Kalorien +100 UND Eiweiß ≥ 20g
   - ok ⚠️: Kalorien ≤ verbleibende Kalorien +300 ODER Eiweiß 10–19g
   - bad ❌: Kalorien > verbleibende Kalorien +300 ODER Eiweiß <10g und viele Kalorien
4. Sortiere: good zuerst, dann ok, dann bad

Antworte NUR mit validem JSON (kein Markdown):
{
  "dishes": [
    {
      "name": "Hähnchen Bowl",
      "calories": 620,
      "protein": 48,
      "fat": 18,
      "carbs": 55,
      "rating": "good",
      "reason": "Passt perfekt – ${remainingCalories} kcal übrig, hoher Proteingehalt"
    }
  ],
  "summary": "Kurze Zusammenfassung in 1–2 Sätzen auf Deutsch."
}

Wenn Text nicht lesbar: schätze anhand der Gerichte die du erkennst. Maximal 15 Gerichte.`,
        },
      ],
    }],
  })
  const raw = (await res.json()).content?.[0]?.text ?? '{}'
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
  const fallback: MenuAnalysis = { dishes: [], summary: '' }
  try {
    const parsed = JSON.parse(json)
    const dishes: MenuDish[] = (parsed.dishes ?? []).map((d: Partial<MenuDish>) => ({
      name: d.name ?? 'Unbekannt',
      calories: Number(d.calories) || 0,
      protein: Number(d.protein) || 0,
      fat: Number(d.fat) || 0,
      carbs: Number(d.carbs) || 0,
      rating: (['good', 'ok', 'bad'].includes(d.rating ?? '') ? d.rating : 'ok') as MenuDishRating,
      reason: d.reason ?? '',
    }))
    // ensure sort order: good → ok → bad
    const order: Record<MenuDishRating, number> = { good: 0, ok: 1, bad: 2 }
    dishes.sort((a, b) => order[a.rating] - order[b.rating])
    return { dishes, summary: parsed.summary ?? '' }
  } catch { return fallback }
}

// ── Claude Vision – Plate Analysis ────────────────────────────────────────
export interface PlateAnalysisResult {
  description: string
  macros: Macros
  items: { name: string; amount: string; calories: number }[]
}

export async function analyzePlate(base64Image: string, apiKey: string): Promise<PlateAnalysisResult> {
  console.log('[analyzePlate] Starte Analyse, Key vorhanden:', !!apiKey)
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: `Analysiere diesen Teller und schätze Kalorien & Makronährstoffe. Antworte NUR mit einem JSON-Objekt ohne Markdown:
{"description":"kurze Beschreibung","items":[{"name":"Zutat","amount":"150g","calories":200}],"macros":{"calories":500,"protein":30,"fat":15,"carbs":55}}` },
      ],
    }],
  })
  const data = await res.json()
  console.log('[analyzePlate] Antwort:', data)
  const text: string = data.content?.[0]?.text ?? ''
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error(`KI hat kein JSON zurückgegeben. Antwort: ${text.slice(0, 100)}`)
  return JSON.parse(json)
}

// ── Claude – Plate Correction via Voice ────────────────────────────────────
export async function correctPlateAnalysis(
  originalDescription: string,
  originalMacros: Macros,
  originalItems: { name: string; amount: string; calories: number }[],
  voiceCorrection: string,
  apiKey: string
): Promise<PlateAnalysisResult> {
  console.log('[correctPlate] Korrektur:', voiceCorrection)
  const itemsText = originalItems.map((i) => `- ${i.name} (${i.amount}, ${i.calories} kcal)`).join('\n')
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Die KI hat einen Teller analysiert mit folgendem Ergebnis:

Beschreibung: "${originalDescription}"
Erkannte Zutaten:
${itemsText}
Gesamt: ${originalMacros.calories} kcal | Eiweiß: ${originalMacros.protein}g | Fett: ${originalMacros.fat}g | KH: ${originalMacros.carbs}g

Der Nutzer möchte korrigieren/ergänzen: "${voiceCorrection}"

Passe die Nährwertangaben entsprechend an (addiere, subtrahiere oder ersetze Zutaten).
Antworte NUR mit validem JSON ohne Markdown:
{"description":"aktualisierte Beschreibung","items":[{"name":"Zutat","amount":"150g","calories":200}],"macros":{"calories":550,"protein":35,"fat":16,"carbs":58}}`,
    }],
  })
  const data = await res.json()
  console.log('[correctPlate] Antwort:', data)
  const text: string = data.content?.[0]?.text ?? ''
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error(`Keine gültige Antwort: ${text.slice(0, 100)}`)
  return JSON.parse(json)
}

// ── Claude Vision – Fridge Scan ────────────────────────────────────────────
export async function analyzeFridge(base64Image: string, apiKey: string): Promise<{ ingredients: string[] }> {
  console.log('[analyzeFridge] Starte Scan, Key vorhanden:', !!apiKey)
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: `Erkenne alle Produkte/Zutaten in diesem Kühlschrank. Antworte NUR mit JSON ohne Markdown:
{"ingredients":["Produkt1","Produkt2"]}` },
      ],
    }],
  })
  const data = await res.json()
  console.log('[analyzeFridge] Antwort:', data)
  const text: string = data.content?.[0]?.text ?? ''
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error(`KI hat kein JSON zurückgegeben. Antwort: ${text.slice(0, 100)}`)
  return JSON.parse(json)
}

// ── Claude – Recipes from Ingredients ─────────────────────────────────────
export async function getRecipesFromIngredients(ingredients: string[], goal: string, apiKey: string): Promise<string> {
  console.log('[getRecipes] Zutaten:', ingredients.length, 'Ziel:', goal)
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Ich habe folgende Zutaten: ${ingredients.join(', ')}. Mein Ziel: ${goal}. Schlage mir 3 passende Rezepte vor mit Kalorien & Makros. Antworte auf Deutsch.`,
    }],
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? 'Keine Antwort erhalten'
}

// ── Claude – Shopping List ─────────────────────────────────────────────────
export async function getShoppingList(ingredients: string[], goal: string, apiKey: string): Promise<string> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Im Kühlschrank: ${ingredients.join(', ')}. Ziel: ${goal}. Erstelle eine optimierte Einkaufsliste für die nächsten 7 Tage, angepasst an das Ziel. Gruppiere nach Kategorien. Antworte auf Deutsch.`,
    }],
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? 'Keine Antwort erhalten'
}

// ── Claude – AI Nutrition Advisor ──────────────────────────────────────────
export async function askNutritionAdvisor(
  message: string,
  context: string,
  apiKey: string,
  medicalSystemPrompt?: string,
): Promise<string> {
  if (!apiKey?.trim()) throw new Error('Kein API Key eingetragen. Bitte unter Profil → API Keys eintragen.')
  const system = medicalSystemPrompt
    ? `${medicalSystemPrompt}\n\n=== HEUTE ===\n${context}`
    : `Du bist ein evidenzbasierter Ernährungsberater. Zitiere Quellen (DGE 2023, WHO, ISSN). Kontext: ${context}. Antworte auf Deutsch.`
  try {
    const res = await anthropicPost(apiKey, {
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: message }],
    })
    const data = await res.json()
    return data.content?.[0]?.text ?? 'Keine Antwort'
  } catch {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
      }),
    })
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try { const err = await res.json(); msg = err?.error?.message ?? msg } catch { /* ignore */ }
      throw new Error(`API Fehler: ${msg}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? 'Keine Antwort'
  }
}

// ── Claude – Weekly Meal Plan ──────────────────────────────────────────────
export async function generateWeeklyPlan(context: string, apiKey: string): Promise<string> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `${context}. Erstelle einen detaillierten 7-Tage-Ernährungsplan (Mo–So) mit Frühstück, Mittagessen, Abendessen und Snacks. Für jeden Tag: Gesamtkalorien, Protein, Fett, Kohlenhydrate. Am Ende: eine kompakte Einkaufsliste. Antworte auf Deutsch.`,
    }],
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? 'Kein Plan generiert'
}

// ── OpenAI – Direkt ────────────────────────────────────────────────────────
export async function askOpenAI(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey?.trim()) throw new Error('Kein OpenAI API Key eingetragen.')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'Du bist ein hilfreicher Ernährungsberater. Antworte auf Deutsch.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const e = await res.json(); msg = e?.error?.message ?? msg } catch { /* ignore */ }
    throw new Error(`OpenAI Fehler: ${msg}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? 'Keine Antwort'
}

// ── AI Coach – Muster erkennen & Insights generieren ─────────────────────
export interface CoachInsight {
  type: 'success' | 'warning' | 'info' | 'tip'
  emoji: string
  title: string
  description: string
}

export interface CoachPattern {
  emoji: string
  title: string
  detail: string
}

export interface CoachReport {
  greeting: string
  insights: CoachInsight[]
  patterns: CoachPattern[]
  weeklyScore: number
  weekSummary: string
  focus: string
  weeklyChallenge: string
}

export async function generateCoachInsights(
  userName: string,
  goal: string,
  calorieTarget: number,
  weekData: string,
  apiKey: string
): Promise<CoachReport> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 2400,
    messages: [{
      role: 'user',
      content: `Du bist ein persönlicher, empathischer Ernährungs-Coach. Analysiere die Daten gründlich und erkenne echte Verhaltensmuster.

Nutzer: ${userName}
Ziel: ${goal}
Kalorienziel: ${calorieTarget} kcal/Tag

${weekData}

AUFGABE: Erkenne echte Muster. Denke wie ein erfahrener Coach:
- Wochentags-Muster: Isst ${userName} montags/freitags/am Wochenende mehr oder weniger?
- Zusammenhänge: An Sport-Tagen – isst er mehr oder weniger? Holt er nach dem Sport die Kalorien auf?
- Schlaf-Essen: Wenn Whoop-Schlaf schlecht (<75%) – isst er dann mehr?
- Konsistenz: Welche Tage hält er das Ziel, welche nicht?
- Protein-Muster: An welchen Tagen ist Protein zu niedrig?

Antworte NUR mit validem JSON (kein Markdown, keine Codeblocks):
{
  "greeting": "Hey ${userName}! Ich habe deine Daten der letzten Tage analysiert – hier sind meine Beobachtungen:",
  "insights": [
    {"type": "warning", "emoji": "⚠️", "title": "Konkrete Überschrift mit Zahl", "description": "Persönliche Beobachtung mit echten Zahlen. Z.B.: An 4 von 7 Tagen hast du das Kalorienziel um durchschnittlich 340 kcal überschritten."}
  ],
  "patterns": [
    {"emoji": "📅", "title": "Wochentags-Muster", "detail": "Konkret: z.B. Montags konsumierst du im Schnitt 400 kcal mehr als an anderen Tagen. Freitag/Samstag tendenziell am wenigsten Sport."},
    {"emoji": "🏃", "title": "Nach dem Sport", "detail": "Konkret: An Sporttagen isst du X kcal mehr/weniger als an Ruhetagen."},
    {"emoji": "😴", "title": "Schlaf & Ernährung", "detail": "Nur wenn Whoop-Daten vorhanden – sonst Protein-Muster oder Wasseraufnahme."}
  ],
  "weeklyScore": 72,
  "weekSummary": "Diese Woche in 2 konkreten Sätzen mit Zahlen.",
  "focus": "Eine einzige konkrete Empfehlung für nächste Woche mit messbarem Ziel.",
  "weeklyChallenge": "Deine Challenge: Eine simple, motivierende Aufgabe für die nächsten 7 Tage. Z.B.: Trinke jeden Tag vor dem Mittagessen ein Glas Wasser."
}

Regeln: 3–5 Insights + 2–3 Patterns. Immer mit echten Zahlen aus den Daten. Persönlich mit Namen. Motivierend aber ehrlich.`,
    }],
  })
  const raw = (await res.json()).content?.[0]?.text ?? '{}'
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
  const fallback: CoachReport = { greeting: '', insights: [], patterns: [], weeklyScore: 0, weekSummary: raw.slice(0, 200), focus: '', weeklyChallenge: '' }
  try {
    const parsed = JSON.parse(json)
    return { ...fallback, ...parsed, patterns: parsed.patterns ?? [], weeklyChallenge: parsed.weeklyChallenge ?? '' }
  } catch { return fallback }
}

// ── Morning Briefing – tägliche personalisierte Empfehlung ───────────────
export interface MorningBriefingItem {
  emoji: string
  title: string
  text: string
  source: string
}

export interface MorningBriefing {
  greeting: string
  items: MorningBriefingItem[]
  todayFocus: string
  supplementTip: string
}

export async function generateMorningBriefing(
  medicalSystemPrompt: string,
  yesterdayData: string,
  apiKey: string,
): Promise<MorningBriefing> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 1600,
    system: medicalSystemPrompt,
    messages: [{
      role: 'user',
      content: `Erstelle einen personalisierten Guten-Morgen-Bericht basierend auf den gestrigen Daten.

=== GESTRIGE DATEN ===
${yesterdayData}

Analysiere die Daten und erstelle einen motivierenden Morgen-Bericht. Vergleiche mit den medizinischen Richtlinien aus deiner Wissensdatenbank.

Antworte NUR mit validem JSON (kein Markdown):
{
  "greeting": "Guten Morgen [Name]! Kurze motivierende Begrüßung mit Bezug auf gestrige Daten.",
  "items": [
    {
      "emoji": "💪",
      "title": "Protein gestern",
      "text": "Konkrete Beobachtung mit Zahlen + Vergleich zum Ziel + heutiger Tipp. Z.B.: Du hast gestern 95g Protein gegessen – dein Ziel sind 160g. Füge heute zum Frühstück 3 Eier (18g) hinzu.",
      "source": "ISSN 2017"
    }
  ],
  "todayFocus": "Eine einzige konkrete Empfehlung für den heutigen Tag mit messbarem Ziel.",
  "supplementTip": "Ein evidenzbasierter Supplement-Tipp mit Quelle. Z.B.: Vitamin D3 (1000 IE) mit dem Frühstück – laut DGE 2023 haben 60% der Deutschen einen Mangel."
}

Regeln: 3–4 Items, immer mit echten gestrigen Zahlen, immer mit Quellenangabe, motivierend und positiv.`,
    }],
  })
  const raw = (await res.json()).content?.[0]?.text ?? '{}'
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
  const fallback: MorningBriefing = { greeting: 'Guten Morgen!', items: [], todayFocus: '', supplementTip: '' }
  try {
    const parsed = JSON.parse(json)
    return { ...fallback, ...parsed, items: parsed.items ?? [] }
  } catch { return fallback }
}

// ── Body Photo Analysis – Körperzusammensetzung schätzen ──────────────────
export async function analyzeBodyPhoto(base64Image: string, apiKey: string): Promise<BodyAnalysis> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: `Analysiere dieses Körperfoto visuell und sachlich.
Antworte NUR mit validem JSON ohne Markdown:
{
  "bodyFatRange": "15–20%",
  "muscleTonus": "gering|mittel|gut|sehr gut",
  "fitnessLevel": "Anfänger|Fortgeschritten|Fit|Sehr fit",
  "observations": ["Sachliche Beobachtung 1", "Beobachtung 2"],
  "recommendations": ["Konkrete Empfehlung 1", "Empfehlung 2"]
}
WICHTIG: Grobe visuelle Schätzung, kein medizinischer Rat. Respektvoll und motivierend bleiben.` },
      ],
    }],
  })
  const raw = (await res.json()).content?.[0]?.text ?? '{}'
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
  return JSON.parse(json)
}

// ── USDA FoodData Central – Zweite Produktdatenbank ───────────────────────
export async function searchUSDA(query: string): Promise<FoodItem | null> {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=DEMO_KEY&pageSize=1&dataType=Branded,SR%20Legacy`
    const res  = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const food = data.foods?.[0]
    if (!food) return null
    const n    = food.foodNutrients ?? []
    const get  = (id: number) => (n.find((x: any) => x.nutrientId === id)?.value ?? 0) as number
    return {
      id: `usda_${food.fdcId}`,
      name: food.description,
      brand: food.brandOwner ?? food.brandName,
      category: food.foodCategory ?? 'Sonstiges',
      macros: {
        calories: Math.round(get(1008)),
        protein:  Math.round(get(1003) * 10) / 10,
        fat:      Math.round(get(1004) * 10) / 10,
        carbs:    Math.round(get(1005) * 10) / 10,
      },
      serving: 100,
    }
  } catch { return null }
}

// ── Kalo – Persönlicher KI-Begleiter ──────────────────────────────────────

export async function askKalo(
  message: string,
  profile: { name: string; goal: string },
  personality: UserPersonality,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  context: string,
  apiKey: string,
): Promise<string> {
  const goalLabel = profile.goal === 'lose' ? 'Abnehmen' : profile.goal === 'gain' ? 'Zunehmen' : 'Gewicht halten'
  const system = `Du bist Kalo, der persönliche KI-Ernährungsbegleiter von ${profile.name}.

Was du über ${profile.name} weißt:
- Ziel: ${goalLabel}
- Lieblingsspeisen: ${personality.favoriteFoods.join(', ') || 'noch unbekannt'}
- Schwachstellen: ${personality.weaknesses.join(', ') || 'noch unbekannt'}
- Hungerzeitpunkte: ${personality.hungerTimes.join(', ') || 'noch unbekannt'}
- Motivationen: ${personality.motivations.join(', ') || 'noch unbekannt'}
- Erfolgsstrategien: ${personality.successPatterns.join(', ') || 'noch unbekannt'}
- Was nicht klappt: ${personality.failPatterns.join(', ') || 'noch unbekannt'}
- Stress-Essen: ${personality.stressEatingPattern ? 'Ja, bekanntes Muster' : 'nicht bekannt'}

Heutige Daten: ${context}

DEINE PERSÖNLICHKEIT:
- Du bist wie ein guter Freund – nicht wie eine App
- Immer freundlich & motivierend, niemals kritisch oder negativ
- Beziehe dich auf frühere Gespräche wenn relevant
- Erkenne Emotionen und reagiere einfühlsam
- Humorvoll wenn passend
- Nie generische Antworten – immer personalisiert auf ${profile.name}
- Sprich ${profile.name} beim Vornamen an
- Lerne bei jedem Gespräch mehr über ${profile.name}
- Wenn du ein Muster erkennst, erwähne es natürlich: „Ich merke, du hast öfter abends Hunger…"

Antworte immer auf Deutsch. Kurz & prägnant (max 4 Sätze außer bei komplexen Fragen).`

  const messages = [
    ...conversationHistory.slice(-12).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ]
  const res = await anthropicPost(apiKey, { model: ANTHROPIC_MODEL, max_tokens: 600, system, messages })
  const data = await res.json()
  return data.content?.[0]?.text ?? 'Keine Antwort'
}

export async function generateDailyKaloQuestion(
  profileName: string,
  personality: UserPersonality,
  context: string,
  apiKey: string,
): Promise<string> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: `Du bist Kalo, KI-Begleiter von ${profileName}.
Bekannte Schwachstellen: ${personality.weaknesses.join(', ') || 'unbekannt'}
Heutige Daten: ${context}

Stelle eine kurze persönliche Frage um mehr über ${profileName} zu lernen.
Themen: Hunger, Stimmung, Cravings, Erfolge, Herausforderungen, Schlaf, Stress.
Nur die Frage selbst zurückgeben, max 1 Satz, freundlich, auf Deutsch.`,
    }],
  })
  const data = await res.json()
  return data.content?.[0]?.text?.trim() ?? `Wie fühlst du dich heute, ${profileName}?`
}

export async function extractPersonalityInsights(
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  current: UserPersonality,
  apiKey: string,
): Promise<Partial<UserPersonality>> {
  const recent = conversationHistory.slice(-8)
  if (recent.length < 2) return {}
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Analysiere diese Unterhaltung und extrahiere neu erwähnte Erkenntnisse.

Gespräch:
${recent.map((m) => `${m.role === 'user' ? 'Person' : 'Kalo'}: ${m.content}`).join('\n')}

Bereits bekannt:
- Lieblingsspeisen: ${current.favoriteFoods.join(', ')}
- Schwachstellen: ${current.weaknesses.join(', ')}
- Hungerzeitpunkte: ${current.hungerTimes.join(', ')}

Extrahiere NUR NEU erwähnte Informationen. Antworte NUR mit JSON (kein Markdown):
{"favoriteFoods":[],"weaknesses":[],"hungerTimes":[],"motivations":[],"successPatterns":[],"failPatterns":[],"stressEatingPattern":null}
Leere Arrays wenn nichts Neues.`,
    }],
  })
  const text = (await res.json()).content?.[0]?.text ?? '{}'
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
  try { return JSON.parse(json) } catch { return {} }
}

export async function generateWeeklyKaloReport(
  profileName: string,
  goal: string,
  personality: UserPersonality,
  weekData: string,
  apiKey: string,
): Promise<string> {
  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Du bist Kalo, persönlicher Begleiter von ${profileName} (Ziel: ${goal}).

Wochendaten:
${weekData}

Bekannte Schwachstellen: ${personality.weaknesses.join(', ') || 'keine'}
Bekannte Erfolgsstrategien: ${personality.successPatterns.join(', ') || 'keine'}

Erstelle einen persönlichen Wochenabschluss für ${profileName} auf Deutsch:
1. Was war diese Woche konkret gut (nicht generisch!)
2. Ein erkanntes Muster (positiv oder was zu verbessern ist)
3. Einen konkreten Tipp für nächste Woche
4. Motivierender Abschluss mit Namen

Max 200 Wörter. Freundlich wie ein guter Freund, niemals kritisch.`,
    }],
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? 'Kein Bericht verfügbar'
}

// ── Präziser Foto-Scanner – Multi-Step Analyse ────────────────────────────

export async function analyzePlateDetailed(
  base64Image: string,
  portionHistory: Record<string, number>,
  apiKey: string,
): Promise<DetailedPlateAnalysis> {
  const historyHint = Object.entries(portionHistory).slice(0, 8)
    .map(([food, g]) => `${food}: typisch ${g}g`).join(', ')

  const res = await anthropicPost(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        {
          type: 'text',
          text: `Analysiere dieses Essensfoto sehr präzise.
${historyHint ? `\nBekannte Portionsgrößen dieser Person: ${historyHint}` : ''}

1. Liste ALLE sichtbaren Zutaten einzeln auf
2. Schätze Gewicht jeder Zutat in Gramm (nutze Referenzobjekte: Teller≈26cm, Gabel≈19cm)
3. Berechne Kalorien, Protein, Fett, Kohlenhydrate pro Zutat
4. Gib Konfidenz-Score an (0.0–1.0 wie sicher du bist)
5. Markiere unsichere Schätzungen in notes

Antworte NUR als JSON (kein Markdown):
{"dish":"Name","ingredients":[{"name":"Hähnchenbrust","weight_g":180,"calories":198,"protein":37,"carbs":0,"fat":4,"confidence":0.9}],"total":{"calories":520,"protein":45,"carbs":38,"fat":12},"confidence_overall":0.85,"notes":"Soße schwer zu schätzen"}`,
        },
      ],
    }],
  })
  const text = (await res.json()).content?.[0]?.text ?? '{}'
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
  try {
    const p = JSON.parse(json)
    return {
      dish: p.dish ?? 'Gericht',
      ingredients: (p.ingredients ?? []).map((i: Partial<PlateIngredient>) => ({
        name: i.name ?? 'Zutat',
        weight_g: Number(i.weight_g) || 100,
        calories: Number(i.calories) || 0,
        protein: Number(i.protein) || 0,
        carbs: Number(i.carbs) || 0,
        fat: Number(i.fat) || 0,
        confidence: Math.min(1, Math.max(0, Number(i.confidence) || 0.5)),
      })),
      total: {
        calories: Number(p.total?.calories) || 0,
        protein: Number(p.total?.protein) || 0,
        carbs: Number(p.total?.carbs) || 0,
        fat: Number(p.total?.fat) || 0,
      },
      confidence_overall: Math.min(1, Math.max(0, Number(p.confidence_overall) || 0.7)),
      notes: p.notes ?? '',
    }
  } catch { throw new Error('KI konnte das Foto nicht analysieren') }
}


// ── KI-Nährwert-Vorschlag für unbekannte Produkte ─────────────────────────
export async function getAINutrients(
  productName: string,
  apiKey: string
): Promise<{ calories: number; protein: number; fat: number; carbs: number } | null> {
  try {
    const res = await anthropicPost(apiKey, {
      model: ANTHROPIC_MODEL,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Schätze Nährwerte pro 100g für: "${productName}".
Antworte NUR mit JSON: {"calories":100,"protein":5.0,"fat":2.0,"carbs":15.0}`,
      }],
    })
    const raw  = (await res.json()).content?.[0]?.text ?? '{}'
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
    return JSON.parse(json)
  } catch { return null }
}
