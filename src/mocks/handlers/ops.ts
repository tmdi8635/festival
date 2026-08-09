import { HttpResponse, delay, http } from "msw";
import { normalizePermissions } from "@/type/permission";
import type {
  AdminRole,
  AdminRoleFormValues,
  LogDomain,
  LogLevel,
  Manager,
  ManagerFormValues,
  OperationSettings,
} from "@/type/ops";
import {
  adminRoles,
  findAdminRole,
  managers,
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
   * 지금 로그인한 담당자와 그 권한.
   *
   * 권한 목록을 화면이 들고 있게 하지 않고 **서버가 내려 준다.**
   * 직책이 바뀌면 다음 조회에서 곧바로 반영되고, 화면은 그것을 그대로 쓴다.
   */
  http.get(`${BASE_URI}/admin/me`, async ({ request }) => {
    const managerId = Number(request.headers.get("X-Admin-Id"));
    const manager = managers.find((item) => item.managerId === managerId);

    if (!manager) return notFound("존재하지 않는 담당자입니다.");

    const role = findAdminRole(manager.roleId);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({
      managerId: manager.managerId,
      name: manager.name,
      email: manager.email,
      roleId: manager.roleId,
      roleName: role?.name ?? manager.roleName,
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

    // 직책 이름이 바뀌면 담당자 목록에 박아 둔 이름도 함께 맞춘다.
    managers
      .filter((manager) => manager.roleId === role.roleId)
      .forEach((manager) => {
        manager.roleName = role.name;
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
        `이 직책에 담당자 ${role.memberCount}명이 있습니다. 다른 직책으로 먼저 옮겨 주세요.`,
        "ROLE_HAS_MEMBERS",
      );
    }

    adminRoles.splice(adminRoles.indexOf(role), 1);
    await delay(MOCK_DELAY_MS);

    return new HttpResponse(null, { status: 204 });
  }),


  http.get(`${BASE_URI}/admin/managers`, async ({ request }) => {
    const denied = requirePermission(request, "admin:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";

    const filtered = managers.filter((manager) =>
      matchesKeyword(keyword, manager.name, manager.email, manager.phoneNumber),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items: filtered });
  }),

  http.post(`${BASE_URI}/admin/managers`, async ({ request }) => {
      const denied = requirePermission(request, "admin:write");

      if (denied) return denied;

    const body = (await request.json()) as ManagerFormValues;

    const isDuplicated = managers.some(
      (manager) => manager.email === body.email,
    );

    if (isDuplicated) {
      return HttpResponse.json(
        { code: "DUPLICATED_EMAIL", message: "이미 등록된 이메일입니다." },
        { status: 409 },
      );
    }

    const role = findAdminRole(body.roleId);

    if (!role) return badRequest("직책을 선택해 주세요.");

    const created: Manager = {
      ...body,
      managerId: nextId(managers, "managerId"),
      roleName: role.name,
      isSuperAdmin: role.isSuperAdmin,
      eventCount: 0,
      createdAt: new Date().toISOString(),
    };

    managers.push(created);
    recalculateRoleMemberCounts();
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(
    `${BASE_URI}/admin/managers/:managerId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "admin:write");

      if (denied) return denied;

      const manager = managers.find(
        (item) => item.managerId === Number(params.managerId),
      );
      const body = (await request.json()) as ManagerFormValues;

      if (!manager) return notFound("존재하지 않는 담당자입니다.");

      const role = findAdminRole(body.roleId);

      if (!role) return badRequest("직책을 선택해 주세요.");

      /*
        최고관리자를 다른 직책으로 내리면 권한을 되돌릴 사람이 사라질 수 있다.
        마지막 한 명일 때만 막는다. 두 명 이상이면 한 명은 내려도 된다.
      */
      if (manager.isSuperAdmin && !role.isSuperAdmin) {
        const superAdminCount = managers.filter(
          (item) => item.isSuperAdmin && item.isActive,
        ).length;

        if (superAdminCount <= 1) {
          return badRequest(
            "마지막 최고관리자입니다. 다른 담당자를 최고관리자로 올린 뒤에 바꿔 주세요.",
            "LAST_SUPER_ADMIN",
          );
        }
      }

      Object.assign(manager, body, {
        roleName: role.name,
        isSuperAdmin: role.isSuperAdmin,
      });
      recalculateRoleMemberCounts();
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(manager);
    },
  ),

  http.delete(`${BASE_URI}/admin/managers/:managerId`, async ({ params, request }) => {
      const denied = requirePermission(request, "admin:delete");

      if (denied) return denied;

    const managerId = Number(params.managerId);
    const manager = managers.find((item) => item.managerId === managerId);

    if (!manager) return notFound("존재하지 않는 담당자입니다.");

    if (manager.isSuperAdmin) {
      return badRequest(
        "최고관리자 계정은 삭제할 수 없습니다.",
        "SUPER_ADMIN_LOCKED",
      );
    }

    managers.splice(
      managers.findIndex((item) => item.managerId === managerId),
      1,
    );

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

    Object.assign(operationSettings, body, {
      updatedAt: new Date().toISOString(),
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(operationSettings);
  }),
];
