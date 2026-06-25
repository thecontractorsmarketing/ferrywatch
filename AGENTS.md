# FerryWatch Codex Notes

## Workflow

- Treat GitHub `main` as the source of truth for this app.
- Before editing, fetch and fast-forward the local checkout when a remote exists.
- Keep one local project folder, one GitHub repo, and one Cloudflare Pages project for FerryWatch.
- Deploy the `main` branch to the existing Cloudflare Pages project named `ferrywatch`.
- Preserve the Pages Functions in `functions/`; they proxy WSDOT and Google Maps secrets so API keys are not exposed in browser code.

## Checks

- Run `npm run build` before committing deployable changes.
- Do not commit `.dev.vars`, Cloudflare tokens, WSDOT API keys, or Google Maps API keys.
