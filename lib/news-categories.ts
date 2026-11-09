// Kategorien für Unternehmensmeldungen. Die Zuordnung zu SEC-Formularen und 8-K-Items
// trifft der Publisher (integrations/evaluating-stocks/website_news_core.py).
export const NEWS_CATEGORIES={
  quartalszahlen:'Quartalszahlen',
  vertraege:'Wesentliche Verträge',
  uebernahme:'Übernahme & Fusion',
  restrukturierung:'Restrukturierung',
  management:'Vorstand & Management',
  hauptversammlung:'Hauptversammlung',
  insider:'Insidergeschäfte',
  grossaktionaere:'Großaktionäre',
  pressemitteilung:'Pressemitteilung',
  medienbericht:'Medienbericht',
  sonstiges:'Sonstige Meldung',
} as const;

export type NewsCategory=keyof typeof NEWS_CATEGORIES;
export const NEWS_CATEGORY_IDS=Object.keys(NEWS_CATEGORIES) as [NewsCategory,...NewsCategory[]];
