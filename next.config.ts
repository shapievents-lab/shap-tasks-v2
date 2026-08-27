import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Louis document ingestion uses these to parse uploaded PDF/DOCX files server-side —
  // keep them out of the Turbopack bundle so their Node-native/CJS internals load normally.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
