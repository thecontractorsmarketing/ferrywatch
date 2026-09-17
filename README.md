# FerryWatch

iPhone-first Washington State Ferries route watch app using the WSDOT Traveler APIs.

Production: **https://wsf.gordonhbrown.com/**

Source: https://github.com/thecontractorsmarketing/ferrywatch (`main`).

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.dev.vars.example` to `.dev.vars` and add a WSDOT Traveler API access code.

3. Run the phone UI:

   ```sh
   npm run dev
   ```

The app has demo data fallback for layout work. Live WSDOT data is served through the Cloudflare Pages Function at `/api/wsdot/...` so the API key is not exposed in the browser.

## Cloudflare Pages

The production Cloudflare Pages project is `ferrywatch`.

The custom domain `wsf.gordonhbrown.com` is attached to this existing project,
with a proxied CNAME pointing to `ferrywatch.pages.dev`. This replaces the
retired `wsf.ghb.pw` hostname. Keep the same Pages project so its Functions and
secrets remain available.

The Google Maps browser key must allow `https://wsf.gordonhbrown.com/*` in its
website restrictions. The browser receives this restricted key from
`/api/maps/config`; the WSDOT key stays server-side.

Set `WSDOT_API_KEY` and `GOOGLE_MAPS_API_KEY` as Pages project secrets, then deploy:

```sh
npm run deploy
```

Pushes to GitHub `main` also deploy through `.github/workflows/deploy-cloudflare-pages.yml` when the repo has `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_PAGES_API_TOKEN` secrets configured.

After deployment, the workflow checks the production hostname, compares the
served HTML/assets with the build, and verifies Maps configuration and live
WSDOT vessel data. Run the same check locally after `npm run build`:

```sh
node scripts/check-deployment.mjs
```

## Data Used

- WSF Vessels API: `/Ferries/API/Vessels/rest/vessellocations`
- WSF Schedule API: `/Ferries/API/Schedule/rest/scheduletoday/{DepartingTerminalID}/{ArrivingTerminalID}/false`
- WSF Terminals API: `/Ferries/API/Terminals/rest/terminallocations`
- WSF Terminal Sailing Space API: `/Ferries/API/Terminals/rest/terminalsailingspace/{TerminalID}`
