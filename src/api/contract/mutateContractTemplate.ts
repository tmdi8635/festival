import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  ContractTemplate,
  ContractTemplateFormValues,
} from "@/type/contract";

export const createContractTemplate = async (
  body: ContractTemplateFormValues,
) => {
  const response = await adminAxios.post<ContractTemplate>(
    "/admin/contract-templates",
    body,
  );

  return response.data;
};

export const updateContractTemplate = async (
  templateId: number,
  body: ContractTemplateFormValues,
) => {
  const response = await adminAxios.put<ContractTemplate>(
    `/admin/contract-templates/${templateId}`,
    body,
  );

  return response.data;
};

export const deleteContractTemplate = async (templateId: number) => {
  await adminAxios.delete(`/admin/contract-templates/${templateId}`);
};

/** 계약서 템플릿 CRUD 후 목록을 갱신합니다. */
export const useContractTemplateMutation = () => {
  const queryClient = useQueryClient();

  const invalidateTemplate = () =>
    queryClient.invalidateQueries({ queryKey: ["get-contract-templates"] });

  const createMutation = useMutation<
    ContractTemplate,
    AppError,
    ContractTemplateFormValues
  >({
    mutationFn: createContractTemplate,
    onSuccess: () => {
      showAppToast("success", "템플릿을 추가했습니다.");
      invalidateTemplate();
    },
  });

  const updateMutation = useMutation<
    ContractTemplate,
    AppError,
    { templateId: number; body: ContractTemplateFormValues }
  >({
    mutationFn: ({ templateId, body }) =>
      updateContractTemplate(templateId, body),
    onSuccess: () => {
      showAppToast("success", "템플릿을 저장했습니다.");
      invalidateTemplate();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteContractTemplate,
    onSuccess: () => {
      showAppToast("success", "템플릿을 삭제했습니다.");
      invalidateTemplate();
    },
  });

  return { createMutation, updateMutation, deleteMutation };
};
