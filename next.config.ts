import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 가족 전용 앱이므로 검색엔진 색인을 전면 차단한다.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
