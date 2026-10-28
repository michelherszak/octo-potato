import importlib.util
import json
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('website_memo', Path(__file__).resolve().parents[1] / 'integrations/evaluating-stocks/website_memo.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MemoOverviewTests(unittest.TestCase):
    def test_export_is_bounded_and_keeps_reporting_currency(self):
        result = module.build_memo_overview({
            'fundamentals_currency': 'EUR', 'api_key': 'PRIVATE',
            'figures': {'revenue_ttm': 1e8, 'operating_cash_flow': -1e6, 'free_cash_flow': 0, 'piotroski_f_score': 0},
            'pl_breakdown': {'year': 2025, 'research_and_development': 2e6, 'private_notes': 'PRIVATE'},
            'plain': {'questions': [{'group': 'quality', 'question': {'de': 'Verdient die Firma Geld?'}, 'answer': {'de': 'Noch nicht'}, 'light': 'red', 'private': 'PRIVATE'}]},
        })
        self.assertNotIn('PRIVATE', json.dumps(result))
        self.assertEqual(result['piotroski']['score'], 0)
        self.assertEqual(result['questions'][0]['signal'], 'red')
        self.assertEqual(result['costs'][0]['period'], 'Geschäftsjahr 2025')
        self.assertIn('EUR', result['money_metrics'][0]['value'])
        self.assertIn('-', result['money_metrics'][1]['value'])
        self.assertEqual(result['money_metrics'][2]['value'], '0,00 EUR')

    def test_missing_and_invalid_scores_never_become_zero(self):
        for value in (None, True, False, float('nan'), float('inf'), -1, 10, 6.5, '7'):
            with self.subTest(value=value):
                result = module.build_memo_overview({'figures': {'piotroski_f_score': value, 'revenue_ttm': float('nan')}})
                self.assertIsNone(result['piotroski']['score'])
                self.assertEqual(result['money_metrics'], [])
                self.assertEqual(result['costs'], [])

    def test_costs_are_not_inferred_from_cash_flow_and_periods_are_separate(self):
        result = module.build_memo_overview({'figures': {'revenue_ttm': 100, 'operating_cash_flow': 20},
                                           'pl_breakdown': {'year': 2024, 'operating_expense': 0},
                                           'figure_evidence': {'revenue_ttm': {'period_end': '2026-06-30', 'source_url': 'javascript:bad'}}})
        self.assertEqual(len(result['costs']), 1)
        self.assertEqual(result['costs'][0]['value'], '0,00 Währung nicht dokumentiert')
        self.assertEqual(result['money_metrics'][0]['period'], '2026-06-30')
        self.assertNotIn('source_url', result['money_metrics'][0])

    def test_model_and_analyst_opinions_are_distinct(self):
        result = module.build_memo_overview({'verdict': 'Strong Sell', 'plain': {'street': {'street': 'Buy', 'n_analysts': 8, 'meaning': {'de': 'Unterschiedliche Erwartungen.'}}}})
        self.assertEqual(result['street']['verdict'], 'Buy')
        self.assertEqual(result['street']['analysts'], 8)
        self.assertIsNone(module.build_memo_overview({'plain': {'street': {'street': 'Unknown'}}})['street'])


if __name__ == '__main__':
    unittest.main()
