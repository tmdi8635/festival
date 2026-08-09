import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { Client, ClientFormValues } from "@/type/client";

export const createClient = async (body: ClientFormValues) => {
  const response = await adminAxios.post<Client>("/admin/clients", body);

  return response.data;
};

export const updateClient = async (
  clientId: number,
  body: ClientFormValues,
) => {
  const response = await adminAxios.put<Client>(
    `/admin/clients/${clientId}`,
    body,
  );

  return response.data;
};

/** 거래처 등록 · 수정 후 목록과 상세를 함께 갱신합니다. */
export const useClientMutation = () => {
  const queryClient = useQueryClient();

  const invalidateClient = () => {
    queryClient.invalidateQueries({ queryKey: ["get-client-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-client-detail"] });
  };

  const createMutation = useMutation<Client, AppError, ClientFormValues>({
    mutationFn: createClient,
    onSuccess: () => {
      showAppToast("success", "거래처를 등록했습니다.");
      invalidateClient();
    },
  });

  const updateMutation = useMutation<
    Client,
    AppError,
    { clientId: number; body: ClientFormValues }
  >({
    mutationFn: ({ clientId, body }) => updateClient(clientId, body),
    onSuccess: () => {
      showAppToast("success", "거래처 정보를 저장했습니다.");
      invalidateClient();
    },
  });

  return { createMutation, updateMutation };
};
