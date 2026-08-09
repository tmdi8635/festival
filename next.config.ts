import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /**
   * 개발 서버를 클라우드플레어 터널로 잠깐 밖에 열 때 쓴다.
   * (`cloudflared tunnel --url http://localhost:3001`)
   * 이걸 안 적으면 Next가 교차 출처 개발 요청을 막아 HMR과 정적 자원이 끊긴다.
   * 개발 서버에만 적용되고 빌드 결과에는 영향이 없다.
   */
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
