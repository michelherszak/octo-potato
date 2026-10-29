import {env} from 'cloudflare:workers';
import {resendSender} from './email.ts';
import {budgetedSender} from './email-budget.ts';

export function accountStorageConfig(values: Cloudflare.Env = env) {
  if (!values.DB || !values.ACCOUNT_SECRET || values.ACCOUNT_SECRET.length < 32 || !values.SITE_URL) return null;
  try {
    const url = new URL(values.SITE_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) return null;
    return {db: values.DB, secret: values.ACCOUNT_SECRET, base: url.origin};
  } catch { return null; }
}

export function emailDeliveryConfig(values: Cloudflare.Env = env) {
  const storage = accountStorageConfig(values);
  if (!storage || !values.RESEND_API_KEY || !values.EMAIL_FROM || /[\r\n]/.test(values.EMAIL_FROM)) return null;
  const configured=Number(values.EMAIL_DAILY_LIMIT??100);
  const limit=Number.isInteger(configured)&&configured>=0?configured:100;
  return {...storage, send: budgetedSender(storage.db,resendSender(values.RESEND_API_KEY, values.EMAIL_FROM),limit)};
}

export function accountConfig(values: Cloudflare.Env = env) {
  return values.EMAIL_SIGNUP_ENABLED === 'true' ? emailDeliveryConfig(values) : null;
}
