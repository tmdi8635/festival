/**
 * 권한 모델.
 *
 * **직책(`AdminRole`)에 권한을 붙이고, 담당자를 직책에 넣는다.**
 * 담당자 한 명씩 권한을 주는 방식이 아니다. 권한은 "이 사람이 무엇을 할 수 있나"가
 * 아니라 **"이 일을 하는 사람에게 무엇이 필요한가"** 로 정해지기 때문이다.
 *
 * 사람마다 주면 담당자가 열 명일 때 설정도 열 번, 점검도 열 번이다.
 * 규칙이 바뀌면 열 곳을 고쳐야 하고 한 곳만 빠뜨리면 그 사람만 조용히 다른 권한을 갖는다.
 * "정산을 승인할 수 있는 사람이 누구인가"를 물었을 때, 직책이면 하나만 열어 보면 되고
 * 사람마다면 전원을 훑어야 한다.
 */

/** 권한을 거는 대상. 화면(메뉴)이 아니라 **자료와 행위** 기준으로 나눈다. */
export type PermissionResource =
  | "event"
  | "assignment"
  | "staff"
  | "staffDocument"
  | "blacklist"
  | "employee"
  | "contract"
  | "payroll"
  | "client"
  | "recruit"
  | "message"
  | "admin"
  | "role"
  | "settings"
  | "log";

/**
 * 행위.
 *
 * `read`/`write`/`delete`는 어디에나 있고, 그 외는 **돈과 대외 발신**처럼
 * 되돌릴 수 없는 행위만 따로 뗀다. 행위를 잘게 쪼갤수록 좋은 게 아니라,
 * 실수했을 때 되돌리기 어려운 것부터 떼어 내는 것이 맞다.
 */
export type PermissionAction =
  | "read"
  | "write"
  | "delete"
  | "approve"
  | "pay"
  | "send";

export type PermissionKey = `${PermissionResource}:${PermissionAction}`;

interface ResourceDef {
  label: string;
  /** 이 자료가 무엇인지. 권한 설정 화면에서 그대로 보여 준다. */
  description: string;
  actions: PermissionAction[];
  /** 개인정보 · 금전처럼 특별히 좁게 열어야 하는 자료 */
  isSensitive?: boolean;
}

export const PERMISSION_RESOURCES: Record<PermissionResource, ResourceDef> = {
  event: {
    label: "행사",
    description: "행사 등록 · 수정 · 발주 인원",
    actions: ["read", "write", "delete"],
  },
  assignment: {
    label: "배치 · 근태",
    description: "인력 배치, 출퇴근 · 근태 기록, 평가",
    actions: ["read", "write", "delete"],
  },
  staff: {
    label: "인력",
    description: "인력 등록 · 수정, 메모",
    actions: ["read", "write", "delete"],
  },
  staffDocument: {
    label: "인력 서류",
    description: "신분증 · 통장사본. 개인정보라 따로 뗀다.",
    actions: ["read", "write"],
    isSensitive: true,
  },
  blacklist: {
    label: "블랙리스트",
    description: "블랙리스트 지정 · 해제",
    actions: ["read", "write"],
    isSensitive: true,
  },
  contract: {
    label: "근로계약서",
    /*
      `send`를 두지 않는다.

      지금은 계약서가 시스템 밖으로 나가지 않는다. 담당자가 문서를 내려받아
      종이로 배부하고 서명본을 올린다. 그 등록이 `write`다.
      쓰이지 않는 권한을 설정 화면에 세워 두면, 켜 놓고도 아무 일이 안 일어나거나
      꺼 놓고도 문서가 나가는 것으로 오해하게 된다.
      근로자에게 링크가 나가는 서버가 붙는 날 다시 붙인다.
    */
    description: "계약서 등록 · 재작성 · 템플릿",
    actions: ["read", "write", "delete"],
  },
  payroll: {
    label: "정산",
    description: "정산 금액 조회 · 조정 · 지급 승인 · 지급 완료",
    actions: ["read", "write", "approve", "pay"],
    isSensitive: true,
  },
  client: {
    label: "거래처",
    description: "거래처와 청구 단가",
    actions: ["read", "write", "delete"],
    isSensitive: true,
  },
  recruit: {
    label: "모집",
    description: "공고 · 지원자",
    actions: ["read", "write", "delete"],
  },
  employee: {
    label: "직원",
    description: "우리 직원의 직책 · 기본 근무시간과 월 근무 집계",
    actions: ["read", "write"],
    isSensitive: true,
  },
  message: {
    label: "공지 · 발송",
    description: "문자 문구 작성과 발송",
    actions: ["read", "write", "send"],
  },
  admin: {
    label: "담당자",
    description: "담당자 계정 관리",
    actions: ["read", "write", "delete"],
    isSensitive: true,
  },
  role: {
    label: "직책 · 권한",
    description: "직책을 만들고 권한을 정한다. 가장 강한 권한이다.",
    actions: ["read", "write", "delete"],
    isSensitive: true,
  },
  settings: {
    label: "기준 설정",
    description: "직무 · 수당 기준 · 기능 잠금",
    actions: ["read", "write"],
  },
  log: {
    label: "운영 로그",
    description: "누가 무엇을 바꿨는지",
    actions: ["read"],
  },
};

