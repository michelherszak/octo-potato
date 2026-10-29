import type {AccountDatabase} from './accounts.ts';
import type {EmailSender} from './email.ts';
import {EmailDeferred} from './email.ts';

// Every recipient consumes one slot, including login messages. Reservations survive
// lost responses; stable idempotency keys do not consume another slot on retry.
export function budgetedSender(db:AccountDatabase,send:EmailSender,limit=100,clock=Date.now):EmailSender {
  return async(message,key)=>{
    const now=clock(),day=Math.floor(now/86_400_000);
    if(limit>0){
      const prior=await db.prepare('SELECT key FROM email_send_budget WHERE key=?').bind(key).first();
      if(!prior){
        const result=await db.prepare(`INSERT INTO email_send_budget(key,day)
          SELECT ?,? WHERE (SELECT count(*) FROM email_send_budget WHERE day=?)<?
          ON CONFLICT(key) DO NOTHING`).bind(key,day,day,limit).run();
        if(!result.meta.changes&&!await db.prepare('SELECT key FROM email_send_budget WHERE key=?').bind(key).first())
          throw new EmailDeferred((day+1)*86_400_000+5000);
      }
    }
    return send(message,key);
  };
}
