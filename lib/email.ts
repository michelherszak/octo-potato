export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};
export type EmailSender = (message: EmailMessage, idempotencyKey: string) => Promise<void>;

export class EmailDeferred extends Error {
  retryAt:number;
  constructor(retryAt:number){super("Email deferred until quota is available.");this.retryAt=retryAt;}
}

export function resendSender(apiKey: string, from: string, transport: typeof fetch = fetch): EmailSender {
  return async (message, idempotencyKey) => {
    const response = await transport('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey},
      body: JSON.stringify({from, ...message, to: [message.to]}),
      signal: AbortSignal.timeout(10_000),
    });
    // Provider responses can contain addresses or credentials; do not log them.
    if(response.status===429){
      const retry=Number(response.headers.get('retry-after'));
      throw new EmailDeferred(Date.now()+(Number.isFinite(retry)&&retry>0?Math.max(60,retry):300)*1000);
    }
    if (!response.ok) throw new Error(`Email provider rejected delivery (${response.status}).`);
  };
}
