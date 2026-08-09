"use client";

import { useEffect, useState } from "react";

const isMockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
let workerReadyPromise: Promise<void> | null = null;

const startWorker = async () => {
  if (!workerReadyPromise) {
    workerReadyPromise = import("@/mocks/browser").then(async ({ worker }) => {
      await worker.start({
        onUnhandledRequest: "bypass",
        serviceWorker: {
          url: "/mockServiceWorker.js",
        },
      });
    });
  }

  return workerReadyPromise;
};

export default function MSWProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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
}
