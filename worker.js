 // worker.js (Cloudflare Worker - Module syntax)
// live test deploy

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten later if you want (set to your domain)
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function nowMs() {
  return Date.now();
}

function parsePlanToSeconds(plan) {
  switch ((plan || "").toLowerCase()) {
    case "day":
    case "daypass":
    case "1day":
      return 24 * 60 * 60;
    case "trial7":
    case "7day":
    case "trial":
      return 7 * 24 * 60 * 60;
    case "month":
    case "monthly":
      return 30 * 24 * 60 * 60;
    case "year":
    case "yearly":
      return 365 * 24 * 60 * 60;
    default:
      return null;
  }
}

async function getPremiumRecord(env, uid) {
  const raw = await env.PREMIUM.get(uid);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    if (raw === "1") {
      return {
        expiresAt: nowMs() + 365 * 24 * 60 * 60 * 1000,
        plan: "legacy",
        source: "legacy",
      };
    }
    return null;
  }
}

async function setPremiumRecord(env, uid, rec) {
  await env.PREMIUM.put(uid, JSON.stringify(rec));
}

function isActive(rec) {
  if (!rec) return false;
  const exp = Number(rec.expiresAt || 0);
  return exp > nowMs();
}

function getTokenFromRequest(request, url) {
  const qpToken = (url.searchParams.get("token") || "").trim();
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  return qpToken || bearer || "";
}

function requireAdmin(request, env, url) {
  const configured = (env.ADMIN_TOKEN || "").trim();
  const provided = getTokenFromRequest(request, url);

  if (!configured) return { ok: false, reason: "admin_token_not_configured" };
  if (!provided) return { ok: false, reason: "missing_token" };
  if (provided !== configured) return { ok: false, reason: "bad_token" };

  return { ok: true };
}

async function readJsonBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) return null;

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getParam(url, body, key) {
  return url.searchParams.get(key) ?? body?.[key] ?? null;
}

function normalizePlan(plan) {
  switch ((plan || "").toLowerCase()) {
    case "day":
    case "daypass":
    case "1day":
      return "day";
    case "month":
    case "monthly":
      return "month";
    case "trial7":
    case "7day":
    case "trial":
      return "trial7";
    case "year":
    case "yearly":
      return "year";
    default:
      return null;
  }
}

function getStripePriceIdForPlan(env, plan) {
  switch (plan) {
    case "day":
      return env.STRIPE_PRICE_DAY || "";
    case "month":
      return env.STRIPE_PRICE_MONTH || "";
    case "trial7":
      return env.STRIPE_PRICE_TRIAL7 || "";
    case "year":
      return env.STRIPE_PRICE_YEAR || "";
    default:
      return "";
  }
}

function buildSuccessUrl(env, plan) {
  const base =
    env.CHECKOUT_SUCCESS_URL ||
    "https://aiphotostudio.co.uk/?payment=success";

  const u = new URL(base);
  if (!u.searchParams.get("plan")) {
    u.searchParams.set("plan", plan);
  }
  return u.toString();
}

function buildCancelUrl(env) {
  return (
    env.CHECKOUT_CANCEL_URL ||
    "https://aiphotostudio.co.uk/?payment=cancel"
  );
}

async function createStripeCheckoutSession(env, { uid, email, plan }) {
  const stripeSecretKey = (env.STRIPE_SECRET_KEY || "").trim();
  if (!stripeSecretKey) {
    throw new Error("stripe_secret_not_configured");
  }

  const normalizedPlan = normalizePlan(plan);
  if (!normalizedPlan) {
    throw new Error("invalid_plan");
  }

  const priceId = getStripePriceIdForPlan(env, normalizedPlan);
  if (!priceId) {
    throw new Error(`missing_price_id_for_plan_${normalizedPlan}`);
  }

  const successUrl = buildSuccessUrl(env, normalizedPlan);
  const cancelUrl = buildCancelUrl(env);

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("client_reference_id", uid);
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");

  if (email) {
    form.set("customer_email", email);
  }

  form.set("metadata[uid]", uid);
  form.set("metadata[plan]", normalizedPlan);
  if (email) {
    form.set("metadata[email]", email);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data?.error?.message || "stripe_checkout_session_create_failed"
    );
  }

  if (!data?.url) {
    throw new Error("stripe_no_checkout_url_returned");
  }

  return data;
}

