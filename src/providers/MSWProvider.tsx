"use client";

import { ReactNode, useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/basePath";

const isMockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

/**
 * 워커는 한 번만 띄운다.
 * 모듈 스코프에 약속을 붙잡아 두어야 StrictMode의 이중 마운트에서도 두 번 시작하지 않는다.
 */
let workerReadyPromise: Promise<void> | null = null;

const startWorker = async () => {
  if (!workerReadyPromise) {
    workerReadyPromise = import("@/mocks/browser").then(async ({ worker }) => {
      await worker.start({
        onUnhandledRequest: "bypass",
        serviceWorker: {
          /*
            하위 경로 배포에서는 워커 파일도 접두사 아래에 있다.
            워커는 자기가 놓인 폴더까지만 가로챌 수 있으므로 요청 주소도 같이 맞춰야 한다.
            (`lib/basePath.ts`)
          */
          url: `${BASE_PATH}/mockServiceWorker.js`,
        },
      });
    });
  }

  return workerReadyPromise;
};

interface MSWProviderProps {
  children: ReactNode;
}

/** 워커가 뜨기 전에 화면을 그리면 첫 요청이 목업을 타지 않고 그대로 나간다. */
const MSWProvider = ({ children }: MSWProviderProps) => {
  const [isReady, setIsReady] = useState(!isMockingEnabled);

  useEffect(() => {
    if (!isMockingEnabled) return;

    startWorker()
      .catch((error) => {
        console.error("[MSW] failed to start worker:", error);
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  if (!isReady) return null;

  return <>{children}</>;
};

export default MSWProvider;
