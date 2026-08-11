import { HttpResponse, delay, http } from "msw";
import { normalizePermissions } from "@/type/permission";
import { sanitizeJobRoles } from "@/type/staff";
import type {
  AdminRole,
  AdminRoleFormValues,
  LogDomain,
  LogLevel,
  OperationSettings,
} from "@/type/ops";
import {
  adminRoles,
  employees,
  findAdminRole,
  findEmployee,
  operationLogs,
  operationSettings,
  recalculateRoleMemberCounts,
} from "../db/ops";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
  requirePermission,
} from "../utils";

export const opsHandlers = [
  /**
   * 지금 로그인한 직원과 그 권한.
   *
   * 권한 목록을 화면이 들고 있게 하지 않고 **서버가 내려 준다.**
   * 직책이 바뀌면 다음 조회에서 곧바로 반영되고, 화면은 그것을 그대로 쓴다.
   */
  http.get(`${BASE_URI}/admin/me`, async ({ request }) => {
    const employee = findEmployee(Number(request.headers.get("X-Admin-Id")));

    if (!employee) return notFound("존재하지 않는 직원입니다.");

    const role = findAdminRole(employee.roleId);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      roleId: employee.roleId,
      roleName: role?.name ?? employee.roleName,
      isSuperAdmin: Boolean(role?.isSuperAdmin),
      permissions: role?.permissions ?? [],
    });
  }),


  /* ------------------------------ 직책 · 권한 ----------------------------- */
  http.get(`${BASE_URI}/admin/roles`, async ({ request }) => {
    const denied = requirePermission(request, "role:read");

    if (denied) return denied;

    recalculateRoleMemberCounts();
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items: adminRoles });
  }),

  http.post(`${BASE_URI}/admin/roles`, async ({ request }) => {
      const denied = requirePermission(request, "role:write");

      if (denied) return denied;

    const body = (await request.json()) as AdminRoleFormValues;

    if (!body.name?.trim()) return badRequest("직책 이름을 입력해 주세요.");

    if (adminRoles.some((role) => role.name === body.name.trim())) {
      return badRequest("같은 이름의 직책이 이미 있습니다.", "DUPLICATED_ROLE");
    }

    const created: AdminRole = {
      roleId: nextId(adminRoles, "roleId"),
      name: body.name.trim(),
      description: body.description?.trim() ?? "",
      // write를 주면 read도 함께 들어간다. 고칠 수는 있는데 볼 수 없는 상태는 뜻이 없다.
      permissions: normalizePermissions(body.permissions ?? []),
      isSuperAdmin: false,
      memberCount: 0,
      createdAt: new Date().toISOString(),
    };

    adminRoles.push(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(`${BASE_URI}/admin/roles/:roleId`, async ({ params, request }) => {
      const denied = requirePermission(request, "role:write");

      if (denied) return denied;

    const role = findAdminRole(Number(params.roleId));
    const body = (await request.json()) as AdminRoleFormValues;

    if (!role) return notFound("존재하지 않는 직책입니다.");

    /*
      최고관리자의 권한은 건드리지 못한다.
      뺄 수 있으면 실수 한 번으로 "권한을 되돌릴 수 있는 사람이 아무도 없는"
      상태가 만들어지고, 그때는 코드를 고치는 것 말고 방법이 없다.
    */
    if (role.isSuperAdmin) {
      return badRequest(
        "최고관리자의 권한은 바꿀 수 없습니다. 이 직책이 잠겨 있어야 권한을 되돌릴 사람이 남습니다.",
        "SUPER_ADMIN_LOCKED",
      );
    }

    if (
      adminRoles.some(
        (item) => item.name === body.name?.trim() && item.roleId !== role.roleId,
      )
    ) {
      return badRequest("같은 이름의 직책이 이미 있습니다.", "DUPLICATED_ROLE");
    }

    role.name = body.name?.trim() || role.name;
    role.description = body.description?.trim() ?? "";
    role.permissions = normalizePermissions(body.permissions ?? []);

    // 직책 이름이 바뀌면 직원 목록에 박아 둔 이름도 함께 맞춘다.
    employees
      .filter((employee) => employee.roleId === role.roleId)
      .forEach((employee) => {
        employee.roleName = role.name;
      });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(role);
  }),

  http.delete(`${BASE_URI}/admin/roles/:roleId`, async ({ params, request }) => {
      const denied = requirePermission(request, "role:delete");

      if (denied) return denied;

    const role = findAdminRole(Number(params.roleId));

    if (!role) return notFound("존재하지 않는 직책입니다.");

    if (role.isSuperAdmin) {
      return badRequest(
        "최고관리자 직책은 삭제할 수 없습니다.",
        "SUPER_ADMIN_LOCKED",
      );
    }

    recalculateRoleMemberCounts();

    /*
      사람이 남아 있는 직책은 지우지 않는다.
      지우고 나면 그 사람들은 직책이 없는 상태가 되는데, 그건 권한이 없는 것과
      다르다. 화면은 열리는데 아무것도 못 하는 계정이 조용히 생긴다.
    */
    if (role.memberCount > 0) {
      return badRequest(
        `이 직책에 직원 ${role.memberCount}명이 있습니다. 다른 직책으로 먼저 옮겨 주세요.`,
        "ROLE_HAS_MEMBERS",
      );
    }

    adminRoles.splice(adminRoles.indexOf(role), 1);
    await delay(MOCK_DELAY_MS);

    return new HttpResponse(null, { status: 204 });
  }),


  http.get(`${BASE_URI}/admin/logs`, async ({ request }) => {
    const denied = requirePermission(request, "log:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const level = url.searchParams.get("level") as LogLevel | null;
    const domain = url.searchParams.get("domain") as LogDomain | null;

    const filtered = operationLogs.filter((log) => {
      if (level && log.level !== level) return false;
      if (domain && log.domain !== domain) return false;

      return matchesKeyword(keyword, log.message, log.actor, log.action);
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(filtered, url));
  }),

  http.get(`${BASE_URI}/admin/settings`, async () => {
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(operationSettings);
  }),

  http.put(`${BASE_URI}/admin/settings`, async ({ request }) => {
      const denied = requirePermission(request, "settings:write");

      if (denied) return denied;

    const body = (await request.json()) as OperationSettings;

    /*
      직무 목록은 **서버가 정한다.**

      화면에서 이름 · 순서를 바꿀 수 없게 만들어 뒀지만, 막는 책임은 서버에 있다.
      요청에 없는 직무는 기본 단가로 채우고, 카탈로그에 없는 코드는 버린다.
      (그러지 않으면 요청 한 번으로 직무 목록이 통째로 갈릴 수 있다)
    */
    Object.assign(operationSettings, body, {
      jobRoles: sanitizeJobRoles(body.jobRoles ?? []),
      updatedAt: new Date().toISOString(),
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(operationSettings);
  }),
];
