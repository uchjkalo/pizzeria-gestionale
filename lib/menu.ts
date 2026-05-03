export type MenuCategory = "pizze" | "panini" | "burger" | "fritti" | "bibite" | "specialita";
export type DietTag = "normale" | "vegetariano" | "vegano";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  maxiPrice?: number;
  category: MenuCategory;
  ingredients: string[];
  tag: DietTag;
  note?: string;
  glutenFree?: boolean;  // disponibile senza glutine
}

export const menu: MenuItem[] = [
  // ========== PIZZE — tutte disponibili su base senza glutine ==========
  { id: "p01", name: "Cosacca",           price: 5.5,  maxiPrice: 13, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["pomodoro", "olio e.v.o.", "basilico", "pecorino"] },
  { id: "p02", name: "Marinara",          price: 5.5,  maxiPrice: 13, category: "pizze", tag: "vegano",      glutenFree: true, ingredients: ["pomodoro", "olio e.v.o.", "basilico", "aglio", "origano"] },
  { id: "p03", name: "Margherita",        price: 6.0,  maxiPrice: 14, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["pomodoro", "fior di latte", "basilico", "olio e.v.o."] },
  { id: "p04", name: "Siciliana",         price: 8.5,  maxiPrice: 19, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "acciughe", "olive taggiasche", "capperi", "basilico", "aglio", "origano", "olio e.v.o."] },
  { id: "p05", name: "Prosciutto e Funghi", price: 8.5, maxiPrice: 19, category: "pizze", tag: "normale",    glutenFree: true, ingredients: ["pomodoro", "fior di latte", "funghi trifolati freschi", "prosciutto cotto", "olio e.v.o.", "pepe nero"] },
  { id: "p06", name: "San Daniele",       price: 9.0,  maxiPrice: 20, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "prosciutto crudo San Daniele"] },
  { id: "p07", name: "Capricciosa",       price: 10.0, maxiPrice: 22, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "prosciutto cotto", "funghi trifolati freschi", "carciofi", "olive"] },
  { id: "p08", name: "Diavola",           price: 9.0,  maxiPrice: 20, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "salame piccante", "nduja", "paprika", "basilico"] },
  { id: "p09", name: "Villach",           price: 9.0,  maxiPrice: 20, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "wurstel", "patatine fritte"] },
  { id: "p10", name: "Friulana",          price: 9.0,  maxiPrice: 20, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "patate al forno", "salsiccia locale", "olio e.v.o."] },
  { id: "p11", name: "Tonno e Cipolla",   price: 9.0,  maxiPrice: 20, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "cipolla rossa stufata", "tonno all'olio e.v.o.", "basilico"] },
  { id: "p12", name: "Vegetariana",       price: 9.0,  maxiPrice: 20, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["pomodoro", "fior di latte", "peperoni grigliati", "melanzane fritte", "zucchine marinate"] },
  { id: "p13", name: "4 Formaggi",        price: 9.5,  maxiPrice: 22, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["fior di latte", "gorgonzola", "montasio", "grana padano", "noce moscata"], note: "BIANCA" },
  { id: "p14", name: "Carso",             price: 8.0,  maxiPrice: 18, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["fior di latte", "prosciutto cotto stufato", "kren"], note: "BIANCA" },
  { id: "p15", name: "Patate e Provola",  price: 10.0, maxiPrice: 22, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["patate al forno", "provola", "fior di latte", "guanciale romano", "pepe nero"], note: "BIANCA" },
  { id: "p16", name: "Estiva",            price: 11.0, maxiPrice: 24, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "rucola", "grana padano", "pomodorini", "prosciutto San Daniele"] },
  { id: "p17", name: "Bufala",            price: 9.5,  maxiPrice: 21, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["pomodoro", "bufala", "pomodorini", "basilico", "olio e.v.o."] },
  { id: "p18", name: "Parmigiana",        price: 10.5, maxiPrice: 23, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["pomodoro", "bufala", "melanzane fritte", "grana padano", "basilico", "olio e.v.o."] },
  { id: "p19", name: "Principe",          price: 9.5,  maxiPrice: 21, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["fior di latte", "panna", "prosciutto San Daniele", "semi di papavero"], note: "BIANCA" },
  { id: "p20", name: "Valcellina",        price: 10.0, maxiPrice: 22, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "provola affumicata", "funghi trifolati freschi", "speck"] },
  { id: "p21", name: "Spaccanapoli",      price: 10.0, maxiPrice: 22, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["fior di latte", "friarielli", "salsiccia", "provola affumicata"], note: "BIANCA" },
  { id: "p22", name: "Fiore",             price: 11.0, maxiPrice: 24, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["fior di latte", "fiori di zucca", "acciughe", "burrata", "basilico", "olio e.v.o."], note: "BIANCA" },
  { id: "p23", name: "Carbonara",         price: 10.0, maxiPrice: 22, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["fior di latte", "uovo", "guanciale romano", "pecorino", "pepe nero"], note: "BIANCA" },
  { id: "p24", name: "Al Cjanton",        price: 12.0, maxiPrice: 26, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["pomodoro", "fior di latte", "porcini", "montasio", "pitina"] },
  { id: "p25", name: "Monciaduda",        price: 10.0, maxiPrice: 22, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["bufala", "asparagi", "patate al forno", "olio al tartufo", "pepe nero"], note: "BIANCA" },
  { id: "p26", name: "1954",              price: 12.0, maxiPrice: 26, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["olio all'aglio", "grana padano", "fior di latte", "porcini", "porchetta", "maionese", "prezzemolo"], note: "BIANCA" },
  { id: "p27", name: "Ortolana",          price: 10.5, maxiPrice: 23, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["pomodoro", "pomodorini", "zucchine marinate", "cipolla rossa stufata", "burrata", "olio e.v.o.", "basilico"] },
  { id: "p28", name: "Mediterranea",      price: 10.5, maxiPrice: 23, category: "pizze", tag: "vegetariano", glutenFree: true, ingredients: ["pomodoro", "mozzarella di bufala", "pomodori secchi", "pesto", "basilico", "olio e.v.o."] },
  { id: "p29", name: "Biancaneve",        price: 11.0, maxiPrice: 24, category: "pizze", tag: "normale",     glutenFree: true, ingredients: ["fior di latte", "mortadella", "burrata", "granella di pistacchio", "basilico", "olio e.v.o."], note: "BIANCA" },
  { id: "p30", name: "Romana Ripiena",    price: 12.0,               category: "pizze", tag: "normale",     glutenFree: false, ingredients: ["bufala", "mortadella", "olio e.v.o.", "basilico", "pepe nero"], note: "BIANCA RIPIENA" },
  { id: "p31", name: "Calzone",           price: 9.0,                category: "pizze", tag: "normale",     glutenFree: false, ingredients: ["pomodoro", "fior di latte", "prosciutto cotto", "funghi trifolati freschi", "grana padano", "origano"] },
  { id: "p32", name: "Calzone Vesuvio",   price: 10.5,               category: "pizze", tag: "normale",     glutenFree: false, ingredients: ["pomodoro", "fior di latte", "nduja calabrese", "grana padano", "cipolla rossa caramellata", "olive taggiasche", "basilico"] },

  // ========== PANINI — contengono glutine ==========
  { id: "pa1", name: "Mortazza",    price: 10.0, category: "panini", tag: "normale",     glutenFree: false, ingredients: ["mortadella", "burrata o stracciatella", "granella di pistacchi"] },
  { id: "pa2", name: "Giannone",    price: 9.0,  category: "panini", tag: "normale",     glutenFree: false, ingredients: ["porchetta", "cipolla caramellata", "provola affumicata"] },
  { id: "pa3", name: "Furlan",      price: 11.0, category: "panini", tag: "vegetariano", glutenFree: false, ingredients: ["frico", "cipolla caramellata", "funghi trifolati"] },
  { id: "pa4", name: "Made in Italy", price: 9.0, category: "panini", tag: "normale",    glutenFree: false, ingredients: ["rucola", "grana padano", "pomodorini", "prosciutto San Daniele"] },
  { id: "pa5", name: "Caesar",      price: 9.0,  category: "panini", tag: "normale",     glutenFree: false, ingredients: ["cotoletta", "zucchine marinate in lime e menta", "maionese"] },
  { id: "pa6", name: "Bufalove",    price: 10.0, category: "panini", tag: "vegetariano", glutenFree: false, ingredients: ["mozzarella di bufala", "pomodorini", "zucchine marinate", "basilico", "olio evo"] },

  // ========== BURGER — contengono glutine ==========
  { id: "b1", name: "Classic Burger",      price: 11.0, category: "burger", tag: "normale", glutenFree: false, ingredients: ["burger di manzo", "insalata", "pomodoro a fette", "cetriolini", "cipolla caramellata", "salsa della casa"] },
  { id: "b2", name: "Bacon Cheese Burger", price: 12.0, category: "burger", tag: "normale", glutenFree: false, ingredients: ["burger di manzo", "formaggio", "pancetta croccante", "cetriolini", "cipolla caramellata", "salsa della casa"] },
  { id: "b3", name: "Maradona",            price: 12.0, category: "burger", tag: "normale", glutenFree: false, ingredients: ["burger di manzo", "pancetta croccante", "friarielli", "provola affumicata", "maionese"] },
  { id: "b4", name: "ST. 251",             price: 14.0, category: "burger", tag: "normale", glutenFree: false, ingredients: ["burger di manzo", "insalata", "pomodoro a fette", "pitina", "funghi porcini", "montasio", "salsa della casa"] },

  // ========== FRITTI ==========
  { id: "f1", name: "Cono di Patate Fritte", price: 3.5, category: "fritti", tag: "vegano",  glutenFree: true,  ingredients: ["patate"] },
  { id: "f2", name: "Nuggets di Pollo",       price: 6.0, category: "fritti", tag: "normale", glutenFree: false, ingredients: ["pollo"] },

  // ========== BIBITE — tutte senza glutine ==========
  { id: "bi1", name: "Acqua 0.5lt",          price: 1.5, category: "bibite", tag: "vegano", glutenFree: true, ingredients: [] },
  { id: "bi2", name: "Bibita",               price: 3.0, category: "bibite", tag: "vegano", glutenFree: true, ingredients: [], note: "Coca Cola, Fanta, Sprite..." },
  { id: "bi3", name: "Birra Bionda Piccola", price: 3.5, category: "bibite", tag: "vegano", glutenFree: false, ingredients: [] },
  { id: "bi4", name: "Birra Bionda Grande",  price: 6.0, category: "bibite", tag: "vegano", glutenFree: false, ingredients: [] },
  { id: "bi5", name: "Birra IPA",            price: 5.0, category: "bibite", tag: "vegano", glutenFree: false, ingredients: [] },

  // ========== SPECIALITÀ ==========
  { id: "s1", name: "Cotoletta e Patatine", price: 12.0, category: "specialita", tag: "normale",     glutenFree: false, ingredients: ["cotoletta", "patatine fritte"] },
  { id: "s2", name: "Il Frico",             price: 12.0, category: "specialita", tag: "vegetariano", glutenFree: true,  ingredients: ["frico", "patate al forno", "insalata"] },

  // ========== PIZZA PERSONALIZZATA ==========
  { id: "custom_pizza", name: "Pizza Personalizzata", price: 6.0, category: "pizze", tag: "normale", glutenFree: true, ingredients: [], note: "🎨 PERSONALIZZATA" },
];

