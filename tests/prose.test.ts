import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseProse} from '../lib/prose.ts';

const collapsed='| Faktor | Modellwert | Aussage innerhalb des Modells | | --- | --- | --- | | Bewertung | -0.411 | Belastet das Ergebnis, obwohl die Bewertung im Technologievergleich ungefähr durchschnittlich ausfällt | | Qualität | -0.683 | Liegt deutlich unter dem Vergleichsfeld | | Wachstum | 0.178 | Entspricht ungefähr dem Durchschnitt der Technologieunternehmen | | Momentum | 0.837 | Liefert den stärksten positiven Beitrag |';

test('the supplied collapsed table retains all factors, numbers and explanations',()=>{
  const blocks=parseProse(`## Modellurteil: Hold, nicht Kaufempfehlung\nEine Abwägung.\n\n${collapsed}\n\nMomentum steht für die Kursdynamik.`);
  assert.deepEqual(blocks.map(block=>block.type),['heading','paragraph','table','paragraph']);
  const table=blocks[2];
  assert.equal(table.type,'table');
  if(table.type!=='table')return;
  assert.deepEqual(table.headers,['Faktor','Modellwert','Aussage innerhalb des Modells']);
  assert.deepEqual(table.rows.map(row=>row.slice(0,2)),[['Bewertung','-0.411'],['Qualität','-0.683'],['Wachstum','0.178'],['Momentum','0.837']]);
  assert.match(table.rows[0][2],/ungefähr durchschnittlich ausfällt$/);
});

test('multiline tables work without surrounding blank lines and retain column alignment',()=>{
  const blocks=parseProse('Vorher\r\nFaktor | Wert | Einordnung\r\n:--- | ---: | :---:\r\nQualität | -0.683 | Schwach\r\nDanach');
  assert.deepEqual(blocks,[{type:'paragraph',text:'Vorher'},
    {type:'table',headers:['Faktor','Wert','Einordnung'],alignments:['left','right','center'],rows:[['Qualität','-0.683','Schwach']]},
    {type:'paragraph',text:'Danach'}]);
});

test('escaped pipes, code pipes and empty cells are not mistaken for column boundaries',()=>{
  const blocks=parseProse('| Faktor | Wert | Hinweis |\n| --- | --- | --- |\n| A \\| B | `a|b` | |\n| C | | `x|y` |');
  assert.deepEqual(blocks,[{type:'table',headers:['Faktor','Wert','Hinweis'],alignments:['left','left','left'],rows:[['A | B','`a|b`',''],['C','','`x|y`']]}]);
});

test('ordinary pipes and malformed tables remain readable text without losing content',()=>{
  for(const text of ['Hold | Buy | Sell','| A | B |\n| -- | --- |\n| C | D |','| A | B | | --- | --- | | C | D | E |']){
    assert.deepEqual(parseProse(text),[{type:'paragraph',text}]);
  }
  const blocks=parseProse('| A | B |\n| --- | --- |\n| C | D | E |');
  assert.deepEqual(blocks.at(-1),{type:'paragraph',text:'| C | D | E |'});
});

test('paragraphs, headings and lists retain their structure alongside multiple tables',()=>{
  assert.deepEqual(parseProse('## Einordnung\nText\n\n- Erstens\n- Zweitens\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n### Danach\n| C | D |\n| --- | --- |\n| 3 | 4 |').map(block=>block.type),
    ['heading','paragraph','list','table','heading','table']);
});

const hooks=registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('.')||specifier.startsWith('file:')){
      const url=new URL(specifier,context.parentURL);
      for(const extension of ['.ts','.tsx'])if(existsSync(new URL(url.href+extension))){specifier=url.href+extension;break;}
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{
      compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
    }).outputText};
    return next(url,context);
  },
});
const {Prose}=await import('../app/Prose.tsx');
hooks.deregister();
const render=(text:string)=>renderToStaticMarkup(createElement(Prose,{text}));

test('tables render semantic, keyboard accessible markup with no raw separator rows',()=>{
  const html=render(collapsed);
  assert.equal((html.match(/<th /g)||[]).length,3);
  assert.equal((html.match(/<td /g)||[]).length,12);
  assert.match(html,/role="region" aria-label="Tabelle: Faktor, Modellwert, Aussage innerhalb des Modells" tabindex="0"/);
  assert.match(html,/<thead><tr><th[^>]+scope="col"/);
  assert.doesNotMatch(html,/---|\| Faktor/);
});

test('imported HTML stays escaped while bold and code remain formatted inside cells',()=>{
  const html=render('| Faktor | Aussage |\n| --- | --- |\n| **Qualität** | <script>alert(1)</script> |\n| Code | `a|b` |');
  assert.match(html,/<strong>Qualität<\/strong>/);
  assert.match(html,/<code>a\|b<\/code>/);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script/);
});
