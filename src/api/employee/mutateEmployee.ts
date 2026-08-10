import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { Employee, EmployeeFormValues } from "@/type/employee";

export const createEmployee = async (body: EmployeeFormValues) => {
  const response = await adminAxios.post<Employee>("/admin/employees", body);

  return response.data;
};

export const updateEmployee = async (
  staffId: number,
  body: EmployeeFormValues,
) => {
  const response = await adminAxios.put<Employee>(
    `/admin/employees/${staffId}`,
    body,
  );

  return response.data;
};

/**
 * 직원 등록 · 수정.
 *
 * 직원은 인력풀 레코드 위에 얹혀 있어(같은 `staffId`) 이름 · 연락처를 고치면
 * 배치 후보 · 행사 명부도 함께 달라진다. 그래서 인력 쪽 조회도 같이 비운다.
 */
export const useEmployeeMutation = () => {
  const queryClient = useQueryClient();

  const invalidateEmployee = () => {
    queryClient.invalidateQueries({ queryKey: ["get-employee-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-staff-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-assignment-candidates"] });
  };

  const createMutation = useMutation<Employee, AppError, EmployeeFormValues>({
    mutationFn: createEmployee,
    onSuccess: (employee) => {
      showAppToast("success", `${employee.name}님을 직원으로 등록했습니다.`);
      invalidateEmployee();
    },
  });

  const updateMutation = useMutation<
    Employee,
    AppError,
    { staffId: number; body: EmployeeFormValues }
  >({
    mutationFn: ({ staffId, body }) => updateEmployee(staffId, body),
    onSuccess: () => {
      showAppToast("success", "직원 정보를 저장했습니다.");
      invalidateEmployee();
    },
  });

  return { createMutation, updateMutation };
};
