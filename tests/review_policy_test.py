import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('policy',Path(__file__).resolve().parents[1]/'integrations/evaluating-stocks/website_review_policy.py')
policy=importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.e={'thesis':'Eigene überarbeitete Analyse','memo':'Eigene überarbeitete Einordnung','rights_basis':'Eigene Texte; Daten mit bestätigter kommerzieller Nutzungslizenz.','conflicts':'Keine eigenen Positionen oder sonstige Vergütung.','advertising':'none','advertising_details':'Keine Vergütung für diesen Beitrag.'}
        self.checks=dict.fromkeys(('edited','facts_checked','commercial_rights_confirmed'),True)
    def validate(self,**kw):
        policy.validate_review(kw.get('editorial',self.e),'Originalthese','Originalmemo',kw.get('saved',self.e),kw.get('checks',self.checks))
    def test_reviewed_edited_draft_passes(self): self.validate()
    def test_unedited_or_cosmetic_only_rejected(self):
        for field,value in [('thesis','Originalthese'),('memo',' Originalmemo!!! ')]:
            e={**self.e,field:value}
            with self.assertRaises(ValueError): self.validate(editorial=e,saved=e)
    def test_changed_since_preview_rejected(self):
        with self.assertRaises(ValueError): self.validate(saved={**self.e,'memo':'Andere Fassung'})
    def test_every_confirmation_required(self):
        for key in self.checks:
            with self.assertRaises(ValueError): self.validate(checks={**self.checks,key:False})
    def test_missing_rights_or_conflicts_rejected(self):
        for key in ('rights_basis','conflicts','advertising_details'):
            e={**self.e,key:''}
            with self.assertRaises(ValueError): self.validate(editorial=e,saved=e)
    def test_paid_and_affiliate_rejected(self):
        for mode in ('paid','affiliate'):
            e={**self.e,'advertising':mode}
            with self.assertRaises(ValueError): self.validate(editorial=e,saved=e)

if __name__=='__main__':unittest.main()