export const categoryLabels: Record<MenuCategory, string> = {
  pizze:      "🍕 Pizze",
  panini:     "🥪 Panini",
  burger:     "🍔 Burger",
  fritti:     "🍟 Fritti",
  bibite:     "🥤 Bibite",
  specialita: "⭐ Specialità",
};

export const tagColors: Record<DietTag, string> = {
  normale:      "bg-gray-600 text-gray-200",
  vegetariano:  "bg-green-700 text-green-100",
  vegano:       "bg-emerald-700 text-emerald-100",
};

export const EXTRA_INGREDIENTS: { name: string; price: number; type: "base" | "speciale" }[] = [
  { name: "Pomodoro",           price: 1, type: "base" },
  { name: "Funghi",             price: 1, type: "base" },
  { name: "Olive",              price: 1, type: "base" },
  { name: "Cipolla",            price: 1, type: "base" },
  { name: "Peperoni grigliati", price: 1, type: "base" },
  { name: "Basilico",           price: 1, type: "base" },
  { name: "Origano",            price: 1, type: "base" },
  { name: "Aglio",              price: 1, type: "base" },
  { name: "Capperi",            price: 1, type: "base" },
  { name: "Pomodorini",         price: 1, type: "base" },
  { name: "Zucchine marinate",  price: 1, type: "base" },
  { name: "Melanzane fritte",   price: 1, type: "base" },
  { name: "Uovo",               price: 1, type: "base" },
  { name: "Grana Padano",       price: 1, type: "base" },
  { name: "Pecorino",           price: 1, type: "base" },
  { name: "Patatine fritte",        price: 2.5, type: "speciale" },
  { name: "Prosciutto cotto",       price: 2,   type: "speciale" },
  { name: "Prosciutto San Daniele", price: 3,   type: "speciale" },
  { name: "Speck",                  price: 2,   type: "speciale" },
  { name: "Nduja",                  price: 2,   type: "speciale" },
  { name: "Salsiccia",              price: 2,   type: "speciale" },
  { name: "Pancetta",               price: 2,   type: "speciale" },
  { name: "Mortadella",             price: 2,   type: "speciale" },
  { name: "Tonno",                  price: 2,   type: "speciale" },
  { name: "Acciughe",               price: 2,   type: "speciale" },
  { name: "Mozzarella di bufala",   price: 3,   type: "speciale" },
  { name: "Burrata",                price: 3,   type: "speciale" },
  { name: "Gorgonzola",             price: 2,   type: "speciale" },
  { name: "Porcini",                price: 2,   type: "speciale" },
  { name: "Provola affumicata",     price: 2,   type: "speciale" },
  { name: "Montasio",               price: 2,   type: "speciale" },
  { name: "Wurstel",                price: 2,   type: "speciale" },
  { name: "Guanciale",              price: 2,   type: "speciale" },
];
