// Bindings exposed by Sites to application routes through `cloudflare:workers`.
// Keep this interface aligned with `.openai/hosting.json`.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    WEDGE_DELETION_REGISTRY_MODE?: string;
    WEDGE_DELETION_R2_ACCOUNT_ID?: string;
    WEDGE_DELETION_R2_BUCKET?: string;
    WEDGE_DELETION_R2_ACCESS_KEY_ID?: string;
    WEDGE_DELETION_R2_SECRET_ACCESS_KEY?: string;
  }
}
