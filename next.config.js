/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    localPatterns: [
      { pathname: '/riverwalk-logo.png' },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/uploads/**',
      },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          // unsafe-inline needed for onclick handlers in dangerouslySetInnerHTML HTML
          // unsafe-eval needed by jsPDF
          // cdnjs.cloudflare.com for jsPDF CDN
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdnjs.cloudflare.com",
            "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
            "font-src 'self' fonts.gstatic.com data:",
            "img-src 'self' data: blob:",
            "connect-src 'self' https:",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
    {
      source: '/uploads/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        // Force download — prevents browsers from rendering uploaded files as HTML/SVG
        { key: 'Content-Disposition', value: 'attachment' },
        // Restrict to image types only — belt + suspenders with upload validation
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
};

module.exports = nextConfig;
