/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "pdfjs-dist", "@napi-rs/canvas", "tesseract.js", "tesseract.js-core",
    "mammoth", "word-extractor", "rtf-parser", "yauzl",
  ],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "Permissions-Policy", value: "microphone=(), camera=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
