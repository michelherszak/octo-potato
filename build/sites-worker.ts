import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
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
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const target=new URL(request.url);
    const accountPath=target.pathname==='/konto'||target.pathname.startsWith('/konto/');
    const storage=accountPath?accountStorageConfig(env):null;
    if(request.method==='GET'&&storage&&target.origin!==storage.base)
      return Response.redirect(storage.base+target.pathname+target.search,302);
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const path = new URL(request.url).pathname;
    if (path === '/konto' || path.startsWith('/konto/') || path.startsWith('/api/account/')) {
      const protectedResponse = new Response(response.body, response);
      for (const [key, value] of Object.entries(privateHeaders)) protectedResponse.headers.set(key, value);
      return protectedResponse;
    }
    return response;
  },
};
