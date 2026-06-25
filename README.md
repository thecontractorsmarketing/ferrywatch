# FerryWatch

iPhone-first Washington State Ferries route watch app using the WSDOT Traveler APIs.

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

Set `WSDOT_API_KEY` and `GOOGLE_MAPS_API_KEY` as Pages project secrets, then deploy:

```sh
npm run deploy
```

Pushes to GitHub `main` also deploy through `.github/workflows/deploy-cloudflare-pages.yml` when the repo has `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_PAGES_API_TOKEN` secrets configured.

## Data Used

- WSF Vessels API: `/Ferries/API/Vessels/rest/vessellocations`
- WSF Schedule API: `/Ferries/API/Schedule/rest/scheduletoday/{DepartingTerminalID}/{ArrivingTerminalID}/false`
- WSF Terminals API: `/Ferries/API/Terminals/rest/terminallocations`
- WSF Terminal Sailing Space API: `/Ferries/API/Terminals/rest/terminalsailingspace/{TerminalID}`
