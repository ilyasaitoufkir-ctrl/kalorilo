import type { FoodItem, Macros, MealType, BodyAnalysis } from '../types'

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
export async function askNutritionAdvisor(message: string, context: string, apiKey: string): Promise<string> {
  if (!apiKey?.trim()) throw new Error('Kein API Key eingetragen. Bitte unter Profil → API Keys eintragen.')
  // Versuche zuerst Anthropic, dann OpenAI
  try {
    const res = await anthropicPost(apiKey, {
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: `Du bist ein freundlicher Ernährungsberater. Kontext: ${context}. Antworte kurz und hilfreich auf Deutsch.`,
      messages: [{ role: 'user', content: message }],
    })
    const data = await res.json()
    return data.content?.[0]?.text ?? 'Keine Antwort'
  } catch (e) {
    // Fallback: OpenAI
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: `Du bist ein freundlicher Ernährungsberater. Kontext: ${context}. Antworte kurz und hilfreich auf Deutsch.` },
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

export interface CoachReport {
  greeting: string
  insights: CoachInsight[]
  weeklyScore: number
  weekSummary: string
  focus: string
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
    max_tokens: 1800,
    messages: [{
      role: 'user',
      content: `Du bist ein persönlicher Ernährungs-Coach. Analysiere die Daten und erstelle einen personalisierten Wochenbericht.

Nutzer: ${userName}
Ziel: ${goal}
Kalorienziel: ${calorieTarget} kcal/Tag

${weekData}

Antworte NUR mit validem JSON ohne Markdown:
{
  "greeting": "Hey ${userName}, ich habe deine Daten analysiert...",
  "insights": [
    {"type": "warning", "emoji": "⚠️", "title": "Kurze Überschrift", "description": "Konkrete, persönliche Beobachtung mit Zahlen aus den Daten."}
  ],
  "weeklyScore": 72,
  "weekSummary": "Diese Woche in 2 Sätzen zusammengefasst.",
  "focus": "Nächste Woche: eine konkrete Empfehlung."
}

Regeln: 3–5 Insights, konkret mit echten Zahlen aus den Daten, persönlich angesprochen. Erkenne echte Muster (Wochentage, nach Sport, Schlafdauer).`,
    }],
  })
  const raw = (await res.json()).content?.[0]?.text ?? '{}'
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{"greeting":"","insights":[],"weeklyScore":0,"weekSummary":"","focus":""}'
  try { return JSON.parse(json) } catch { return { greeting: '', insights: [], weeklyScore: 0, weekSummary: raw.slice(0, 200), focus: '' } }
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
