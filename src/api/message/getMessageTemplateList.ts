import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { MessagePurpose, MessageTemplate } from "@/type/message";

export interface MessageTemplateListParams {
  keyword?: string;
  purpose?: MessagePurpose;
}

export interface MessageTemplateResponse {
  items: MessageTemplate[];
}

export const getMessageTemplateList = async (
  params: MessageTemplateListParams = {},
) => {
  const response = await adminAxios.get<MessageTemplateResponse>(
    "/admin/message-templates",
    { params },
  );

  return response.data;
};

/** 템플릿 관리 화면과 발송 화면의 선택지에서 함께 사용합니다. */
export const useMessageTemplateListQuery = (
  params: MessageTemplateListParams = {},
) => {
  return useQuery<MessageTemplateResponse, AppError>({
    queryKey: ["get-message-templates", params],
    queryFn: () => getMessageTemplateList(params),
  });
};
