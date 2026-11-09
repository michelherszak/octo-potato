"""Publication checks without network or application dependencies."""
import re


DISCLOSURE_PLACEHOLDER = '[bitte ergänzen]'
DISCLOSURE_TEMPLATES = {
    'rights_basis': f'Grundlage für die kommerzielle Nutzung der Texte, Daten und gegebenenfalls Bilder ist {DISCLOSURE_PLACEHOLDER}.',
    'conflicts': f'Der Autor erklärt zu eigenen Positionen, Vergütungen und Geschäftsbeziehungen {DISCLOSURE_PLACEHOLDER}.',
    'advertising_details': f'Der Beitrag wurde {DISCLOSURE_PLACEHOLDER} finanziert. Angaben zu Auftraggebern und Vergütung {DISCLOSURE_PLACEHOLDER}.',
}


def normalized(text):
    return re.sub(r'\W+', '', text.casefold())


def editorial_issues(editorial, original_thesis, original_memo):
    issues = []
    for key, original, label in (
        ('thesis', original_thesis, 'Deine Analyse & These'),
        ('memo', original_memo, 'Memo für die Leser'),
    ):
        if normalized(editorial[key]) == normalized(original):
            issues.append(f'„{label}“ redaktionell überarbeiten.')
    for key, minimum, label in (
        ('rights_basis', 30, 'Kommerzielle Nutzungsrechte'),
        ('conflicts', 20, 'Interessenkonflikte'),
        ('advertising_details', 20, 'Finanzierung dieses Beitrags'),
    ):
        value = editorial.get(key, '').strip()
        if DISCLOSURE_PLACEHOLDER in value.casefold():
            issues.append(f'„{label}“ prüfen und den Platzhalter durch die tatsächlichen Angaben ersetzen.')
            continue
        if key == 'rights_basis':
            basis = re.sub(r'^Dokumentierte Grundlage für die kommerzielle Nutzung\s*', '', value, flags=re.IGNORECASE)
            if not basis or re.fullmatch(r'(?:nein|kein(?:e|er|en|em|es)?|keine angaben|nicht bekannt|unklar|offen)[.!]?', basis.strip(), flags=re.IGNORECASE):
                issues.append('„Kommerzielle Nutzungsrechte“ mit einer konkreten Lizenz, Freigabe oder eigenen Rechten dokumentieren.')
                continue
        if len(value) < minimum:
            issues.append(f'„{label}“ konkret dokumentieren (mindestens {minimum} Zeichen).')
    if editorial.get('advertising') != 'none':
        issues.append('Bezahlte Beiträge und Affiliate-Inhalte sind bis zur gesonderten Prüfung gesperrt.')
    return issues


def validate_review(editorial, original_thesis, original_memo, saved_editorial, confirmations):
    if not all(confirmations.get(key) is True for key in ('edited', 'facts_checked', 'commercial_rights_confirmed')):
        raise ValueError('Nachbearbeitung, Faktenprüfung und kommerzielle Nutzungsrechte müssen ausdrücklich bestätigt werden.')
    if saved_editorial != editorial:
        raise ValueError('Bitte genau diesen Entwurf erneut speichern, prüfen und freigeben.')
    issues = editorial_issues(editorial, original_thesis, original_memo)
    if issues:
        raise ValueError(' '.join(issues))