export const PERMISSION_ACTION_LABEL: Record<PermissionAction, string> = {
  read: "조회",
  write: "등록 · 수정",
  delete: "삭제",
  approve: "승인",
  pay: "지급 완료",
  send: "발송",
};

/** 행위별로 무엇을 뜻하는지. 라벨만으로는 '승인'과 '지급 완료'가 구분되지 않는다. */
export const PERMISSION_ACTION_HINT: Record<PermissionAction, string> = {
  read: "목록과 상세를 봅니다.",
  write: "새로 만들고 고칩니다.",
  delete: "지웁니다. 되돌릴 수 없습니다.",
  approve: "지급을 승인합니다. 금액이 확정됩니다.",
  pay: "실제 지급 완료로 처리합니다.",
  send: "외부(근로자 · 지원자)에게 내보냅니다.",
};

/* ------------------------------------------------------------------ */
/* 분류                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 자료를 묶는 갈래.
 *
 * **행위 구성이 같은 자료끼리 묶는다.** 업무 영역(현장 · 인력 · 정산)이 아니다.
 *
 * 이 표는 자료(행) × 행위(열)인데, 자료마다 할 수 있는 행위가 다르다.
 * 열네 개를 한 표에 넣으면 행위 여섯 개를 전부 열로 세워야 하고,
 * 그러면 `승인` 열은 열네 칸 중 열세 칸이 빈칸이 된다.
 * 정산에만 있는 행위가 행사 줄에도 자리를 차지하는 셈이다.
 *
 * 갈래를 행위 구성으로 나누면 **갈래마다 열 이름이 달라진다.**
 * 정산 갈래의 열은 `조회 · 등록 · 승인 · 지급 완료`이고, 거기에만 있다.
 * 빈칸이 사라지고, 갈래 이름이 곧 "이 자료들로 무엇을 할 수 있는가"가 된다.
 */
export interface PermissionCategoryDef {
  id: string;
  label: string;
  /** 이 갈래의 행위 구성이 왜 이런지. 설정 화면에서 그대로 보여 준다. */
  description: string;
  resources: readonly PermissionResource[];
}

export const PERMISSION_CATEGORIES = [
  {
    id: "general",
    label: "만들고 고치고 지우는 자료",
    description: "조회 · 등록 · 삭제. 대부분의 자료가 여기에 해당합니다.",
    resources: [
      "event",
      "assignment",
      "recruit",
      "staff",
      /*
        근로계약서가 여기 있는 이유.

        예전에는 '밖으로 나가는 자료'였다. 그런데 지금은 계약서가 시스템 밖으로
        나가지 않는다. 담당자가 내려받아 종이로 배부하고 서명본을 올린다.
        `send` 열이 있는 갈래에 두면 계약서 줄만 그 칸이 비어, 켤 수 없는 권한이
        설정 화면에 남는다. 근로자에게 링크가 나가는 서버가 붙는 날 되돌린다.
      */
      "contract",
      "client",
      "admin",
      "role",
    ],
  },
  {
    id: "keep",
    label: "지우지 않는 자료",
    description:
      "받아 두거나 기준이 되는 자료라 삭제가 없습니다. 해제하거나 새로 받습니다.",
    /*
      직원 명부에 삭제가 없는 이유.
      퇴사해도 그 사람이 나간 행사 기록은 남아 있다. 명부에서 지우면
      과거 배치가 이름 없는 줄이 되므로, 퇴사는 지우는 것이 아니라 끄는 것이다.
    */
    resources: ["staffDocument", "blacklist", "employee", "settings"],
  },
  {
    id: "outbound",
    label: "밖으로 나가는 자료",
    description:
      "근로자에게 발송합니다. 나가면 되돌릴 수 없어 '발송'을 따로 뗐습니다.",
    resources: ["message"],
  },
  {
    id: "money",
    label: "돈이 오가는 자료",
    description:
      "지급을 승인하고 지급 완료로 찍습니다. 둘 다 되돌릴 수 없어 따로 뗐습니다.",
    resources: ["payroll"],
  },
  {
    id: "record",
    label: "바꿀 수 없는 자료",
    description: "누가 무엇을 바꿨는지 남긴 기록입니다. 고칠 수 있으면 기록이 아닙니다.",
    resources: ["log"],
  },
] as const satisfies readonly PermissionCategoryDef[];

