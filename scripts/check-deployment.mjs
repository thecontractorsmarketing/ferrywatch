import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = new URL(process.env.PRODUCTION_URL || "https://wsf.gordonhbrown.com/");
const dist = new URL("../dist/", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function get(path) {
  const response = await fetch(new URL(path, base), {
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).origin, base.origin, `${path}: unexpected redirect`);
  return response;
}

try {
  const html = await readFile(new URL("index.html", dist));
  const liveHtml = Buffer.from(await (await get("/")).arrayBuffer());
  assert.equal(hash(liveHtml), hash(html), "Production HTML differs from this build");
  assert.ok(liveHtml.toString().includes(`rel="canonical" href="${base.href}"`), "Canonical URL mismatch");

  const assets = [...new Set([...html.toString().matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map((match) => match[1]))];
  assert.ok(assets.length > 0, "No build assets found");
  for (const path of [...assets, "/manifest.webmanifest", "/icons/ferrywatch.svg"]) {
    const local = await readFile(new URL(path.slice(1), dist));
    const live = Buffer.from(await (await get(path)).arrayBuffer());
    assert.equal(hash(live), hash(local), `${path}: deployed asset differs from build`);
  }

  const maps = await (await get("/api/maps/config")).json();
  assert.ok(typeof maps.apiKey === "string" && maps.apiKey.length > 0, "Maps configuration missing");
  const vessels = await (await get("/api/wsdot/vessels/vessellocations")).json();
  assert.ok(Array.isArray(vessels) && vessels.some((vessel) => typeof vessel.VesselID === "number"), "Live vessel data missing");
  console.log(`Verified ${base.href}: matching HTML/assets, Maps configuration, and ${vessels.length} live vessels.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
