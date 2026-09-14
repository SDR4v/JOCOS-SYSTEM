import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Biometrics exports are PDFs uploaded via a Server Action — the
      // default 1MB body limit is too small for a multi-page report.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
