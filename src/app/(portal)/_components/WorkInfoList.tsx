import type { ReactNode } from "react";
import {
  Clock,
  Coin,
  Flag,
  Info,
  MapPin,
  Package,
  Phone,
  UserCheck,
} from "@/icons";
import { formatCurrency } from "@/lib/utils";
import {
  WAGE_TYPE_LABEL,
  formatTimeRange,
  type DayOffset,
  type WageType,
} from "@/type/event";
import { formatPhoneNumber } from "@/type/staff";

/**
 * 근무 한 자리를 설명하는 데 필요한 값. 확정된 근무(`MyWork`)와
 * 지원(`MyApplication`)이 **같은 모양**으로 갖고 있다.
 */
export interface WorkInfo {
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  breakMinutes: number;
  wageType: WageType;
  wage: number;
  venue: string;
  address: string;
  meetingPoint: string;
  description: string;
  dressCode: string;
  belongings: string;
  managerName: string;
  managerPhone: string;
}

interface WorkInfoListProps {
  info: WorkInfo;
  /** 날짜 표기. 하루면 `09.12 (금)`, 여러 날이면 `09.12 외 2일` */
  dateLabel: string;
  /** 단가 옆에 붙는 금액 설명. (`하루 48,000원 · 3일 예상 144,000원`) */
  payNote?: string;
}

/**
 * 근무 조건 목록. **확정 · 신청 · 종료 어느 탭에서나 같은 줄을 같은 순서로 세운다.**
 *
 * 예전에는 탭마다 보여 주는 칸이 달랐다. 신청 탭에는 날짜 · 장소만, 종료 탭에는
 * 복장 · 담당자가 빠져 있어서, 무엇에 지원했는지 · 그날 얼마를 받기로 했는지를
 * 보려면 상세를 다시 열어야 했다. 조건은 확정 여부와 상관없이 같은 조건이다.
 *
 * 줄 순서는 **결정에 쓰이는 순서**다 — 언제 · 얼마 · 어디 · 어디로 모이나 · 무엇을 입고 챙기나 · 누구에게 거나.
 */
const WorkInfoList = ({ info, dateLabel, payNote }: WorkInfoListProps) => (
  <dl className="flex flex-col gap-2 text-[13px]">
    <InfoRow icon={<Clock size={15} />} label="근무 시간">
      {dateLabel}{" "}
      <span className="tabular-nums">
        {formatTimeRange(info.startTime, info.endTime, info.endDayOffset)}
      </span>
      {info.breakMinutes > 0 && (
        <span className="text-font-2"> · 휴게 {info.breakMinutes}분</span>
      )}
    </InfoRow>

    {/*
      단가는 **시급인지 일급인지와 함께** 적는다. 11,000원만 적으면 하루치인지
      시간당인지 알 수 없다. 공고에서 보고 지원한 그 숫자가 여기서도 보여야 한다.
    */}
    <InfoRow icon={<Coin size={15} />} label="지급 기준">
      <span className="font-medium text-font-0 tabular-nums">
        {WAGE_TYPE_LABEL[info.wageType]} {formatCurrency(info.wage)}
      </span>
      {payNote && (
        <span className="text-font-2 tabular-nums"> · {payNote}</span>
      )}
    </InfoRow>

    <InfoRow icon={<MapPin size={15} />} label="장소">
      {info.venue || "-"}
      {info.address && (
        <span className="block text-[12px] text-font-2">{info.address}</span>
      )}
    </InfoRow>

    {/*
      집합 장소는 **자기 줄**을 갖는다. 행사장 주소와 다른 곳(후문 · 지하 주차장 ·
      스태프 텐트)인 경우가 흔한데, 장소 칸 밑에 붙여 두면 주소의 부연으로 읽혀서
      정작 모이는 곳을 지나친다. 아이콘만으로는 뜻이 약해 라벨을 함께 적는다.
    */}
    {info.meetingPoint && (
      <InfoRow icon={<Flag size={15} />} label="집합">
        <span className="mr-1.5 font-medium text-brand">집합</span>
        {info.meetingPoint}
      </InfoRow>
    )}

    {info.dressCode && (
      <InfoRow icon={<UserCheck size={15} />} label="복장">
        {info.dressCode}
      </InfoRow>
    )}

    {info.belongings && (
      <InfoRow icon={<Package size={15} />} label="준비물">
        {info.belongings}
      </InfoRow>
    )}

    {/* 업체가 적은 현장 안내. 칸이 정해진 것 말고 그 현장에만 해당하는 당부다. */}
    {info.description && (
      <InfoRow icon={<Info size={15} />} label="현장 안내">
        <span className="whitespace-pre-line text-font-2">
          {info.description}
        </span>
      </InfoRow>
    )}

    {info.managerPhone && (
      <InfoRow icon={<Phone size={15} />} label="담당자">
        {/*
          전화번호는 **눌러서 걸 수 있어야 한다.** 현장을 못 찾는 사람이 번호를
          옮겨 적을 상황이 아니다. `-my-2`로 글줄 간격은 두고 누르는 영역만 넓힌다.
        */}
        <a
          href={`tel:${info.managerPhone}`}
          className="-my-2 inline-flex min-h-10 items-center text-brand underline underline-offset-2"
        >
          {info.managerName} {formatPhoneNumber(info.managerPhone)}
        </a>
      </InfoRow>
    )}
  </dl>
);

interface InfoRowProps {
  icon: ReactNode;
  /** 화면에는 아이콘만 보인다. 읽어 주는 기기를 위한 이름이다 */
  label: string;
  children: ReactNode;
}

const InfoRow = ({ icon, label, children }: InfoRowProps) => (
  <div className="flex items-start gap-2">
    <dt className="mt-0.5 shrink-0 text-font-disabled">
      {icon}
      <span className="sr-only">{label}</span>
    </dt>
    <dd className="min-w-0 break-words text-font-1">{children}</dd>
  </div>
);

export default WorkInfoList;
