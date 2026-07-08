# Payments — Kora (Korapay), USD-Priced

**Constraint:** Founder is based in Nigeria, without business registration for now — Stripe is unavailable and Dodo Payments requires registration. **Kora onboards individual businesses**, which is why it's the launch gateway.

**Decision: Kora (Korapay) hosted checkout.** Kora is a payment *gateway*, not a merchant of record: **we are the seller of record.** Kora processes cards (including international Visa/Mastercard) and settles to the founder. Prices are listed in USD; set `KORA_CURRENCY=USD` if the account supports USD collections, otherwise `NGN` (confirm with Kora support — international cards work either way).

## What "no merchant of record" means (accepted trade-offs)

- Sales tax/VAT compliance in buyers' countries is technically on us, not a MoR. At indie scale this is a commonly accepted risk; revisit at real revenue.
- Receipts come from us (Kora sends payment confirmations; the app is the product record).
- **Migration path:** once business registration exists, move to Paddle (full MoR) — the `BillingProvider` interface in `dashboard/src/lib/billing/` confines that change to one module.

## Subscription model on Kora (no native recurring billing)

Kora has no subscription engine, so plans are **31 days of access per successful charge**:

1. Checkout (`/api/checkout?plan=solo|team`) → Kora hosted payment page (USD $19/$49).
2. `charge.success` webhook → `paid_until` extended by 31 days (stacks if renewing early).
3. Daily cron emails a **renewal link 3 days before expiry** — no auto-charge, ever (this is also a feature: dev audiences hate surprise rebills).
4. Past `paid_until` → status flips to `expired`, paid features pause, data is kept.

## Integration notes (implemented in `dashboard/src/lib/billing/kora.ts`)

- **Init:** `POST https://api.korapay.com/merchant/api/v1/charges/initialize` with Bearer secret key → `data.checkout_url`.
- **Webhook:** `x-korapay-signature` header = HMAC-SHA256 (hex) of `JSON.stringify(payload.data)` with the secret key. Handled events: `charge.success`, `charge.failed`.
- Plan + customer email are encoded in the charge `reference` (and metadata) so webhooks are self-contained.
- **TODO before launch (sandbox test):** confirm USD availability on the account, amount units, and exact webhook payload field names against the live Kora docs.

## Setup checklist (founder)

- [ ] Create Kora account as **individual business** + complete KYC
- [ ] Ask Kora support: "Can my account collect card payments in USD?" → set `KORA_CURRENCY` accordingly
- [ ] Dashboard → API keys → put test secret key in `dashboard/.env.local` (`KORA_SECRET_KEY`)
- [ ] Test full cycle in test mode: checkout → webhook → access granted → cron reminder → expiry
- [ ] Switch to live keys at launch

## Later options

1. **Paddle** (full MoR, ~5% + $0.50) once business registration exists — kills the tax question and adds auto-renew.
2. **US LLC route** (doola/Firstbase + Mercury) past ~$10K MRR if a US entity becomes worth it.
