// Bindings exposed by Sites to application routes through `cloudflare:workers`.
// Keep this interface aligned with `.openai/hosting.json`.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
  }
}
