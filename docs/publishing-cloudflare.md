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
Retries preserve their publication identity and revisions; stale changes are rejected.

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
