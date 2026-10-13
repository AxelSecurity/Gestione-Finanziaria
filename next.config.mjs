import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: { serverActions: { bodySizeLimit: "25mb" }, middlewareClientMaxBodySize: "25mb" },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "node-cron", "nodemailer"],
  webpack(config) {
    config.resolve.alias["@"] = path.join(root, "src");
    return config;
  },
};
export default nextConfig;
