# Supabase Auth für TechThese

TechThese verwendet eigene Formulare für E-Mail und Passwort. Supabase Auth ist der
Identitätsdienst im Hintergrund und speichert/verifiziert die Passwörter. Die Website
speichert niemals Klartext-Passwörter.

## 1. Supabase-Projekt konfigurieren

Unter **Authentication → Sign In / Providers → Email**:

- E-Mail/Passwort aktivieren.
- **Confirm email** zwingend aktivieren. Ohne diese Einstellung ist nicht belegt, dass
  die registrierende Person Zugriff auf das Postfach hat.
- eine Passwort-Richtlinie mit mindestens 12 Zeichen festlegen; Groß- und
  Kleinbuchstaben, Zahl und Sonderzeichen verlangen.
- Schutz vor kompromittierten Passwörtern aktivieren, sofern der Tarif ihn unterstützt.

Unter **Authentication → URL Configuration**:

- die produktive TechThese-Adresse als Site URL setzen;
- `https://<techthese-domain>/auth/bestaetigen` und
  `https://<techthese-domain>/passwort-zuruecksetzen` als Redirect URLs erlauben;
- für lokale Tests zusätzlich `http://127.0.0.1:5180/auth/bestaetigen` und
  `http://127.0.0.1:5180/passwort-zuruecksetzen` erlauben.

## 2. E-Mails produktionsreif versenden

Der Supabase-Testmailer ist nicht für reale Registrierung geeignet. Vor dem Start:

- eigenes SMTP mit einer TechThese-Absenderdomain konfigurieren;
- SPF, DKIM und DMARC für die Absenderdomain einrichten;
- Vorlagen für Bestätigung, Passwort-Reset, E-Mail-Änderung und
  Sicherheitsbenachrichtigungen branden;
- Link-Tracking beim SMTP-Anbieter deaktivieren, damit Bestätigungslinks nicht verändert
  werden;
- Ablaufzeit der Links auf höchstens eine Stunde setzen;
- Auth-Rate-Limits prüfen und CAPTCHA für Registrierung, Anmeldung und Reset aktivieren.

Offizielle Referenzen:

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/security/production-checklist
- https://supabase.com/docs/guides/auth/rate-limits

## 3. Runtime-Secrets setzen

Lokal gehören diese Werte in die nicht versionierte `.dev.vars`, in Produktion in die
Secret-Verwaltung des Hostings:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...
```

Der Publishable Key wird an den Browser ausgeliefert und ist dafür vorgesehen. Der
Service-Role-Key ist ausschließlich serverseitig und wird für die vollständige
Kontolöschung benötigt. Er darf niemals in Client-Code, Logs oder Git erscheinen.

`michel.herszak@gmail.com` wird serverseitig als primärer Super Admin erkannt.
`ADMIN_EMAILS` kann zusätzliche Bootstrap-Super-Admins enthalten. Nach der ersten
bestätigten Anmeldung wird eine der Rollen `super_admin`, `buyer` oder `user` im
TechThese-Profil gespeichert.

## 4. Profilbilder sicher konfigurieren

Lege in Supabase Storage einen **öffentlichen** Bucket namens `avatars` an. Begrenze ihn
auf 2 MB und auf `image/jpeg`, `image/png` und `image/webp`. Profilbilder sind bewusst
öffentlich, damit sie ohne kurzlebige Signatur im Kopf der Website angezeigt werden
können. Upload, Überschreiben und Löschen bleiben durch RLS beim jeweiligen Benutzer.

Beispiel für die Storage-Policies:

```sql
create policy "avatar insert own path"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name = (select auth.uid()::text) || '/avatar'
);

create policy "avatar select own object"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
);

create policy "avatar update own object"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and name = (select auth.uid()::text) || '/avatar'
);

create policy "avatar delete own object"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
);
```

Supabase verlangt für Uploads mindestens `INSERT`; für `upsert` zusätzlich `SELECT` und
`UPDATE`. Der Service-Role-Key umgeht RLS und bleibt deshalb weiterhin ausschließlich
serverseitig.

Offizielle Storage-Referenzen:

- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/reference/javascript/storage-from-upload

## 5. Vor dem öffentlichen Start prüfen

- Registrierung mit einer neuen externen Adresse testen.
- Sicherstellen, dass vor dem Klick auf den Bestätigungslink keine Anmeldung möglich ist.
- abgelaufene und bereits verwendete Bestätigungslinks testen.
- Passwort-Reset und E-Mail-Änderung vollständig testen.
- Sperrung, Rollenänderung, Datenexport und Kontolöschung testen.
- Profilbild hochladen, ersetzen und löschen; Fremdzugriff auf einen anderen Benutzerpfad
  muss von Storage-RLS abgewiesen werden.
- Supabase-DPA, Auftragsverarbeitung, Datenschutztext und Löschfristen rechtlich prüfen.
- Supabase-Projekt und Organisation mit MFA schützen.

Wenn die Website beim Hosting weiterhin als **private Site** konfiguriert ist, kann vor
TechThese zusätzlich eine Plattform-Anmeldung erscheinen. Für ausschließlich Supabase
Auth muss die Website öffentlich erreichbar sein; die geschützten TechThese-Bereiche
bleiben durch die serverseitige Token- und Rollenprüfung geschützt.

## Zusammenspiel mit den E-Mail-Updates

TechThese betreibt zwei getrennte Systeme. Supabase Auth ist die Identität: Registrierung,
Anmeldung, Passwort-Wiederherstellung, Profil, Datenexport und Kontolöschung unter `/login`
und `/konto`. Die E-Mail-Updates aus `docs/email-accounts.md` bleiben unverändert und
arbeiten weiter mit eigener Zugangslink-Anmeldung, eigener Sitzung und eigenen Tabellen
(`subscribers`, `stock_subscriptions`, `account_sessions`, `email_login_tokens`); ihre
Oberfläche liegt jetzt unter `/konto/updates`.

Offene Punkte dieser Zusammenführung:

- **Zwei Anmeldungen.** Wer E-Mail-Updates verwalten möchte, meldet sich dort weiterhin
  mit einem Zugangslink an, auch wenn er bereits über Supabase angemeldet ist. Eine
  Verknüpfung über die E-Mail-Adresse ist noch nicht umgesetzt.
- **Zwei Folgen-Begriffe.** `company_follows` speichert das Folgen im Konto (Supabase-Benutzer,
  Schaltfläche auf der Unternehmensseite). `stock_subscriptions` steuert unverändert den
  E-Mail-Versand (Abonnent, Auswahl unter `/konto/updates`). Beide werden nicht automatisch
  synchronisiert: Folgen allein löst keine E-Mails aus.
- **Statistik-Ausschluss.** Der Ausschluss eigener Admin-Besuche prüft weiterhin die
  Plattform-Anmeldung über `app/chatgpt-auth.ts`, nicht die Supabase-Rolle.
