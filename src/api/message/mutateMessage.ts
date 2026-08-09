import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { MessageLog, SendMessageRequest } from "@/type/message";

export const sendMessage = async (body: SendMessageRequest) => {
  const response = await adminAxios.post<MessageLog>(
    "/admin/messages/send",
    body,
  );

  return response.data;
};

/** 문자 · 알림톡 발송입니다. 전송 구간만 외부 API로 교체하면 됩니다. */
export const useMessageMutation = () => {
  const queryClient = useQueryClient();

  const sendMutation = useMutation<MessageLog, AppError, SendMessageRequest>({
    mutationFn: sendMessage,
    onSuccess: (log) => {
      showAppToast("success", `${log.successCount}명에게 발송했습니다.`, {
        description:
          log.failCount > 0
            ? `${log.failCount}건은 연락처 문제로 실패했습니다.`
            : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["get-message-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-message-templates"] });
    },
  });

  return { sendMutation };
};
