/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep native/server-only deps out of the client + server bundle tracing.
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "puppeteer",
      "canvas",
      "nodemailer",
      "node-cron",
    ],
  },
};

module.exports = nextConfig;
