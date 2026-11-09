# Publishing from Evaluating Stocks

Production website: `https://techthese.de`. Cloudflare Worker: `octo-potato`.

The private Evaluating Stocks file `data/website_settings.json` holds the website
origin and the publication secret. The same secret must be set as the Worker's
runtime secret `PUBLISH_TOKEN` (at least 32 characters). Set `SITE_URL` to
`https://techthese.de` so returned article links and metadata use the public domain.
An independently hosted public Worker does not require the former private Sites
service token. Never commit or paste publication credentials into chat or Git.

In Evaluating Stocks, open the TechThese section or choose “Für TechThese
aufbereiten” on a completed, checked and internally released analysis. Edit the
article, select topics, save and inspect the draft, complete the editorial review,
and explicitly approve the exact version before publishing. An article publication
updates D1 directly; it does not rebuild the website.

The authenticated `GET /api/import?slug=...` returns `revision` and
`contract_version: 2`. This reads a revision without publishing anything. A missing
slug returns revision 0. Anonymous or invalid-secret requests return 401; a missing
database binding returns 503. Incomplete POST payloads return 422 before any write.

New imports require the editorial review object sent by the current publisher,
including editing, fact checking, rights and disclosure confirmations. Direct
service calls enforce the same contract. Earlier saved articles remain readable.
Retries preserve their publication identity, notification choice and revisions; stale changes are rejected.
New articles notify confirmed subscribers. Revisions notify only when the publisher
sets `notify_subscribers: true`. The response reports `notifications_queued`.

Only sources that are free to access **and** permit republication may be cited. Yahoo
Finance (including `yfinance`), FRED and the free tiers of the commercial market-data
APIs do not qualify. See [`quellen-lizenzen.md`](quellen-lizenzen.md); the tag mapping for replacing yfinance is in [`edgar-kennzahlen.md`](edgar-kennzahlen.md).

The eight topic categories remain predefined. New articles and company links use
the selected categories automatically. Adding a category requires coordinated
changes to the website and the private publisher.

## Company overview

New articles also carry a structured `memo_overview` from the saved evaluation:
model rating (Strong Buy through Strong Sell), Piotroski F-Score, four business
questions, reporting-currency cash-flow figures, annual costs, analyst comparison
and data limitations. The local draft preview shows these fields before approval.
The full edited memo remains part of the article. Older articles remain readable;
they need a reviewed republication to gain the new overview data. Missing numbers
are not replaced by zero, and annual costs are not added to twelve-month cash flows.

## Company news

Company pages show a reviewed digest of the last 30 days, built from SEC EDGAR filings.
In Evaluating Stocks open a memo and use **„Auf TechThese veröffentlichen · Meldungen der
letzten 30 Tage"**: the draft is loaded only on request, insider trades start deselected,
and the title of an attached press release (exhibit 99.1) is shown as a hint. Headlines and
summaries are written by the editor in their own words; each entry links to the original
filing.

The bridge needs a contact address for the SEC `User-Agent`, which the SEC requires.
Set it once; later runs of the configurator keep it:

```
python3 integrations/configure.py --app "/Pfad/zu/Evaluate stocks" --url "https://techthese.de" --sec-contact kontakt@example.org
```

`POST /api/news` uses the same `Authorization: Bearer <PUBLISH_TOKEN>` as `/api/import` and a
120 kB limit. The packet is `publication_id`, `ticker`, `editorial_review` (same rules as
articles) and up to 40 `items` of `date`, `category`, `headline`, `summary`, `source`,
`source_url` (HTTPS only) and optional `form`. The source policy applies: Yahoo Finance,
NewsAPI and the other blocked providers are rejected with 422. A repeated `publication_id`
with identical content returns 200, with different content 409; a new id replaces the
company's digest. `GET /api/import` reports `capabilities.company_news: true`.

Without a published digest the section does not appear. A digest with no entries shows
that nothing reportable happened in the window. The section never takes the company page
down: if the `company_news` table is missing because migration 0004 has not been applied
yet, the page renders without it.
