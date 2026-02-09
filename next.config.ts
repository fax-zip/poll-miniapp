import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/.well-known/farcaster.json",
        destination:
          "https://api.farcaster.xyz/miniapps/hosted-manifest/019c4070-9c07-b0df-f5e2-dd1463a90029",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
