import type { FoodItem } from '../types'

export const FOOD_CATEGORIES = [
  'Fleisch', 'Fisch & Meeresfrüchte', 'Geflügel', 'Gemüse', 'Obst',
  'Milchprodukte', 'Getreide & Brot', 'Hülsenfrüchte', 'Nüsse & Samen',
  'Snacks', 'Süßigkeiten', 'Getränke', 'Fertiggerichte', 'Fast Food',
  'Eier', 'Saucen & Dips', 'Öle & Fette',
]

export const FOOD_DATABASE: FoodItem[] = [
  // FLEISCH
  { id: 'f1', name: 'Rindersteak', category: 'Fleisch', macros: { calories: 271, protein: 26.1, fat: 18.6, carbs: 0 }, serving: 150 },
  { id: 'f2', name: 'Schweineschnitzel', category: 'Fleisch', macros: { calories: 196, protein: 21.5, fat: 11.9, carbs: 0 }, serving: 150 },
  { id: 'f3', name: 'Hackfleisch (Rind)', category: 'Fleisch', macros: { calories: 235, protein: 17.9, fat: 18.0, carbs: 0 }, serving: 100 },
  { id: 'f4', name: 'Hackfleisch (gemischt)', category: 'Fleisch', macros: { calories: 246, protein: 17.0, fat: 19.6, carbs: 0 }, serving: 100 },
  { id: 'f5', name: 'Lammkeule', category: 'Fleisch', macros: { calories: 263, protein: 16.5, fat: 21.9, carbs: 0 }, serving: 120 },
  { id: 'f6', name: 'Schweinebauch', category: 'Fleisch', macros: { calories: 518, protein: 9.9, fat: 52.7, carbs: 0 }, serving: 80 },
  { id: 'f7', name: 'Kalbsfilet', category: 'Fleisch', macros: { calories: 172, protein: 20.3, fat: 9.8, carbs: 0 }, serving: 150 },
  { id: 'f8', name: 'Salami', category: 'Fleisch', macros: { calories: 425, protein: 17.6, fat: 38.5, carbs: 1.7 }, serving: 30 },
  { id: 'f9', name: 'Schinken (gekocht)', category: 'Fleisch', macros: { calories: 107, protein: 17.1, fat: 3.6, carbs: 0.6 }, serving: 50 },
  { id: 'f10', name: 'Bratwurst', category: 'Fleisch', macros: { calories: 295, protein: 13.4, fat: 26.4, carbs: 0.6 }, serving: 100 },

  // FISCH & MEERESFRÜCHTE
  { id: 'fi1', name: 'Lachs', category: 'Fisch & Meeresfrüchte', macros: { calories: 208, protein: 20.1, fat: 13.6, carbs: 0 }, serving: 150 },
  { id: 'fi2', name: 'Thunfisch (Dose)', category: 'Fisch & Meeresfrüchte', macros: { calories: 116, protein: 25.5, fat: 1.0, carbs: 0 }, serving: 100 },
  { id: 'fi3', name: 'Forelle', category: 'Fisch & Meeresfrüchte', macros: { calories: 135, protein: 19.5, fat: 6.2, carbs: 0 }, serving: 150 },
  { id: 'fi4', name: 'Kabeljau', category: 'Fisch & Meeresfrüchte', macros: { calories: 82, protein: 18.3, fat: 0.7, carbs: 0 }, serving: 150 },
  { id: 'fi5', name: 'Garnelen', category: 'Fisch & Meeresfrüchte', macros: { calories: 85, protein: 18.0, fat: 1.2, carbs: 0.2 }, serving: 100 },
  { id: 'fi6', name: 'Hering', category: 'Fisch & Meeresfrüchte', macros: { calories: 158, protein: 17.8, fat: 9.7, carbs: 0 }, serving: 100 },
  { id: 'fi7', name: 'Makrele', category: 'Fisch & Meeresfrüchte', macros: { calories: 205, protein: 18.7, fat: 14.3, carbs: 0 }, serving: 120 },
  { id: 'fi8', name: 'Tilapia', category: 'Fisch & Meeresfrüchte', macros: { calories: 96, protein: 20.1, fat: 1.7, carbs: 0 }, serving: 150 },

  // GEFLÜGEL
  { id: 'g1', name: 'Hähnchenbrust', category: 'Geflügel', macros: { calories: 165, protein: 31.0, fat: 3.6, carbs: 0 }, serving: 150 },
  { id: 'g2', name: 'Hähnchenschenkel', category: 'Geflügel', macros: { calories: 209, protein: 26.0, fat: 10.9, carbs: 0 }, serving: 130 },
  { id: 'g3', name: 'Putenbrust', category: 'Geflügel', macros: { calories: 135, protein: 29.9, fat: 1.0, carbs: 0 }, serving: 150 },
  { id: 'g4', name: 'Ente', category: 'Geflügel', macros: { calories: 337, protein: 19.0, fat: 28.6, carbs: 0 }, serving: 120 },
  { id: 'g5', name: 'Hähnchen (paniert)', category: 'Geflügel', macros: { calories: 246, protein: 17.4, fat: 14.4, carbs: 10.6 }, serving: 120 },
  { id: 'g6', name: 'Putenhackfleisch', category: 'Geflügel', macros: { calories: 176, protein: 20.0, fat: 9.8, carbs: 0.5 }, serving: 100 },

  // GEMÜSE
  { id: 'v1', name: 'Brokkoli', category: 'Gemüse', macros: { calories: 34, protein: 2.8, fat: 0.4, carbs: 6.6, fiber: 2.6 }, serving: 150 },
  { id: 'v2', name: 'Spinat', category: 'Gemüse', macros: { calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2 }, serving: 100 },
  { id: 'v3', name: 'Karotten', category: 'Gemüse', macros: { calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6, fiber: 2.8 }, serving: 100 },
  { id: 'v4', name: 'Paprika (rot)', category: 'Gemüse', macros: { calories: 31, protein: 1.0, fat: 0.3, carbs: 6.0, fiber: 2.1 }, serving: 100 },
  { id: 'v5', name: 'Zucchini', category: 'Gemüse', macros: { calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1.0 }, serving: 150 },
  { id: 'v6', name: 'Tomaten', category: 'Gemüse', macros: { calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2 }, serving: 100 },
  { id: 'v7', name: 'Gurke', category: 'Gemüse', macros: { calories: 15, protein: 0.7, fat: 0.1, carbs: 3.6, fiber: 0.5 }, serving: 100 },
  { id: 'v8', name: 'Blumenkohl', category: 'Gemüse', macros: { calories: 25, protein: 1.9, fat: 0.3, carbs: 4.97, fiber: 2.0 }, serving: 150 },
  { id: 'v9', name: 'Erbsen', category: 'Gemüse', macros: { calories: 81, protein: 5.4, fat: 0.4, carbs: 14.5, fiber: 5.1 }, serving: 100 },
  { id: 'v10', name: 'Mais', category: 'Gemüse', macros: { calories: 86, protein: 3.2, fat: 1.2, carbs: 18.7, fiber: 2.0 }, serving: 100 },
  { id: 'v11', name: 'Aubergine', category: 'Gemüse', macros: { calories: 25, protein: 1.0, fat: 0.2, carbs: 5.7, fiber: 3.0 }, serving: 120 },
  { id: 'v12', name: 'Süßkartoffel', category: 'Gemüse', macros: { calories: 86, protein: 1.6, fat: 0.1, carbs: 20.1, fiber: 3.0 }, serving: 150 },
  { id: 'v13', name: 'Zwiebel', category: 'Gemüse', macros: { calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fiber: 1.7 }, serving: 80 },
  { id: 'v14', name: 'Knoblauch', category: 'Gemüse', macros: { calories: 149, protein: 6.4, fat: 0.5, carbs: 33.1, fiber: 2.1 }, serving: 10 },
  { id: 'v15', name: 'Grüne Bohnen', category: 'Gemüse', macros: { calories: 31, protein: 1.8, fat: 0.2, carbs: 6.97, fiber: 3.4 }, serving: 100 },

  // OBST
  { id: 'o1', name: 'Banane', category: 'Obst', macros: { calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8, fiber: 2.6 }, serving: 120 },
  { id: 'o2', name: 'Apfel', category: 'Obst', macros: { calories: 52, protein: 0.3, fat: 0.2, carbs: 13.8, fiber: 2.4 }, serving: 150 },
  { id: 'o3', name: 'Orange', category: 'Obst', macros: { calories: 47, protein: 0.9, fat: 0.1, carbs: 11.8, fiber: 2.4 }, serving: 150 },
  { id: 'o4', name: 'Erdbeeren', category: 'Obst', macros: { calories: 32, protein: 0.7, fat: 0.3, carbs: 7.7, fiber: 2.0 }, serving: 150 },
  { id: 'o5', name: 'Blaubeeren', category: 'Obst', macros: { calories: 57, protein: 0.7, fat: 0.3, carbs: 14.5, fiber: 2.4 }, serving: 100 },
  { id: 'o6', name: 'Wassermelone', category: 'Obst', macros: { calories: 30, protein: 0.6, fat: 0.2, carbs: 7.6, fiber: 0.4 }, serving: 200 },
  { id: 'o7', name: 'Mango', category: 'Obst', macros: { calories: 60, protein: 0.8, fat: 0.4, carbs: 15.0, fiber: 1.6 }, serving: 150 },
  { id: 'o8', name: 'Weintrauben', category: 'Obst', macros: { calories: 67, protein: 0.6, fat: 0.4, carbs: 17.2, fiber: 0.9 }, serving: 100 },
  { id: 'o9', name: 'Kiwi', category: 'Obst', macros: { calories: 61, protein: 1.1, fat: 0.5, carbs: 14.7, fiber: 3.0 }, serving: 100 },
  { id: 'o10', name: 'Ananas', category: 'Obst', macros: { calories: 50, protein: 0.5, fat: 0.1, carbs: 13.1, fiber: 1.4 }, serving: 150 },

  // MILCHPRODUKTE
  { id: 'm1', name: 'Vollmilch', category: 'Milchprodukte', macros: { calories: 61, protein: 3.2, fat: 3.3, carbs: 4.8 }, serving: 200 },
  { id: 'm2', name: 'Magerquark', category: 'Milchprodukte', macros: { calories: 67, protein: 12.0, fat: 0.3, carbs: 3.5 }, serving: 150 },
  { id: 'm3', name: 'Griechischer Joghurt (0%)', category: 'Milchprodukte', macros: { calories: 59, protein: 10.3, fat: 0.4, carbs: 3.6 }, serving: 200 },
  { id: 'm4', name: 'Mozzarella', category: 'Milchprodukte', macros: { calories: 254, protein: 17.1, fat: 20.3, carbs: 2.2 }, serving: 80 },
  { id: 'm5', name: 'Cheddar', category: 'Milchprodukte', macros: { calories: 402, protein: 25.0, fat: 33.1, carbs: 1.3 }, serving: 30 },
  { id: 'm6', name: 'Butter', category: 'Milchprodukte', macros: { calories: 717, protein: 0.9, fat: 81.1, carbs: 0.1 }, serving: 10 },
  { id: 'm7', name: 'Sahne', category: 'Milchprodukte', macros: { calories: 292, protein: 2.1, fat: 30.9, carbs: 3.5 }, serving: 30 },
  { id: 'm8', name: 'Frischkäse', category: 'Milchprodukte', macros: { calories: 342, protein: 6.2, fat: 34.3, carbs: 2.7 }, serving: 30 },
  { id: 'm9', name: 'Skyr', category: 'Milchprodukte', macros: { calories: 63, protein: 11.0, fat: 0.2, carbs: 4.0 }, serving: 150 },

  // GETREIDE & BROT
  { id: 'gr1', name: 'Weißreis (gekocht)', category: 'Getreide & Brot', macros: { calories: 130, protein: 2.7, fat: 0.3, carbs: 28.6, fiber: 0.4 }, serving: 150 },
  { id: 'gr2', name: 'Vollkornreis (gekocht)', category: 'Getreide & Brot', macros: { calories: 111, protein: 2.6, fat: 0.9, carbs: 22.8, fiber: 1.8 }, serving: 150 },
  { id: 'gr3', name: 'Haferflocken', category: 'Getreide & Brot', macros: { calories: 389, protein: 16.9, fat: 6.9, carbs: 66.3, fiber: 10.6 }, serving: 60 },
  { id: 'gr4', name: 'Pasta (gekocht)', category: 'Getreide & Brot', macros: { calories: 131, protein: 5.0, fat: 1.1, carbs: 25.1, fiber: 1.8 }, serving: 200 },
  { id: 'gr5', name: 'Vollkornbrot', category: 'Getreide & Brot', macros: { calories: 247, protein: 9.0, fat: 3.5, carbs: 43.5, fiber: 6.5 }, serving: 50 },
  { id: 'gr6', name: 'Toastbrot', category: 'Getreide & Brot', macros: { calories: 265, protein: 8.0, fat: 3.2, carbs: 49.9, fiber: 2.4 }, serving: 30 },
  { id: 'gr7', name: 'Quinoa (gekocht)', category: 'Getreide & Brot', macros: { calories: 120, protein: 4.4, fat: 1.9, carbs: 21.3, fiber: 2.8 }, serving: 150 },
  { id: 'gr8', name: 'Couscous (gekocht)', category: 'Getreide & Brot', macros: { calories: 112, protein: 3.8, fat: 0.2, carbs: 23.2, fiber: 1.4 }, serving: 150 },
  { id: 'gr9', name: 'Müsli (ohne Zucker)', category: 'Getreide & Brot', macros: { calories: 362, protein: 10.0, fat: 5.8, carbs: 66.7, fiber: 8.0 }, serving: 60 },
  { id: 'gr10', name: 'Bagel', category: 'Getreide & Brot', macros: { calories: 270, protein: 10.0, fat: 1.6, carbs: 52.4, fiber: 2.3 }, serving: 100 },

  // HÜLSENFRÜCHTE
  { id: 'h1', name: 'Linsen (gekocht)', category: 'Hülsenfrüchte', macros: { calories: 116, protein: 9.0, fat: 0.4, carbs: 20.1, fiber: 7.9 }, serving: 150 },
  { id: 'h2', name: 'Kichererbsen (gekocht)', category: 'Hülsenfrüchte', macros: { calories: 164, protein: 8.9, fat: 2.6, carbs: 27.4, fiber: 7.6 }, serving: 150 },
  { id: 'h3', name: 'Schwarze Bohnen (Dose)', category: 'Hülsenfrüchte', macros: { calories: 132, protein: 8.9, fat: 0.5, carbs: 23.7, fiber: 8.7 }, serving: 150 },
  { id: 'h4', name: 'Kidneybohnen', category: 'Hülsenfrüchte', macros: { calories: 127, protein: 8.7, fat: 0.5, carbs: 22.8, fiber: 6.4 }, serving: 150 },
  { id: 'h5', name: 'Edamame', category: 'Hülsenfrüchte', macros: { calories: 121, protein: 11.9, fat: 5.2, carbs: 8.9, fiber: 5.2 }, serving: 100 },

  // NÜSSE & SAMEN
  { id: 'n1', name: 'Mandeln', category: 'Nüsse & Samen', macros: { calories: 579, protein: 21.2, fat: 49.9, carbs: 21.6, fiber: 12.5 }, serving: 30 },
  { id: 'n2', name: 'Walnüsse', category: 'Nüsse & Samen', macros: { calories: 654, protein: 15.2, fat: 65.2, carbs: 13.7, fiber: 6.7 }, serving: 30 },
  { id: 'n3', name: 'Erdnussbutter', category: 'Nüsse & Samen', macros: { calories: 588, protein: 25.1, fat: 49.9, carbs: 20.1, fiber: 6.0 }, serving: 30 },
  { id: 'n4', name: 'Chiasamen', category: 'Nüsse & Samen', macros: { calories: 486, protein: 16.5, fat: 30.7, carbs: 42.1, fiber: 34.4 }, serving: 15 },
  { id: 'n5', name: 'Kürbiskerne', category: 'Nüsse & Samen', macros: { calories: 559, protein: 30.2, fat: 49.1, carbs: 10.7, fiber: 6.0 }, serving: 30 },
  { id: 'n6', name: 'Cashews', category: 'Nüsse & Samen', macros: { calories: 553, protein: 18.2, fat: 43.9, carbs: 30.2, fiber: 3.3 }, serving: 30 },

  // EIER
  { id: 'e1', name: 'Ei (gekocht)', category: 'Eier', macros: { calories: 155, protein: 13.0, fat: 10.6, carbs: 1.1 }, serving: 50 },
  { id: 'e2', name: 'Rührei', category: 'Eier', macros: { calories: 149, protein: 9.9, fat: 11.2, carbs: 1.6 }, serving: 100 },
  { id: 'e3', name: 'Omelett', category: 'Eier', macros: { calories: 154, protein: 10.6, fat: 12.1, carbs: 0.4 }, serving: 100 },

  // SNACKS
  { id: 's1', name: 'Kartoffelchips', category: 'Snacks', macros: { calories: 547, protein: 6.6, fat: 35.7, carbs: 52.9 }, serving: 30 },
  { id: 's2', name: 'Popcorn (gesalzen)', category: 'Snacks', macros: { calories: 375, protein: 12.0, fat: 4.3, carbs: 78.1 }, serving: 25 },
  { id: 's3', name: 'Müsliriegel', category: 'Snacks', macros: { calories: 373, protein: 7.5, fat: 9.4, carbs: 63.1 }, serving: 40 },
  { id: 's4', name: 'Proteinriegel', category: 'Snacks', macros: { calories: 340, protein: 25.0, fat: 8.0, carbs: 40.0 }, serving: 60 },
  { id: 's5', name: 'Reiskuchen', category: 'Snacks', macros: { calories: 387, protein: 7.5, fat: 2.8, carbs: 81.5 }, serving: 20 },
  { id: 's6', name: 'Tortilla Chips', category: 'Snacks', macros: { calories: 489, protein: 7.8, fat: 24.3, carbs: 63.6 }, serving: 30 },
  { id: 's7', name: 'Salzstangen', category: 'Snacks', macros: { calories: 383, protein: 9.8, fat: 4.0, carbs: 78.5 }, serving: 30 },

  // SÜSSIGKEITEN
  { id: 'sw1', name: 'Milchschokolade', category: 'Süßigkeiten', macros: { calories: 535, protein: 7.6, fat: 29.7, carbs: 59.4 }, serving: 40 },
  { id: 'sw2', name: 'Zartbitterschokolade (70%)', category: 'Süßigkeiten', macros: { calories: 598, protein: 7.8, fat: 43.1, carbs: 45.9 }, serving: 30 },
  { id: 'sw3', name: 'Gummibärchen', category: 'Süßigkeiten', macros: { calories: 343, protein: 6.3, fat: 0.1, carbs: 77.0 }, serving: 50 },
  { id: 'sw4', name: 'Eis (Vanille)', category: 'Süßigkeiten', macros: { calories: 207, protein: 3.5, fat: 11.0, carbs: 23.6 }, serving: 100 },
  { id: 'sw5', name: 'Keks (Butterkeks)', category: 'Süßigkeiten', macros: { calories: 458, protein: 7.3, fat: 14.9, carbs: 74.8 }, serving: 20 },
  { id: 'sw6', name: 'Nutella', category: 'Süßigkeiten', macros: { calories: 530, protein: 6.3, fat: 30.9, carbs: 57.5 }, serving: 20 },
  { id: 'sw7', name: 'Croissant', category: 'Süßigkeiten', macros: { calories: 406, protein: 8.2, fat: 21.0, carbs: 45.7 }, serving: 60 },

  // GETRÄNKE
  { id: 'dr1', name: 'Orangensaft', category: 'Getränke', macros: { calories: 45, protein: 0.7, fat: 0.2, carbs: 10.4 }, serving: 200 },
  { id: 'dr2', name: 'Vollmilch', category: 'Getränke', macros: { calories: 61, protein: 3.2, fat: 3.3, carbs: 4.8 }, serving: 200 },
  { id: 'dr3', name: 'Coca-Cola', category: 'Getränke', macros: { calories: 42, protein: 0, fat: 0, carbs: 10.6 }, serving: 330 },
  { id: 'dr4', name: 'Cola Zero', category: 'Getränke', macros: { calories: 1, protein: 0, fat: 0, carbs: 0.1 }, serving: 330 },
  { id: 'dr5', name: 'Kaffee (schwarz)', category: 'Getränke', macros: { calories: 2, protein: 0.3, fat: 0, carbs: 0 }, serving: 200 },
  { id: 'dr6', name: 'Latte Macchiato', category: 'Getränke', macros: { calories: 72, protein: 3.6, fat: 3.2, carbs: 7.2 }, serving: 300 },
  { id: 'dr7', name: 'Protein Shake', category: 'Getränke', macros: { calories: 120, protein: 25.0, fat: 1.5, carbs: 4.0 }, serving: 300 },
  { id: 'dr8', name: 'Grüner Tee', category: 'Getränke', macros: { calories: 1, protein: 0, fat: 0, carbs: 0.2 }, serving: 200 },
  { id: 'dr9', name: 'Apfelsaftschorle', category: 'Getränke', macros: { calories: 24, protein: 0.1, fat: 0, carbs: 5.8 }, serving: 300 },
  { id: 'dr10', name: 'Bier (0.5L)', category: 'Getränke', macros: { calories: 215, protein: 1.5, fat: 0, carbs: 13.0 }, serving: 500 },
  { id: 'dr11', name: 'Rotwein (Glas)', category: 'Getränke', macros: { calories: 85, protein: 0.1, fat: 0, carbs: 2.7 }, serving: 125 },
  { id: 'dr12', name: 'Smoothie (Beeren)', category: 'Getränke', macros: { calories: 63, protein: 1.0, fat: 0.5, carbs: 14.0 }, serving: 250 },

  // SAUCEN & DIPS
  { id: 'sa1', name: 'Ketchup', category: 'Saucen & Dips', macros: { calories: 112, protein: 1.4, fat: 0.2, carbs: 27.0 }, serving: 20 },
  { id: 'sa2', name: 'Mayonnaise', category: 'Saucen & Dips', macros: { calories: 680, protein: 1.0, fat: 75.0, carbs: 1.0 }, serving: 15 },
  { id: 'sa3', name: 'Hummus', category: 'Saucen & Dips', macros: { calories: 166, protein: 7.9, fat: 9.6, carbs: 14.3 }, serving: 50 },
  { id: 'sa4', name: 'Guacamole', category: 'Saucen & Dips', macros: { calories: 160, protein: 2.0, fat: 14.7, carbs: 8.5 }, serving: 50 },

  // ÖLE & FETTE
  { id: 'fat1', name: 'Olivenöl', category: 'Öle & Fette', macros: { calories: 884, protein: 0, fat: 100, carbs: 0 }, serving: 10 },
  { id: 'fat2', name: 'Kokosöl', category: 'Öle & Fette', macros: { calories: 862, protein: 0, fat: 100, carbs: 0 }, serving: 10 },
  { id: 'fat3', name: 'Avocado', category: 'Öle & Fette', macros: { calories: 160, protein: 2.0, fat: 14.7, carbs: 8.5, fiber: 6.7 }, serving: 100 },

  // FAST FOOD
  { id: 'ff1', name: 'Big Mac', category: 'Fast Food', macros: { calories: 508, protein: 27.0, fat: 26.0, carbs: 45.0 }, serving: 202 },
  { id: 'ff2', name: 'McChicken', category: 'Fast Food', macros: { calories: 436, protein: 22.0, fat: 20.8, carbs: 40.2 }, serving: 162 },
  { id: 'ff3', name: 'Pommes Frites (mittel)', category: 'Fast Food', macros: { calories: 337, protein: 4.2, fat: 17.2, carbs: 44.8 }, serving: 117 },
  { id: 'ff4', name: 'Subway Chicken (15cm)', category: 'Fast Food', macros: { calories: 290, protein: 23.0, fat: 5.0, carbs: 38.0 }, serving: 220 },
  { id: 'ff5', name: 'Whopper', category: 'Fast Food', macros: { calories: 657, protein: 28.0, fat: 40.0, carbs: 49.0 }, serving: 270 },
  { id: 'ff6', name: 'Starbucks Latte (Groß)', category: 'Fast Food', macros: { calories: 190, protein: 11.0, fat: 7.0, carbs: 21.0 }, serving: 473 },
  { id: 'ff7', name: 'Döner Kebab', category: 'Fast Food', macros: { calories: 320, protein: 22.0, fat: 12.0, carbs: 32.0 }, serving: 300 },
  { id: 'ff8', name: 'Pizza Margherita (1 Stück)', category: 'Fast Food', macros: { calories: 266, protein: 11.0, fat: 10.0, carbs: 33.0 }, serving: 100 },
]

export function searchFoods(query: string): FoodItem[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return FOOD_DATABASE.filter(
    (f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q) || (f.brand ?? '').toLowerCase().includes(q)
  ).slice(0, 20)
}

export function getFoodsByCategory(category: string): FoodItem[] {
  return FOOD_DATABASE.filter((f) => f.category === category)
}

export function calculateMacros(food: FoodItem, amount: number) {
  const ratio = amount / 100
  return {
    calories: Math.round(food.macros.calories * ratio),
    protein: Math.round(food.macros.protein * ratio * 10) / 10,
    fat: Math.round(food.macros.fat * ratio * 10) / 10,
    carbs: Math.round(food.macros.carbs * ratio * 10) / 10,
  }
}
