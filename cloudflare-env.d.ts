declare namespace Cloudflare {
  interface Env {
    PUBLISH_TOKEN?: string;
    SITE_URL?: string;
    SITE_INDEXABLE?: string;
    ADMIN_EMAILS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
