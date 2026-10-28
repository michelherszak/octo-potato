"""Install the bounded bridge into a compatible Evaluating Stocks checkout."""
import argparse
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--app',required=True);p.add_argument('--check',action='store_true');a=p.parse_args()
root=Path(a.app).resolve();assets=Path(__file__).resolve().parent/'evaluating-stocks'
if not (root/'backend/app/main.py').is_file():p.error('Not an Evaluating Stocks checkout')
updates={
    root/'backend/app/website_memo.py':(assets/'website_memo.py').read_text(),
    root/'backend/app/website_review_policy.py':(assets/'website_review_policy.py').read_text(),
    root/'backend/app/website_publish.py':(assets/'website_publish.py').read_text(),
    root/'web/src/components/WebsiteMemoPreview.jsx':(assets/'WebsiteMemoPreview.jsx').read_text(),
    root/'web/src/components/WebsitePublishPanel.jsx':(assets/'WebsitePublishPanel.jsx').read_text(),
}
def insert(relative,anchor,value,marker):
    path=root/relative;source=path.read_text()
    if marker in source:return
    if anchor not in source:p.error('Unsupported version: missing integration point in '+relative)
    updates[path]=source.replace(anchor,anchor+value,1)
insert('backend/app/main.py','app = FastAPI(title="Evaluate Stocks", version="0.1.0")','\nfrom .website_publish import router as website_router\napp.include_router(website_router)','from .website_publish import router')
insert('web/src/api.js','export const api = {',"\n  websiteStatus: () => request('/website/status'),\n  websiteDraft: (id) => request(`/website/runs/${encodeURIComponent(id)}/draft`),\n  websitePreview: (id, body) => post(`/website/runs/${encodeURIComponent(id)}/preview`, body),\n  websitePush: (id, body) => post(`/website/runs/${encodeURIComponent(id)}/push`, body),",'websiteDraft:')
path=root/'web/src/components/MemoDialog.jsx';source=path.read_text()
if 'import WebsitePublishPanel' not in source:
    anchor='<FinancialEvidence run={run} />'
    if anchor not in source:p.error('Unsupported MemoDialog version')
    updates[path]="import WebsitePublishPanel from './WebsitePublishPanel.jsx'\n"+source.replace(anchor,anchor+'\n          <WebsitePublishPanel key={`website-${run.run_id}`} runId={run.run_id} />',1)
path=root/'web/src/styles.css';source=path.read_text()
if '.website-publish label' not in source:updates[path]=source+'\n'+(assets/'website.css').read_text()
path=root/'.gitignore';source=path.read_text()
for entry in ['data/website_settings.json','data/website_pushes.json','data/website_drafts.json']:
    if entry not in source.splitlines():source+='\n'+entry+'\n'
updates[path]=source
for path,content in updates.items():
    print(('Check: ' if a.check else 'Install: ')+str(path.relative_to(root)))
    if not a.check:
        if path.exists() and path.read_text()!=content:
            backup=path.with_suffix(path.suffix+'.before-techthese')
            if not backup.exists():backup.write_text(path.read_text())
        path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content)
