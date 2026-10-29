import {env} from 'cloudflare:workers';
import {emailDeliveryConfig} from '@/lib/account-runtime';
import {accountJson} from '@/lib/account-http';
import {equalTokens, hashToken} from '@/lib/accounts';
import {dispatchArticleEmails} from '@/lib/notifications';

export async function POST(request: Request) {
  if (!env.PUBLISH_TOKEN || env.PUBLISH_TOKEN.length < 32 || !equalTokens(
    await hashToken(request.headers.get('authorization') || ''), await hashToken(`Bearer ${env.PUBLISH_TOKEN}`),
  )) return accountJson({detail: 'Nicht autorisiert.'}, 401);
  const config = emailDeliveryConfig();
  if (!config || env.EMAIL_UPDATES_ENABLED !== 'true') return accountJson({detail: 'E-Mail-Versand ist deaktiviert.'}, 503);
  return accountJson(await dispatchArticleEmails(config.db, config.secret, config.base, config.send));
}
