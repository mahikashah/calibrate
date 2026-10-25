/** @type {import('next').NextConfig} */
const nextConfig = {
  // The libSQL client loads a native module; keep it external to the server bundle.
  // (Key name differs across Next versions; Next 14.2 uses the experimental one.)
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "libsql"],
  },
};
module.exports = nextConfig;
