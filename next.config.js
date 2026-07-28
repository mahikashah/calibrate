/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; keep it external to the server bundle.
  // (Key name differs across Next versions; Next 14.2 uses the experimental one.)
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};
module.exports = nextConfig;
