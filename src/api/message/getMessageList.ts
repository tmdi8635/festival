import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PageResponse } from "@/type/api";
import type { MessageLog, MessagePurpose } from "@/type/message";

export interface MessageListParams {
  page: number;
  size: number;
  keyword?: string;
  purpose?: MessagePurpose;
}

export const getMessageList = async (params: MessageListParams) => {
  const response = await adminAxios.get<PageResponse<MessageLog>>(
    "/admin/messages",
    { params },
  );

  return response.data;
};

/** 발송 이력 화면에서 사용합니다. */
export const useMessageListQuery = (params: MessageListParams) => {
  return usePermittedQuery<PageResponse<MessageLog>>("message:read", {
    queryKey: ["get-message-list", params],
    queryFn: () => getMessageList(params),
  });
};