/** 열을 세울 순서. 되돌리기 쉬운 것부터 어려운 것 순으로 둔다. */
const ACTION_ORDER: readonly PermissionAction[] = [
  "read",
  "write",
  "delete",
  "approve",
  "pay",
  "send",
];

/**
 * 이 갈래의 열.
 *
 * 손으로 적지 않고 **자료에서 뽑는다.** 손으로 적으면 자료에 행위를 하나 더한 날
 * 열이 따라오지 않아, 켤 수 없는 권한이 조용히 생긴다.
 */
export const categoryActions = (
  resources: readonly PermissionResource[],
): PermissionAction[] => {
  const actions = new Set(
    resources.flatMap((resource) => PERMISSION_RESOURCES[resource].actions),
  );

  return ACTION_ORDER.filter((action) => actions.has(action));
};

/**
 * 갈래에 넣지 않은 자료가 있으면 **여기서 타입 오류가 난다.**
 *
 * 자료를 새로 만들고 갈래에 넣는 것을 잊으면, 그 자료는 설정 화면에
 * 아예 나타나지 않는다. 아무도 켤 수 없으니 그 기능은 최고관리자만 쓰게 되고,
 * 화면에서는 "권한을 안 준 것"과 구분되지 않아 한참 뒤에야 발견된다.
 */
type CategorizedResource =
  (typeof PERMISSION_CATEGORIES)[number]["resources"][number];

type MustBeNever<T extends never> = T;

/* 쓰이지 않는 것이 목적이다. 존재하는 것만으로 컴파일 때 검사가 된다. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _EveryResourceHasCategory = MustBeNever<
  Exclude<PermissionResource, CategorizedResource>
>;

export const permissionKey = (
  resource: PermissionResource,
  action: PermissionAction,
): PermissionKey => `${resource}:${action}`;

/** 사람이 읽는 권한 이름. 거부 안내에 그대로 쓴다. (`정산 > 지급 승인`) */
export const permissionLabel = (key: PermissionKey): string => {
  const [resource, action] = key.split(":") as [
    PermissionResource,
    PermissionAction,
  ];

  return `${PERMISSION_RESOURCES[resource]?.label ?? resource} > ${
    PERMISSION_ACTION_LABEL[action] ?? action
  }`;
};

export const ALL_PERMISSIONS: PermissionKey[] = (
  Object.keys(PERMISSION_RESOURCES) as PermissionResource[]
).flatMap((resource) =>
  PERMISSION_RESOURCES[resource].actions.map((action) =>
    permissionKey(resource, action),
  ),
);

/**
 * 권한을 갖고 있는가.
 *
 * `isSuperAdmin`은 목록을 보지 않고 전부 통과시킨다.
 * 최고관리자에게서 권한을 뺄 수 있으면, 실수 한 번으로 **아무도 권한을 되돌릴 수 없는**
 * 상태가 만들어진다. (권한 설정 권한까지 잃는 경우)
 */
export const hasPermission = (
  granted: PermissionKey[] | undefined,
  required: PermissionKey,
  isSuperAdmin = false,
): boolean => {
  if (isSuperAdmin) return true;

  return Boolean(granted?.includes(required));
};

/**
 * `write`는 `read`를 품는다.
 *
 * 고칠 수는 있는데 볼 수는 없는 상태는 뜻이 없다. 화면을 열지 못하면 고칠 수도 없다.
 * 그래서 저장할 때 한 번 정규화해 두고, 판정하는 쪽은 단순 포함 검사만 하게 한다.
 */
export const normalizePermissions = (
  permissions: PermissionKey[],
): PermissionKey[] => {
  const next = new Set(permissions);

  for (const key of permissions) {
    const [resource, action] = key.split(":") as [
      PermissionResource,
      PermissionAction,
    ];

    if (action !== "read") next.add(permissionKey(resource, "read"));
  }

  return ALL_PERMISSIONS.filter((key) => next.has(key));
};

/** 자료 하나에 걸린 권한만 추린다. 설정 화면에서 줄 단위로 쓴다. */
export const permissionsOfResource = (
  permissions: PermissionKey[],
  resource: PermissionResource,
): PermissionAction[] =>
  PERMISSION_RESOURCES[resource].actions.filter((action) =>
    permissions.includes(permissionKey(resource, action)),
  );
