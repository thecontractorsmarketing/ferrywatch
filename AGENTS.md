# FerryWatch Codex Notes

## Workflow

- Treat GitHub `main` as the source of truth for this app.
- Before editing, fetch and fast-forward the local checkout when a remote exists.
- Keep one local project folder, one GitHub repo, and one Cloudflare Pages project for FerryWatch.
- Deploy the `main` branch to the existing Cloudflare Pages project named `ferrywatch`.
- The production URL is `https://wsf.gordonhbrown.com/`. Keep its Pages custom domain, DNS CNAME, Google Maps website restrictions, and GitHub homepage aligned.
- Use the Pages-scoped GitHub Actions secret `CLOUDFLARE_PAGES_API_TOKEN` for CI deploys; do not use DNS, Registrar, or generic Cloudflare tokens for Pages deploys.
- Preserve the Pages Functions in `functions/`; the WSDOT key stays server-side, while `/api/maps/config` supplies the website-restricted Google Maps browser key.

## Checks

- Run `npm run build` before committing deployable changes.
- Do not commit `.dev.vars`, Cloudflare tokens, WSDOT API keys, or Google Maps API keys.
