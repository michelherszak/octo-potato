import type { Metadata } from "next";
import "./globals.css";
import {topics} from '@/lib/catalog';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';
import {siteUrl} from '@/lib/content';
import {SITE_NAME} from '@/lib/seo';
import AnalyticsTracker from './AnalyticsTracker';
import UserMenu from './UserMenu';

const title="TechThese – Technologie verstehen. Unternehmen einordnen.";
const description="Verständliche Technologieanalysen und Aktienmemos mit Kennzahlen, Quellen und nachvollziehbaren Thesen.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title,
  description,
  openGraph: {type:"website", locale:"de_DE", siteName:SITE_NAME, title, description, url:siteUrl()},
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
        <header className="site-header"><a className="brand" href="/" aria-label="TechThese Startseite"><span className="brand-mark">t<span>t</span></span>TechThese<span className="brand-period">.</span></a><UserMenu config={getPublicSupabaseConfig()}/></header>
        {children}
        <footer className="site-footer"><div><a className="brand" href="/">TechThese<span className="brand-period">.</span></a><p>Technologie verstehen.<br/>Unternehmen einordnen.</p></div><div><span className="eyebrow">Wissensbereiche</span>{topics.slice(0,4).map(t=><a key={t.id} href={'/themen/'+t.id}>{t.name}</a>)}</div><div><span className="eyebrow">Über TechThese</span><a href="/rechtliches">Impressum &amp; Rechtliches</a><a href="/themen">Alle Themen</a><a href="/entdecken">Themen entdecken</a><a href="/methodik">Methodik &amp; Quellen</a><a href="/autor">Redaktion</a><a href="/login">Login / Konto</a><a href="/konto#benachrichtigungen">E-Mail-Updates verwalten</a><a href="/admin">Redaktionszugang</a><p className="muted">Analysen mit festem Datenstand.<br/>Bewertungen enthalten Annahmen.</p></div><div className="footer-bottom">© {new Date().getFullYear()} TechThese <span>Wissen wird wertvoll, wenn Zusammenhänge sichtbar werden.</span></div></footer>
        <AnalyticsTracker/>
      </body>
    </html>
  );
}
