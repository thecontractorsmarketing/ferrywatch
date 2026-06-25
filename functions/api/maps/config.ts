type Env = {
  GOOGLE_MAPS_API_KEY?: string;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.GOOGLE_MAPS_API_KEY) {
    return json(500, {
      error: "Missing GOOGLE_MAPS_API_KEY",
      message: "Add a Google Maps JavaScript API key as a Cloudflare Pages secret."
    });
  }

  return new Response(JSON.stringify({ apiKey: env.GOOGLE_MAPS_API_KEY }), {
    status: 200,
    headers: {
      ...JSON_HEADERS,
      "cache-control": "public, max-age=300"
    }
  });
};
