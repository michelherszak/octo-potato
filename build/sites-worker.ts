import handler from "vinext/server/fetch-handler";
import {accountStorageConfig,emailDeliveryConfig} from '../lib/account-runtime';
import {dispatchArticleEmails} from '../lib/notifications';
import {cleanupAccounts} from '../lib/accounts';
import {privateHeaders} from '../lib/account-http';

export default {
  scheduled(_event: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const config = emailDeliveryConfig(env);
    if (config && env.EMAIL_UPDATES_ENABLED === 'true') {
      ctx.waitUntil(dispatchArticleEmails(config.db, config.secret, config.base, config.send));
    } else if (env.DB) ctx.waitUntil(cleanupAccounts(env.DB));
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const target=new URL(request.url);
    const accountPath=target.pathname==='/konto'||target.pathname.startsWith('/konto/');
    const storage=accountPath?accountStorageConfig(env):null;
    if(request.method==='GET'&&storage&&target.origin!==storage.base)
      return Response.redirect(storage.base+target.pathname+target.search,302);
    const response = await handler.fetch(request, env, ctx);
    const path = target.pathname;
    if (path === '/konto' || path.startsWith('/konto/') || path.startsWith('/api/account/')) {
      const protectedResponse = new Response(response.body, response);
      for (const [key, value] of Object.entries(privateHeaders)) protectedResponse.headers.set(key, value);
      return protectedResponse;
    }
    return response;
  },
};
