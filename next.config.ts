import type { NextConfig } from "next";

/**
 * 깃허브 페이지로 내보내는 빌드인지.
 *
 * 페이지는 정적 파일만 서빙하므로 서버가 필요한 기능(라우트 핸들러 · 이미지 최적화 ·
 * 리다이렉트)을 쓸 수 없다. 그래서 평소 빌드(`standalone`)와 갈라 둔다.
 * 워크플로가 `GITHUB_PAGES=true`를 넣어 줄 때만 정적 내보내기로 바뀐다.
 */
const isGithubPages = process.env.GITHUB_PAGES === "true";

/**
 * 하위 경로 배포용 접두사. `https://<계정>.github.io/festival` 처럼
 * 저장소 이름이 경로에 붙기 때문에 링크 · 정적 자원 · **목업 주소**가 전부 이 값을 안다.
 * (목업 쪽 이유는 `src/mocks/utils.ts`의 `BASE_URI` 주석)
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : "standalone",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  /**
   * 정적 호스팅에서는 `/clients` 같은 확장자 없는 주소를 서버가 해석해 주지 않는다.
   * 폴더 + `index.html`로 떨어뜨려야 새로고침 · 직접 접속이 깨지지 않는다.
   */
  trailingSlash: isGithubPages,
  /**
   * 개발 서버를 클라우드플레어 터널로 잠깐 밖에 열 때 쓴다.
   * (`cloudflared tunnel --url http://localhost:3001`)
   * 이걸 안 적으면 Next가 교차 출처 개발 요청을 막아 HMR과 정적 자원이 끊긴다.
   * 개발 서버에만 적용되고 빌드 결과에는 영향이 없다.
   */
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    /* 이미지 최적화는 서버가 하는 일이라 정적 내보내기에서는 끈다. */
    unoptimized: isGithubPages,
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
