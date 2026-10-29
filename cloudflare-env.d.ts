declare namespace Cloudflare {
  interface Env {
    PUBLISH_TOKEN?: string;
    ACCOUNT_SECRET?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    EMAIL_DAILY_LIMIT?: string;
    EMAIL_SIGNUP_ENABLED?: string;
    EMAIL_UPDATES_ENABLED?: string;
    SITE_URL?: string;
    SITE_INDEXABLE?: string;
    ADMIN_EMAILS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
