/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing the sibling backend packages (calc-core, repositories,
  // services, api/http) that live outside this app directory. Vercel's "Root
  // Directory" is this web/ folder, but the whole repo is cloned, so these
  // resolve via tsconfig path aliases at build time.
  experimental: { externalDir: true },
};
export default nextConfig;
