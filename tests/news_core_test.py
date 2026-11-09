import importlib.util
import unittest
from datetime import date
from pathlib import Path

spec = importlib.util.spec_from_file_location('news_core', Path(__file__).resolve().parents[1] / 'integrations/evaluating-stocks/website_news_core.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def submissions(rows):
    """Aufbau wie data.sec.gov/submissions: parallele Listen unter filings.recent."""
    keys = ('filingDate', 'form', 'items', 'accessionNumber', 'primaryDocument')
    return {'cik': '1835632', 'filings': {'recent': {key: [row[i] for row in rows] for i, key in enumerate(keys)}}}


SINCE, UNTIL = date(2026, 10, 10), date(2026, 11, 9)


class ClassifyTests(unittest.TestCase):
    def test_eight_k_items_follow_priority(self):
        self.assertEqual(core.classify('8-K', '2.02,7.01,9.01'), 'quartalszahlen')
        self.assertEqual(core.classify('8-K', '1.01,9.01'), 'vertraege')
        self.assertEqual(core.classify('8-K', '5.02'), 'management')
        self.assertEqual(core.classify('8-K/A', '2.01'), 'uebernahme')

    def test_exhibit_only_and_unrelated_forms_are_dropped(self):
        self.assertIsNone(core.classify('8-K', '9.01'))
        self.assertIsNone(core.classify('S-8', ''))
        self.assertIsNone(core.classify('10-Q', ''))

    def test_forms_and_amendments(self):
        self.assertEqual(core.classify('425'), 'uebernahme')
        self.assertEqual(core.classify('6-K'), 'pressemitteilung')
        self.assertEqual(core.classify('4/A'), 'insider')
        self.assertEqual(core.classify('SCHEDULE 13G/A'), 'grossaktionaere')


class CollectTests(unittest.TestCase):
    def setUp(self):
        self.rows = [
            ('2026-11-02', '8-K', '2.02,7.01,9.01', '0001193125-26-442714', 'd81187d8k.htm'),
            *[('2026-11-02', '425', '', f'0001193125-26-44{n:04d}', 'd425.htm') for n in range(10)],
            ('2026-11-03', '4', '', '0000315066-26-000001', 'xslF345X06/form4.xml'),
            ('2026-11-04', 'S-8', '', '0000000000-26-000001', 's8.htm'),
            ('2026-09-01', '8-K', '8.01', '0000000000-26-000002', 'old.htm'),
        ]
        self.drafts = core.collect(submissions(self.rows), 'Marvell', SINCE, UNTIL)

    def test_same_category_on_the_same_day_becomes_one_entry(self):
        merger = [d for d in self.drafts if d['category'] == 'uebernahme']
        self.assertEqual(len(merger), 1)
        self.assertEqual(merger[0]['count'], 10)
        self.assertIn('10 Einreichungen', merger[0]['source'])

    def test_window_and_irrelevant_forms_are_respected(self):
        self.assertEqual({d['category'] for d in self.drafts}, {'quartalszahlen', 'uebernahme', 'insider'})
        self.assertTrue(all(SINCE.isoformat() <= d['date'] <= UNTIL.isoformat() for d in self.drafts))

    def test_insider_trades_start_deselected_and_links_point_to_the_filing(self):
        insider = next(d for d in self.drafts if d['category'] == 'insider')
        self.assertFalse(insider['include'])
        earnings = next(d for d in self.drafts if d['category'] == 'quartalszahlen')
        self.assertTrue(earnings['include'])
        self.assertEqual(earnings['source_url'], 'https://www.sec.gov/Archives/edgar/data/1835632/000119312526442714/d81187d8k.htm')
        self.assertEqual(earnings['source'], 'SEC EDGAR, 8-K Item 2.02, 7.01')
        self.assertEqual(earnings['headline'], 'Marvell legt Geschäftszahlen vor')

    def test_newest_first(self):
        dates = [d['date'] for d in self.drafts]
        self.assertEqual(dates, sorted(dates, reverse=True))


class ExhibitTests(unittest.TestCase):
    def test_press_release_exhibit_is_found(self):
        names = ['0001193125-26-442714-index.html', 'd81187d8k.htm', 'd81187dex991.htm', 'd81187dex992.htm']
        self.assertEqual(core.pick_exhibit(names), 'd81187dex991.htm')
        # Echte Dateinamen einer SEALSQ-6-K: Bilder mit fast gleichem Namen dürfen nicht gewählt werden.
        real = ['ea0309878-6k_sealsq.htm', 'ea030987801_ex99-1img1.jpg', 'ea030987801ex99-1.htm', 'ea030987801ex99-2.htm']
        self.assertEqual(core.pick_exhibit(real), 'ea030987801ex99-1.htm')
        self.assertEqual(core.pick_exhibit(['a_ex99-1_sealsq.htm']), 'a_ex99-1_sealsq.htm')
        self.assertIsNone(core.pick_exhibit(['ea0308854-6k_sealsq.htm']), 'eine 6-K ohne Anlage')
        self.assertIsNone(core.pick_exhibit(['dex9910.htm']), 'Anlage 99.10 ist nicht 99.1')
        self.assertIsNone(core.pick_exhibit(['form4.xml', 'd8k.htm']))

    def test_title_hint_skips_generic_labels(self):
        html = '<html><head><title>Document</title></head><body><p><b>Exhibit 99.1</b></p><p><b>MARVELL AND LUMENTUM TO COMBINE</b></p></body></html>'
        self.assertEqual(core.exhibit_title(html), 'MARVELL AND LUMENTUM TO COMBINE')
        self.assertEqual(core.exhibit_title('<p>kein Titel</p>'), '')
        self.assertEqual(core.exhibit_title(None), '')


class PacketTests(unittest.TestCase):
    review = {'reviewer': 'Redaktion', 'rights_basis': 'SEC EDGAR'}

    def entry(self, **changes):
        base = {'include': True, 'date': '2026-11-02', 'category': 'uebernahme',
                'headline': 'Marvell und Lumentum wollen sich zusammenschließen', 'summary': 'Eigene Zusammenfassung.',
                'source': 'SEC EDGAR, 8-K Item 2.02', 'source_url': 'https://www.sec.gov/Archives/edgar/data/1/2/a.htm', 'form': '8-K'}
        return {**base, **changes}

    def test_only_included_entries_are_sent(self):
        packet = core.build_packet('id', 'mrvl', [self.entry(), self.entry(include=False)], self.review)
        self.assertEqual(packet['ticker'], 'MRVL')
        self.assertEqual(len(packet['items']), 1)
        self.assertNotIn('include', packet['items'][0])

    def test_invalid_entries_are_refused_with_a_message(self):
        for changes in ({'headline': 'Kurz'}, {'summary': 'x' * 601}, {'category': 'geruecht'},
                        {'source_url': 'http://www.sec.gov/a.htm'}, {'date': 'gestern'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                core.build_packet('id', 'MRVL', [self.entry(**changes)], self.review)


if __name__ == '__main__':
    unittest.main()
