import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  MessageTemplate,
  MessageTemplateFormValues,
} from "@/type/message";

export const createMessageTemplate = async (
  body: MessageTemplateFormValues,
) => {
  const response = await adminAxios.post<MessageTemplate>(
    "/admin/message-templates",
    body,
  );

  return response.data;
};

export const updateMessageTemplate = async (
  templateId: number,
  body: MessageTemplateFormValues,
) => {
  const response = await adminAxios.put<MessageTemplate>(
    `/admin/message-templates/${templateId}`,
    body,
  );

  return response.data;
};

export const deleteMessageTemplate = async (templateId: number) => {
  await adminAxios.delete(`/admin/message-templates/${templateId}`);
};

/** 메시지 템플릿 CRUD 후 목록을 갱신합니다. */
export const useMessageTemplateMutation = () => {
  const queryClient = useQueryClient();

  const invalidateTemplate = () =>
    queryClient.invalidateQueries({ queryKey: ["get-message-templates"] });

  const createMutation = useMutation<
    MessageTemplate,
    AppError,
    MessageTemplateFormValues
  >({
    mutationFn: createMessageTemplate,
    onSuccess: () => {
      showAppToast("success", "템플릿을 추가했습니다.");
      invalidateTemplate();
    },
  });

  const updateMutation = useMutation<
    MessageTemplate,
    AppError,
    { templateId: number; body: MessageTemplateFormValues }
  >({
    mutationFn: ({ templateId, body }) =>
      updateMessageTemplate(templateId, body),
    onSuccess: () => {
      showAppToast("success", "템플릿을 저장했습니다.");
      invalidateTemplate();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteMessageTemplate,
    onSuccess: () => {
      showAppToast("success", "템플릿을 삭제했습니다.");
      invalidateTemplate();
    },
  });

  return { createMutation, updateMutation, deleteMutation };
};
