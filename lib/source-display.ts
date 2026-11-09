import type {Article} from './contract.ts';
import {isYahooSource} from './source-policy.ts';

// Nur die öffentliche Darstellung ändern. Im Import und in gespeicherten Versionen
// bleibt die tatsächliche Herkunft erhalten; sie wird nie als andere Quelle etikettiert.
function publicMetric<T extends {source:string;source_url?:string}>(metric:T):T{
  return isYahooSource(metric.source)||isYahooSource(metric.source_url)
    ? {...metric,source:'',source_url:undefined}:metric;
}

export function articleForDisplay(article:Article):Article{
  const overview=article.memo_overview;
  return {...article,
    sources:article.sources.filter(source=>!isYahooSource(source.title)&&!isYahooSource(source.url)),
    metrics:article.metrics.map(publicMetric),
    ...(overview?{memo_overview:{...overview,piotroski:publicMetric(overview.piotroski),
      money_metrics:overview.money_metrics.map(publicMetric),costs:overview.costs.map(publicMetric)}}:{}),
  };
}
