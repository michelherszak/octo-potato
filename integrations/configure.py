"""Configure the private publisher without putting credentials into shell history."""
import argparse
import getpass
import json
from pathlib import Path
from urllib.parse import urlparse

p=argparse.ArgumentParser()
p.add_argument('--app',required=True,help='Path to the Evaluating Stocks checkout')
p.add_argument('--url',required=True,help='Website origin, without /api/import')
p.add_argument('--sites',action='store_true',help='Ask for the private Sites service-access token too')
a=p.parse_args()
target=urlparse(a.url)
if target.scheme!='https' and not(target.scheme=='http' and target.hostname in {'localhost','127.0.0.1'}):
    p.error('Use HTTPS, or HTTP for loopback development only')
token=getpass.getpass('Publication secret (hidden): ')
if len(token)<32:p.error('Publication secret must contain at least 32 characters')
data={'url':a.url.rstrip('/'),'token':token}
if a.sites:data['sites_service_token']=getpass.getpass('Sites service-access token (hidden): ')
root=Path(a.app).resolve()
if not (root/'backend/app/main.py').is_file():p.error('Not an Evaluating Stocks checkout')
path=root/'data/website_settings.json';path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps(data,indent=2)+'\n');path.chmod(0o600)
ignore=root/'.gitignore'
s=ignore.read_text() if ignore.exists() else ''
for item in ['data/website_settings.json','data/website_pushes.json','data/website_drafts.json']:
    if item not in s.splitlines():s+='\n'+item+'\n'
ignore.write_text(s)
print('Connection configured. Open an evaluated stock memo to publish.')
