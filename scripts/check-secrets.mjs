import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n');
const forbidden=files.filter(p=>/(^|\/)(\.dev\.vars(?:\.|$)|\.env(?:\.|$)(?!example$)|website_(settings|pushes|drafts)\.json|research\.sqlite3|node_modules\/|\.wrangler\/)/.test(p));
if(forbidden.length){console.error('Private files are tracked:',forbidden);process.exit(1);}
console.log('No private runtime files in Git.');
