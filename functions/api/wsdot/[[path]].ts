type Env = {
  WSDOT_API_KEY?: string;
  WSDOT_API_ORIGIN?: string;
};

const SERVICE_PATHS = {
  schedule: "/Ferries/API/Schedule/rest",
  terminals: "/Ferries/API/Terminals/rest",
  vessels: "/Ferries/API/Vessels/rest"
} as const;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

type WsdotService = keyof typeof SERVICE_PATHS;

function getPath(params: Record<string, unknown>): string[] {
  const value = params.path;
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string") {
    return value.split("/").filter(Boolean);
  }
  return [];
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

function cacheHeader(service: WsdotService, endpoint: string) {
  if (service === "vessels" && endpoint.startsWith("vessellocations")) {
    return "no-store";
  }

  if (service === "terminals" && endpoint.startsWith("terminalsailingspace")) {
    return "no-store";
  }

  if (service === "schedule" && endpoint.startsWith("scheduletoday")) {
    return "public, max-age=30";
  }

  return "public, max-age=300";
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const parts = getPath(params);
  const service = parts.shift();

  if (!service || !(service in SERVICE_PATHS)) {
    return json(404, {
      error: "Unknown WSDOT service",
      services: Object.keys(SERVICE_PATHS)
    });
  }

  const endpoint = parts.join("/");
  if (!endpoint || !/^[a-z0-9/_-]+$/i.test(endpoint)) {
    return json(400, { error: "Invalid WSDOT endpoint" });
  }

  if (!env.WSDOT_API_KEY) {
    return json(500, {
      error: "Missing WSDOT_API_KEY",
      message: "Add the WSDOT Traveler API access code as a Cloudflare Pages secret."
    });
  }

  const requestUrl = new URL(request.url);
  const origin = env.WSDOT_API_ORIGIN || "https://www.wsdot.wa.gov";
  const upstream = new URL(`${SERVICE_PATHS[service as WsdotService]}/${endpoint}`, origin);
  upstream.searchParams.set("apiaccesscode", env.WSDOT_API_KEY);

  for (const [key, value] of requestUrl.searchParams) {
    if (key.toLowerCase() !== "apiaccesscode") {
      upstream.searchParams.set(key, value);
    }
  }

  const response = await fetch(upstream.toString(), {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || JSON_HEADERS["content-type"],
      "cache-control": cacheHeader(service as WsdotService, endpoint),
      "cdn-cache-control": service === "vessels" ? "no-store" : cacheHeader(service as WsdotService, endpoint),
      "access-control-allow-origin": "*"
    }
  });
};
