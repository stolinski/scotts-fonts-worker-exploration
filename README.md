# Scott's Fonts Worker Exploration

Loads private fonts via Cloudflare KV. A single worker exploration of what became Scott's Fonts.

You need a KV namespace connected to your worker, and your font's put into your kv via `wrangler kv:key put --namespace-id YOUR_ID --path LOCALFONTPATH REMOTEFONTPATH`
