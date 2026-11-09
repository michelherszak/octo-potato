'use client';

import {useSearchParams} from 'next/navigation';
import type {SearchEntry} from '@/lib/search';
import SearchExplorer from './SearchExplorer';

export default function HeaderSearch({entries}:{entries:SearchEntry[]}){
  const params=useSearchParams();
  const query=(params.get('q')||'').slice(0,200);
  return <div id="suche" className="header-search">
    <SearchExplorer key={query} entries={entries} initialQuery={query} topic={params.get('thema')||''}
      action="/entdecken#ergebnisse" questionTarget="/entdecken#ergebnisse" inHeader/>
  </div>;
}
