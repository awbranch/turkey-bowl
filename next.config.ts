import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (D1) via getCloudflareContext().
initOpenNextCloudflareForDev();
