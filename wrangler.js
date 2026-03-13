name = "premium-status"
main = "worker.js"
compatibility_date = "2026-03-12"

# Keep this true if you want the *.workers.dev URL
workers_dev = true

# KV binding used by your code: env.PREMIUM
[[kv_namespaces]]
binding = "PREMIUM"
id = ""

# Optional: preview ID if you have one
# preview_id = "PUT_YOUR_KV_PREVIEW_ID_HERE"

[vars]
CHECKOUT_SUCCESS_URL = "https://aiphotostudio.co.uk/?payment=success"
CHECKOUT_CANCEL_URL = "https://aiphotostudio.co.uk/?payment=cancel"
