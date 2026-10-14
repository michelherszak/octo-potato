import type { Metadata } from "next";
import "./globals.css";
import {topics} from '@/lib/catalog';

export const metadata: Metadata = {
  title: "TechThese – Technologie verstehen. Unternehmen einordnen.",
  description: "Verständliche Technologieanalysen und Aktienmemos mit Kennzahlen, Quellen und nachvollziehbaren Thesen.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de"><body>
        <a className="skip-link" href="#inhalt">Zum Inhalt</a>
        <header className="site-header"><a className="brand" href="/" aria-label="TechThese Startseite"><span className="brand-mark">t<span>t</span></span>TechThese<span className="brand-period">.</span></a><nav aria-label="Hauptnavigation"><a href="/">Entdecken</a><a href="/themen">Themen</a><a href="/unternehmen">Unternehmen</a><a href="/methodik">Unsere Arbeitsweise</a></nav><a className="header-search" href="/#suche" aria-label="Beiträge suchen">Suchen <span>⌕</span></a></header>
        {children}
        <footer className="site-footer"><div><a className="brand" href="/">TechThese<span className="brand-period">.</span></a><p>Technologie verstehen.<br/>Unternehmen einordnen.</p></div><div><span className="eyebrow">Wissensbereiche</span>{topics.slice(0,4).map(t=><a key={t.id} href={'/themen/'+t.id}>{t.name}</a>)}</div><div><span className="eyebrow">Über TechThese</span><a href="/methodik">Methodik & Quellen</a><a href="/autor">Redaktion</a><a href="/rechtliches">Rechtliche Angaben</a><p className="muted">Analysen mit festem Datenstand.<br/>Bewertungen enthalten Annahmen.</p></div><div className="footer-bottom">© {new Date().getFullYear()} TechThese <span>Wissen wird wertvoll, wenn Zusammenhänge sichtbar werden.</span></div></footer>
      </body>
    </html>
  );
}
