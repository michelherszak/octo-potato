"""Route checks with isolated app dependencies; run with the Evaluating Stocks venv."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    import httpx
    from fastapi import FastAPI, HTTPException
    from fastapi.testclient import TestClient
except ImportError:
    raise unittest.SkipTest('Bridge route checks require the Evaluating Stocks Python environment')


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1] / 'integrations/evaluating-stocks'
        package = types.ModuleType('newscheck')
        package.__path__ = [str(root)]
        config = types.ModuleType('newscheck.config')
        config.DATA_DIR = Path('/unused-news-test-data')
        store = types.ModuleType('newscheck.store')
        store.read_json = lambda *args: {}
        store.write_json = lambda *args: None
        evaluation = types.ModuleType('newscheck.evaluation')
        evaluation.get_run = lambda _: {'ticker': 'ARQQ', 'name': 'Arqit Quantum'}
        publisher = types.ModuleType('newscheck.website_publish')
        publisher._settings = lambda: {'token': 'test-token', 'sec_contact': 'test@example.test'}
        publisher._target = lambda _: 'https://example.test'
        cls.modules = patch.dict(sys.modules, {m.__name__: m for m in [package, config, store, evaluation, publisher]})
        cls.modules.start()
        cls.addClassCleanup(cls.modules.stop)
        spec = importlib.util.spec_from_file_location('newscheck.website_news', root / 'website_news.py')
        cls.web = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.web
        spec.loader.exec_module(cls.web)
        app = FastAPI()
        app.include_router(cls.web.router)
        cls.client = TestClient(app)

    def setUp(self):
        self.web._last_gdelt[0] = 0
        self.article = {'url': 'https://www.reuters.com/technology/arqit/',
                        'title': 'Arqit signs major encryption contract with European bank',
                        'seendate': self.web.window()[1].strftime('%Y%m%dT120000Z'), 'language': 'English'}

    @staticmethod
    def response(status, data):
        return httpx.Response(status, json=data, request=httpx.Request('GET', 'https://api.gdeltproject.org/'))

    def test_sec_failure_still_returns_media(self):
        with patch.object(self.web, '_cik', side_effect=httpx.ConnectError('offline')), \
                patch.object(self.web.httpx, 'get', return_value=self.response(200, {'articles': [self.article]})):
            response = self.client.get('/api/website/runs/example/news')
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(len(data['drafts']), 1)
            self.assertIn('SEC EDGAR', data['notes'][0])
            self.assertEqual(data['drafts'][0]['headline'], '')

    def test_media_throttle_still_returns_sec(self):
        with patch.object(self.web, '_sec_drafts', return_value=[{'date': '2026-11-05', 'category': 'quartalszahlen'}]), \
                patch.object(self.web.httpx, 'get', return_value=self.response(429, {})):
            data = self.client.get('/api/website/runs/example/news').json()
            self.assertEqual(len(data['drafts']), 1)
            self.assertIn('drosselt', data['notes'][0])

    def test_non_sec_company_can_load_media(self):
        with patch.object(self.web, '_cik', side_effect=HTTPException(404, 'Nicht SEC-registriert')), \
                patch.object(self.web.httpx, 'get', return_value=self.response(200, {'articles': [self.article]})):
            data = self.client.get('/api/website/runs/example/news').json()
            self.assertEqual(len(data['drafts']), 1)

    def test_original_hint_never_enters_push_and_empty_headline_is_rejected(self):
        entry = self.web.media_drafts({'articles': [self.article]}, 'Arqit Quantum', 'ARQQ')[0]
        body = {'approved': True, 'publication_id': '6b2f1c3e-7a6d-4c8b-9e0f-1a2b3c4d5e6f',
                'target_url': 'https://example.test', 'reviewer': 'Redaktion',
                'conflicts': 'Keine Positionen oder Vergütung für diese Zusammenstellung.',
                'entries': [{**entry, 'include': True}]}
        with patch.object(self.web.httpx, 'post', return_value=self.response(201, {'items': 1})) as send:
            self.assertEqual(self.client.post('/api/website/runs/example/news', json=body).status_code, 409)
            send.assert_not_called()
            body['entries'][0]['headline'] = 'Arqit gewinnt eine europäische Bank als Kunden'
            self.assertEqual(self.client.post('/api/website/runs/example/news', json=body).status_code, 200)
            packet = send.call_args.kwargs['json']
            self.assertNotIn('hint', packet['items'][0])
            self.assertIn('GDELT Project', packet['editorial_review']['rights_basis'])


if __name__ == '__main__':
    unittest.main()
