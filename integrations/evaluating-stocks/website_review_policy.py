"""Publication checks without network or application dependencies."""
import re


def normalized(text):
    return re.sub(r'\W+', '', text.casefold())


def validate_review(editorial, original_thesis, original_memo, saved_editorial, confirmations):
    if not all(confirmations.get(key) is True for key in ('edited', 'facts_checked', 'commercial_rights_confirmed')):
        raise ValueError('Nachbearbeitung, Faktenprüfung und kommerzielle Nutzungsrechte müssen ausdrücklich bestätigt werden.')
    if saved_editorial != editorial:
        raise ValueError('Bitte genau diesen Entwurf erneut speichern, prüfen und freigeben.')
    for key, original in (('thesis', original_thesis), ('memo', original_memo)):
        if normalized(editorial[key]) == normalized(original):
            raise ValueError('Analyse und Memo müssen beide redaktionell nachbearbeitet werden; unveränderte Ausgangstexte sind gesperrt.')
    for key, minimum in (('rights_basis', 30), ('conflicts', 20), ('advertising_details', 20)):
        if len(editorial.get(key, '').strip()) < minimum:
            raise ValueError('Bitte Nutzungsrechte, Interessenkonflikte und Finanzierung konkret dokumentieren.')
    if editorial.get('advertising') != 'none':
        raise ValueError('Bezahlte Beiträge und Affiliate-Inhalte sind bis zur gesonderten Werbe- und Datenschutzprüfung gesperrt.')
