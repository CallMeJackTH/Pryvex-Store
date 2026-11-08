# Pryvex Store

Digital goods storefront built for Vercel + Supabase.

## Setup
1. Connect this repository to Vercel and deploy the root directory as a static site.
2. Supabase project URL and publishable key are configured in `app.js`.
3. Enable Discord OAuth in Supabase Auth and add the deployed site URL to the allowed redirect URLs.
4. The first admin must be inserted into `public.store_admins` by a trusted project owner after the first Discord login. Never grant admin from client-side profile metadata.

## Payment safety
Top-ups are created with `pending` status. A slip image is not proof of settlement; only an authorized admin can approve after checking the actual transfer. Do not auto-credit based on OCR or an uploaded image.

## Payment details
- TrueMoney: 0801569915
- Recipient: ภูวเดช ทองศรี
- PromptPay QR image is configured in `index.html`.
- Support for unreadable slips: https://www.facebook.com/share/1GE6zTXm65/

## Security
- The browser only uses the Supabase publishable key.
- Keep Supabase RLS enabled.
- Never add service-role keys to this repository or browser code.
