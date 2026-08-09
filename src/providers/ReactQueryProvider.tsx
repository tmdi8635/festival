"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // useState를 사용해야 렌더링 시 인스턴스가 새로 생성되는 것을 방지
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 클라이언트에서 하이드레이션 직후 데이터를 다시 가져오는 것을 방지
            staleTime: 1000 * 60 * 5,
            // 창 포커스 시 재요청 비활성화 (개발 중 콘솔 중복 방지)
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