function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function parseStripeSignatureHeader(sigHeader) {
  const parts = (sigHeader || "").split(",");
  let timestamp = null;
  const v1s = [];

  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v;
    if (k === "v1") v1s.push(v);
  }

  return { timestamp, v1s };
}

async function hmacSha256Hex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeWebhookSignature(rawBody, sigHeader, secret) {
  const { timestamp, v1s } = parseStripeSignatureHeader(sigHeader);

  if (!timestamp || !v1s.length) {
    return { ok: false, reason: "bad_signature_header" };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signedPayload);

  const matched = v1s.some(v1 => timingSafeEqualHex(v1, expected));
  if (!matched) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}

async function activatePremiumFromCheckoutSession(env, session, sourceLabel = "stripe_webhook") {
  const uid =
    session?.metadata?.uid ||
    session?.client_reference_id ||
    "";

  const plan = normalizePlan(session?.metadata?.plan);
  if (!uid) {
    throw new Error("missing_uid_in_session");
  }
  if (!plan) {
    throw new Error("missing_or_invalid_plan_in_session");
  }

  const seconds = parsePlanToSeconds(plan);
  if (!seconds) {
    throw new Error("invalid_plan_duration");
  }

  const expiresAt = nowMs() + seconds * 1000;

  const rec = {
    expiresAt,
    plan,
    source: sourceLabel,
    stripeSessionId: session?.id || null,
    stripeCustomerId: session?.customer || null,
    stripePaymentStatus: session?.payment_status || null,
    updatedAt: nowMs(),
  };

  await setPremiumRecord(env, uid, rec);

  return {
    uid,
    plan,
    expiresAt,
    source: sourceLabel,
  };
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      // Handle preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // ---- STRIPE WEBHOOK ----
      // IMPORTANT: must read raw body, so this is handled before JSON parsing.
      if (path === "/stripe-webhook") {
        if (request.method !== "POST") {
          return text("Method Not Allowed", 405);
        }

        const webhookSecret = (env.STRIPE_WEBHOOK_SECRET || "").trim();
        if (!webhookSecret) {
          return text("Webhook secret not configured", 500);
        }

        const sigHeader = request.headers.get("Stripe-Signature") || "";
        const rawBody = await request.text();

        const verified = await verifyStripeWebhookSignature(
          rawBody,
          sigHeader,
          webhookSecret
        );

        if (!verified.ok) {
          return text(`Invalid signature: ${verified.reason}`, 400);
        }

        let event;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return text("Invalid JSON body", 400);
        }

        const eventType = event?.type || "";
        const session = event?.data?.object || null;

        try {
          if (eventType === "checkout.session.completed") {
            // For one-time card payments, completed + paid is what we want.
            if (session?.payment_status === "paid") {
              await activatePremiumFromCheckoutSession(env, session, "stripe_webhook");
            }
          } else if (eventType === "checkout.session.async_payment_succeeded") {
            await activatePremiumFromCheckoutSession(env, session, "stripe_webhook_async");
          }

          return text("ok", 200);
        } catch (err) {
          return text(`Webhook handler error: ${err?.message || String(err)}`, 500);
        }
      }

      const body = await readJsonBody(request);

      // Health / help
      if (path === "/") {
        return text(
          [
            "premium-status worker is running ✅",
            "",
            "Endpoints:",
            "  GET  /check?uid=USER_ID",
            "  GET  /set?uid=USER_ID&plan=day|month|year|trial7&token=ADMIN_TOKEN",
            "  GET  /remove?uid=USER_ID&token=ADMIN_TOKEN",
            "  POST /create-checkout-session   with JSON { uid, email, plan }",
            "  POST /stripe-webhook            (Stripe only)",
            "",
            "Also supported:",
            "  POST /set    with JSON { uid, plan, token }",
            "  POST /remove with JSON { uid, token }",
            "",
          ].join("\n")
        );
      }

      // ---- DEBUG AUTH STATUS (ADMIN ONLY) ----
      if (path === "/debug-auth") {
        const authCheck = requireAdmin(request, env, url);
        return json(
          {
            ok: authCheck.ok,
            reason: authCheck.ok ? "authorized" : authCheck.reason,
            adminTokenConfigured: !!(env.ADMIN_TOKEN || "").trim(),
            premiumBindingConfigured: !!env.PREMIUM,
            stripeConfigured: !!(env.STRIPE_SECRET_KEY || "").trim(),
            stripeWebhookConfigured: !!(env.STRIPE_WEBHOOK_SECRET || "").trim(),
            stripePriceDayConfigured: !!(env.STRIPE_PRICE_DAY || "").trim(),
            stripePriceMonthConfigured: !!(env.STRIPE_PRICE_MONTH || "").trim(),
            stripePriceTrial7Configured: !!(env.STRIPE_PRICE_TRIAL7 || "").trim(),
            stripePriceYearConfigured: !!(env.STRIPE_PRICE_YEAR || "").trim(),
          },
          authCheck.ok ? 200 : 401
        );
      }

      // ---- CREATE STRIPE CHECKOUT SESSION ----
      if (path === "/create-checkout-session") {
        if (request.method !== "POST") {
          return json({ ok: false, error: "method_not_allowed" }, 405);
        }

        const uid = (body?.uid || "").trim();
        const email = (body?.email || "").trim();
        const plan = normalizePlan(body?.plan);

        if (!uid) {
          return json({ ok: false, error: "missing_uid" }, 400);
        }

        if (!plan) {
          return json({ ok: false, error: "invalid_plan" }, 400);
        }

        const session = await createStripeCheckoutSession(env, {
          uid,
          email,
          plan,
        });

        return json({
          ok: true,
          url: session.url,
          sessionId: session.id,
          plan,
        });
      }

      // ---- CHECK PREMIUM STATUS ----
      if (path === "/check") {
        const uid = getParam(url, body, "uid");
        if (!uid) return json({ premium: false, error: "no uid" }, 400);

        const rec = await getPremiumRecord(env, uid);
        const active = isActive(rec);

        if (rec && !active) {
          try {
            await env.PREMIUM.delete(uid);
          } catch (_) {}
        }

        const expiresAt = active ? rec?.expiresAt || null : null;
        const msLeft = expiresAt ? Math.max(0, expiresAt - nowMs()) : 0;

        return json({
          premium: active,
          expiresAt,
          msLeft,
          plan: active ? (rec?.plan || "free") : "free",
          source: active ? (rec?.source || null) : null,
          stripeSessionId: active ? (rec?.stripeSessionId || null) : null,
        });
      }

      // ---- SET PREMIUM (ADMIN ONLY) ----
      if (path === "/set") {
        const authCheck = requireAdmin(request, env, url);
        if (!authCheck.ok) {
          return json(
            { ok: false, error: "unauthorized", reason: authCheck.reason },
            401
          );
        }

        const uid = getParam(url, body, "uid");
        if (!uid) return json({ ok: false, error: "no uid" }, 400);

        const plan = getParam(url, body, "plan") || "day";
        const secondsParam = getParam(url, body, "seconds");
        const source = getParam(url, body, "source") || "manual";

        let seconds = secondsParam ? Number(secondsParam) : parsePlanToSeconds(plan);
        if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
          return json({ ok: false, error: "invalid duration" }, 400);
        }

        const expiresAt = nowMs() + seconds * 1000;

        const rec = { expiresAt, plan, source, updatedAt: nowMs() };
        await env.PREMIUM.put(uid, JSON.stringify(rec));

        return json({
          ok: true,
          uid,
          premium: true,
          expiresAt,
          msLeft: Math.max(0, expiresAt - nowMs()),
          plan,
          source,
        });
      }

      // ---- REMOVE PREMIUM (ADMIN ONLY) ----
      if (path === "/remove") {
        const authCheck = requireAdmin(request, env, url);
        if (!authCheck.ok) {
          return json(
            { ok: false, error: "unauthorized", reason: authCheck.reason },
            401
          );
        }

        const uid = getParam(url, body, "uid");
        if (!uid) return json({ ok: false, error: "no uid" }, 400);

        await env.PREMIUM.delete(uid);
        return json({ ok: true, uid, premium: false });
      }

      return json({ ok: false, error: "Not found" }, 404);
    } catch (err) {
      return json(
        {
          ok: false,
          error: "Server error",
          message: err?.message || String(err),
        },
        500
      );
    }
  },
};
