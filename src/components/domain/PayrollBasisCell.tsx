import { WAGE_TYPE_LABEL } from "@/type/event";
import type { PayrollItem } from "@/type/payroll";
import { formatCurrency } from "@/lib/utils";
import Badge from "@/components/ui/Badge";

interface PayrollBasisCellProps {
  item: PayrollItem;
}

/**
 * 지급액이 어떻게 나온 금액인지 한 칸에 적는다.
 *
 * 정산 한 건이 행사 전체(여러 날)를 덮게 되면서, 숫자만 보고는
 * 무엇에 무엇을 곱한 금액인지 알 수 없게 됐다. 근거 식을 그대로 보여 준다.
 *
 * - 시급: `12,000 × 24h` — 모든 근무일의 **실제 출퇴근**을 더한 시간이다.
 * - 일급: `130,000 × 3일` — 시간은 곱하지 않는다. 며칠 나왔는지만 곱한다.
 *
 * 그 아래에는 **문제가 있을 때만** 한 줄을 더 적는다.
 * 출퇴근이 하루라도 비어 있으면 그날은 행사 예정 시간으로 계산된 값이라,
 * 나중에 금액이 바뀐다. 승인 전에 반드시 알아야 하는 사실이다.
 * 정상인 건에는 아무것도 적지 않는다 — 모든 줄에 붙는 표시는 아무것도 알려 주지 않는다.
 */
const PayrollBasisCell = ({ item }: PayrollBasisCellProps) => {
  const isDaily = item.wageType === "DAILY";

  /** 예정 시간과 실제가 얼마나 벌어졌는지. 시급 건에서만 뜻이 있다. */
  const diff =
    Math.round((item.totalWorkHours - item.scheduledWorkHours) * 10) / 10;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[13px] text-font-2 tabular-nums">
        {WAGE_TYPE_LABEL[item.wageType]} {formatCurrency(item.wage)} ×{" "}
        {isDaily ? `${item.workDates.length}일` : `${item.totalWorkHours}h`}
      </span>

      {item.provisionalDayCount > 0 ? (
        <Badge
          tone="warning"
          title="출퇴근이 기록되지 않은 근무일은 행사 예정 시간으로 계산했습니다. 기록하면 금액이 자동으로 다시 계산됩니다."
        >
          {item.provisionalDayCount === item.workDates.length
            ? "예정 기준"
            : `${item.workDates.length}일 중 ${item.provisionalDayCount}일 예정`}
        </Badge>
      ) : (
        /*
          출퇴근이 다 찍힌 건에는 아무 배지도 달지 않는다.

          예전에는 '실제 출퇴근' 배지를 띄웠는데, 정산 목록에 올라왔다는 것 자체가
          이미 출퇴근 명부에 기록됐다는 뜻이다. 모든 정상 건에 같은 배지가 붙으면
          아무것도 구분해 주지 못하고, 정말 봐야 할 '예정 기준' 경고만 묻힌다.
          예정 대비 시간이 벌어진 건만 그 차이를 적는다.
        */
        !isDaily &&
        diff !== 0 && (
          <span
            className={
              diff > 0
                ? "text-[11px] text-success tabular-nums"
                : "text-[11px] text-danger tabular-nums"
            }
          >
            예정 {item.scheduledWorkHours}h 대비 {diff > 0 ? "+" : ""}
            {diff}h
          </span>
        )
      )}
    </div>
  );
};

export default PayrollBasisCell;
