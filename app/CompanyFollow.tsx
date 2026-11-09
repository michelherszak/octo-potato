import FollowButton from './FollowButton';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';

// Unter Beiträgen derselbe Folgen-Weg wie auf der Unternehmensseite: eine Liste im Konto,
// E-Mails nur nach ausdrücklicher Zustimmung.
export default function CompanyFollow({ticker,company}:{ticker:string;company:string}) {
  if(!ticker)return null;
  return <aside className="company-follow" aria-label={'Neue Beiträge zu '+(company||ticker)}>
    <div>
      <p className="eyebrow">Bleib bei diesem Unternehmen</p>
      <h2>Neue Analysen zu {company||ticker} verfolgen.</h2>
      <p>Folge dem Unternehmen, um es in deinem Konto zu sammeln. Auf Wunsch kommen neue Beiträge zusätzlich per E-Mail.</p>
    </div>
    <FollowButton ticker={ticker} company={company||ticker} config={getPublicSupabaseConfig()}/>
  </aside>;
}
