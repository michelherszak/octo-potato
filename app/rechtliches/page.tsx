import AnalyticsSettings from '../AnalyticsSettings';
import {pageMetadata} from '@/lib/seo';

export const metadata=pageMetadata({path:'/rechtliches',title:'Impressum & Rechtliches – TechThese',description:'Betreiberangaben, Datenschutz zu Benutzerkonto, E-Mail-Updates und Besucherstatistik sowie Hinweise zu Analysen und Quellen.'});

export default function Legal(){return <main id="inhalt" className="container narrow">
  <section className="page-heading"><p className="eyebrow">Rechtliches</p><h1>Impressum & Rechtliches</h1></section>
  <div className="prose">

    <section id="impressum">
      <h2>Impressum</h2>
      <p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>
      <address>
        Michel Herszak<br/>TechThese<br/>Mathildenhöhe 16<br/>07356 Bad Lobenstein
      </address>
      <h3>Kontakt</h3>
      <p>Telefon: <a href="tel:+4915172919222">+49 1517 2919222</a><br/>
        E-Mail: <a href="mailto:info@techthese.de">info@techthese.de</a></p>
      <h3>Berufsbezeichnung</h3>
      <p>Engineering Manager</p>
      <h3>Redaktionell verantwortlich nach § 18 Abs. 2 MStV</h3>
      <address>Michel Herszak<br/>Mathildenhöhe 16<br/>07356 Bad Lobenstein</address>
      <h3>Verbraucherstreitbeilegung</h3>
      <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      <h3>Zentrale Kontaktstelle nach dem Digital Services Act (Verordnung (EU) 2022/2065)</h3>
      <p>Die zentrale Kontaktstelle für Nutzerinnen, Nutzer und Behörden nach Art. 11 und 12 DSA ist erreichbar unter <a href="mailto:info@techthese.de">info@techthese.de</a>. Die für den Kontakt zur Verfügung stehenden Sprachen sind Deutsch und Englisch.</p>
    </section>

    <section id="datenschutz">
      <h2>Datenschutz</h2>
      <h3>Verantwortlicher</h3>
      <p>Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website im Sinne der Datenschutz-Grundverordnung ist Michel Herszak, Mathildenhöhe 16, 07356 Bad Lobenstein, <a href="mailto:info@techthese.de">info@techthese.de</a>.</p>
      <h3>Deine Rechte</h3>
      <p>Du hast das Recht auf Auskunft über die zu dir gespeicherten Daten, auf Berichtigung, Löschung und Einschränkung der Verarbeitung, auf Datenübertragbarkeit sowie auf Widerspruch gegen die Verarbeitung. Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt davon unberührt. Für Auskunft und Löschung genügt eine Nachricht an die oben genannte Adresse; Kontodaten kannst du zusätzlich jederzeit selbst im Kontobereich exportieren oder löschen.</p>
      <p>Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig ist der Thüringer Landesbeauftragte für den Datenschutz und die Informationsfreiheit.</p>
    </section>

    <h2>Benutzerkonto</h2>
    <p>Für Registrierung, E-Mail-Bestätigung, Anmeldung, Sitzungen und Passwort-Wiederherstellung nutzt TechThese Supabase Auth. Supabase verarbeitet dafür deine E-Mail-Adresse und das Passwort. TechThese erhält dein Passwort nicht und speichert es nicht in der eigenen Website-Datenbank.</p>
    <p>Nach bestätigter E-Mail-Adresse speichert TechThese eine technische Benutzerkennung, E-Mail-Adresse, Anzeigename, Profilbildpfad, Rolle, Kontostatus, Einwilligungsstände sowie Erstellungs-, Änderungs- und Anmeldezeitpunkte. Wenn du einem Unternehmen folgst, wird außerdem dessen Börsenkürzel deinem Konto zugeordnet. Ein freiwillig hochgeladenes Profilbild wird öffentlich über Supabase Storage ausgeliefert. Sicherheitsrelevante Kontoaktionen werden protokolliert. Im Kontobereich kannst du deine gespeicherten Kontodaten exportieren oder das Konto dauerhaft löschen. Bei der Löschung werden Profilbild und Supabase-Anmeldung entfernt, das lokale Profil anonymisiert und eine E-Mail-Benachrichtigung samt Versandaufträgen gelöscht.</p>

    <h2>Besucherstatistik</h2>
    <p>Nach deiner Einwilligung erzeugt TechThese eine zufällige, pseudonyme Besucherkennung in deinem Browser. Zusammen mit dieser Kennung werden die aufgerufene Seite, ihr Titel und der Zeitpunkt des Aufrufs in der Website-Datenbank gespeichert. TechThese speichert dafür keine IP-Adresse, keinen User-Agent und keine Klarnamen. Die Daten dienen ausschließlich dazu, Nutzung und Inhalte der Website zu verstehen.</p>
    <p>Du kannst die Erfassung ablehnen. Deine Auswahl wird in deinem Browser gespeichert. Statistikdaten werden nach 180 Tagen automatisch gelöscht und nicht an Werbenetzwerke oder externe Analysedienste übertragen.</p>
    <AnalyticsSettings/>

    <section id="email-updates">
      <h2>E-Mail-Konto und Unternehmens-Updates</h2>
      <p>Mit einem TechThese-Konto schaltest du E-Mail-Updates im Kontobereich oder direkt nach dem Folgen eines Unternehmens ausdrücklich ein. Dann nutzen wir die bestätigte Adresse deines Kontos, und die Unternehmen, denen du folgst, bestimmen, worüber du informiert wirst. Das Folgen allein löst keinen E-Mail-Versand aus. Zeitpunkt und Fassung deiner Einwilligung werden gespeichert und sind im Datenexport enthalten. Hattest du Updates früher ohne Konto mit derselben Adresse bestellt, wird deine bisherige Auswahl beim Einschalten in dein Konto übernommen.</p>
      <p>Du kannst deine E-Mail-Adresse bestätigen und einzelne Unternehmen oder alle neuen Beiträge abonnieren. Der Versand beginnt nach deiner ausdrücklichen Auswahl und Einwilligung. Die E-Mail-Anmeldung allein aktiviert keine Abonnements. Angekündigte inhaltliche Aktualisierungen können ebenfalls eine Nachricht auslösen.</p>
      <p>TechThese speichert deine E-Mail-Adresse, Bestätigung, Unternehmensauswahl und den Zeitpunkt deiner Einwilligung in der Cloudflare-Datenbank. Zugangslinks gelten 15 Minuten und werden wie Sitzungstoken nur als Hashwerte gespeichert. Ein technisch notwendiges HttpOnly-Sitzungscookie bleibt bis zu 30 Tage gültig. Zum Schutz vor Missbrauch gelten kurzlebige, mit einem geheimen Schlüssel abgeleitete Begrenzungskennungen für Adresse und IP; diese gelten höchstens 15 Minuten.</p>
      <p>Für Bestätigungs- und Update-E-Mails verwendet TechThese Resend (Plus Five Five, Inc., USA). Dazu werden Empfängeradresse und Nachricht einschließlich der Links an Resend übermittelt. Die Versanddomain ist updates.techthese.de; der Versand ist in der Resend-Region Irland eingerichtet. Die Versandregion legt nicht sämtliche Verarbeitungsorte des Anbieters fest; nach dessen Datenschutzhinweisen sind auch Übermittlungen in die USA möglich. Die Anwendung verwendet keine Öffnungspixel oder Klicktracker. Informationen des Dienstes findest du unter <a href="https://resend.com/legal/privacy-policy">Resend Datenschutz</a> und <a href="https://resend.com/legal/dpa">Resend Auftragsverarbeitung</a>.</p>
      <p>Unbestätigte Konten werden nach sieben Tagen entfernt. Abgelaufene Zugangslinks und Sitzungen werden bereinigt; erledigte oder fehlgeschlagene Versandaufträge nach 30 Tagen. Dein bestätigtes Konto bleibt bis zur Löschung bestehen. Du kannst den Versand pausieren, die Auswahl ändern, dein Konto löschen oder alle Updates über den Abmeldelink in jeder Nachricht beenden. Abbestellen erfordert keine Anmeldung. Bereits versendete E-Mails bleiben in deinem Postfach; für Daten beim Versanddienst gelten dessen eigene Fristen.</p>
    </section>

    <p>Der Hosting-Anbieter und Supabase können für Betrieb, Sicherheit und Zugang eigene technische Daten verarbeiten.</p>

    <section id="haftung">
      <h2>Inhalte und Haftung</h2>
      <p>Unternehmensbeschreibungen erläutern den Themenbezug. Eine Aufnahme in die Rechercheauswahl ist keine Kaufempfehlung. Beiträge und Bewertungen auf TechThese sind keine Anlageberatung und keine Kauf-, Verkaufs- oder Halteempfehlung. Sie geben die persönliche Einschätzung des Autors zum angegebenen Datenstand wieder. Wertpapiere unterliegen Kursschwankungen bis zum Totalverlust; Entscheidungen triffst du eigenständig und auf eigenes Risiko.</p>
      <p>Für Inhalte externer Links sind deren Betreiber verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar; eine dauerhafte inhaltliche Kontrolle fremder Seiten ist ohne konkrete Anhaltspunkte nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden entsprechende Links entfernt.</p>
    </section>

  </div>
</main>;}
