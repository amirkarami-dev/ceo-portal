import type { NextConfig } from "next";

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

/** Only the API's media route is allowed through the image optimizer. */
const MEDIA_PATHNAME = "/api/kurdnezam/media/**";

const remotePatterns: RemotePattern[] = [
  // production API host (uploaded media)
  {
    protocol: "https",
    hostname: "api.mabhas19.myceo.ir",
    pathname: MEDIA_PATHNAME,
  },
];

// …plus whatever NEXT_PUBLIC_API_BASE points at (dev: http://localhost:5000).
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000";
try {
  const url = new URL(apiBase);
  const alreadyAllowed = remotePatterns.some(
    (p) => "hostname" in p && p.hostname === url.hostname
  );
  if (!alreadyAllowed) {
    remotePatterns.push({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port, // "" when the protocol default is used
      pathname: MEDIA_PATHNAME,
    });
  }
} catch {
  console.warn(`[next.config] NEXT_PUBLIC_API_BASE is not a URL: ${apiBase}`);
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns,
    // Next 16 refuses to optimize images served from local IPs by default,
    // which would break `next/image` against a localhost API in development.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;
