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

Yahoo Finance and `yfinance` are explicitly allowed by the publisher policy. Their
original source metadata stays in the stored article and revision history, while public
article and company-news pages suppress Yahoo source labels and links. Data is never
relabeled as SEC or another provider. Older Yahoo evaluations may have no source URLs:
documented Yahoo provenance on a metric or overview field is sufficient for the import.
The bridge no longer rejects those drafts locally with 409. Other source restrictions
and draft/version conflict checks remain in effect. See
[`quellen-lizenzen.md`](quellen-lizenzen.md).

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

## New article or update

Each evaluation in Evaluating Stocks becomes a **new article** by default. Its address
carries the evaluation date (`mrvl-analyse-2026-11-09`) and its title the month, so
several analyses of one company stay online side by side and keep distinct titles. A new
article notifies everyone following the company.

Choose **update** in the publish panel only to correct an existing article. The panel lists
the company's published articles (`GET /api/import?ticker=MRVL`, same authorisation) and
replaces the chosen one with a new revision; earlier revisions stay in `article_versions`.
Subscribers are informed about an update only if that is ticked explicitly.

The bridge refuses both mismatches with 409, already in the preview: "new" on an address
that is taken, and "update" on an address that does not exist. A new article can therefore
never silently overwrite an older one. Drafts saved before this change keep their address;
if it is already taken they open as an update.

Company pages list all analyses newest first. An older analysis shows a note linking to
the newest one; what counts is the first publication date, so correcting an old analysis
does not make it the newer one.

## Company news

The news list lives directly on **`/unternehmen/<TICKER>`**, for example
`/unternehmen/ARQQ`, beside the stock evaluations below the company profile. On desktop,
evaluations occupy four fifths of the content width and the news sidebar one fifth;
below 900 px the news stacks underneath. The section
`#nachrichten` automatically shows the **five latest available items**, newest first,
including older items when fewer than five are recent. The reader combines published
editorial digests with RSS headlines: Arqit's direct investor-relations RSS feed plus
the ticker-based Yahoo Finance RSS feed, which also covers the other company pages.
Matching URLs and headlines are deduplicated. No manual digest is needed for the section
to appear. The original publication date remains visible; the old 30-day cutoff no
longer applies to this list.

Automatic headlines have no generated summary and are identified as automatic feed
content, never as editorially verified text. Company releases represent the company's
own statements. Yahoo source fields and links remain hidden publicly as requested.
The server caches feed results for 15 minutes, shares concurrent fetches, applies a
six-second timeout and a 1 MB response limit, and retains the last successful in-memory
snapshot on a failed refresh. Requests use only the ticker, without visitor or publisher
credentials. Unavailable sources do not take the company page down.

Editorial summaries of SEC filings and GDELT media reports can still be prepared and
approved in Evaluating Stocks:
In Evaluating Stocks open a memo and use **„Auf TechThese veröffentlichen · Meldungen der
letzten 30 Tage"**: the draft is loaded only on request, insider trades start deselected,
and the title of an attached press release (exhibit 99.1) is shown as a hint. Headlines and
summaries are written by the editor in their own words; each entry links to the original
filing or media article. Media reports form a separate section in the editor, start
deselected and have an empty headline: the editor must supply an original headline before
including one. Original article titles are editing hints only and never enter the public
packet. Similar reports within three days are grouped, preferring established outlets;
unrelated titles, automated stock-news networks and blocked providers are filtered out.
This remains an editorial shortlist, not a complete news archive.

GDELT's `seendate` is an observation date, not a verified publication date. Both the editor
and public list explain that distinction. Media entries link to the original article;
the public section also cites and links to the GDELT Project. The API is called at most
once every six seconds per backend process. A failed SEC or GDELT request produces a
visible editor note and does not prevent results from the other source.

The bridge needs a contact address for the SEC `User-Agent`, which the SEC requires.
Set it once; later runs of the configurator keep it:

```
python3 integrations/configure.py --app "/Pfad/zu/Evaluate stocks" --url "https://techthese.de" --sec-contact kontakt@example.org
```

`POST /api/news` uses the same `Authorization: Bearer <PUBLISH_TOKEN>` as `/api/import` and a
120 kB limit. The packet is `publication_id`, `ticker`, `editorial_review` (same rules as
articles) and up to 40 `items` of `date`, `category`, `headline`, `summary`, `source`,
`source_url` (HTTPS only) and optional `form`. Yahoo sources are accepted and retained
internally, with their source labels and links hidden publicly. NewsAPI and the other
blocked providers are rejected with 422. A repeated `publication_id`
with identical content returns 200, with different content 409; a new id replaces the
company's digest. `GET /api/import` reports `capabilities.company_news: true`.

The section also appears without a published digest, using automatic headlines. If no
items can be loaded it shows an honest empty or unavailable state instead of fabricated
rows. Publishing an empty digest replaces only the editorial portion; automatic news
remains available. The section never takes the company page
down: if the `company_news` table is missing because migration 0004 has not been applied
yet, the page renders without it.
