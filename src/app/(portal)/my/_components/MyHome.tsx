"use client";

import Link from "next/link";
import { useMySummaryQuery } from "@/api/my/getMySchedule";
import { ChevronRight, Wallet } from "@/icons";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MyTodo } from "@/type/my";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import MyWorkCard from "../../_components/MyWorkCard";

/** 할 일 한 줄의 색. 지금 막혀 있는 것이 가장 붉다. */
const TODO_CLASS: Record<MyTodo["tone"], string> = {
  danger: "border-danger/40 bg-danger-bg",
  warning: "border-warning/40 bg-warning-bg",
  info: "border-border-main bg-subtle",
};

const TODO_TITLE_CLASS: Record<MyTodo["tone"], string> = {
  danger: "text-danger",
  warning: "text-warning",
  info: "text-font-1",
};

/**
 * 포털 첫 화면.
 *
 * 답해야 하는 질문은 두 개다. **"다음에 언제 어디로 가나"**와
 * **"지금 내가 해야 할 일이 있나"**. 그 둘을 위에 두고 나머지는 아래로 내린다.
 *
 * 할 일이 없을 때 빈 칸을 남기지 않는다. 아무것도 안 해도 되는 상태라는 것
 * 자체가 알려 줘야 하는 정보다.
 */
const MyHome = () => {
  const { data, isLoading } = useMySummaryQuery();

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    );
  }

  const { nextWork, todos, monthWorkCount, monthNetPay } = data;

  return (
    <>
      {todos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-medium text-font-2">할 일</h2>

          {todos.map((todo) => (
            <Link
              key={todo.type}
              href={todo.href}
              className={cn(
                "flex items-center gap-3 rounded-card border px-4 py-3 transition active:scale-[0.99]",
                TODO_CLASS[todo.tone],
              )}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[14px] font-semibold",
                    TODO_TITLE_CLASS[todo.tone],
                  )}
                >
                  {todo.title}
                </span>
                <span className="mt-0.5 block text-[12px] text-font-2">
                  {todo.description}
                </span>
              </span>

              <ChevronRight size={16} />
            </Link>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-medium text-font-2">다음 근무</h2>

        {nextWork ? (
          <MyWorkCard work={nextWork} isUpcoming />
        ) : (
          <Card>
            <EmptyState
              title="예정된 근무가 없습니다."
              description="공고에서 원하는 자리에 지원해 보세요."
            />
          </Card>
        )}
      </section>

      {/*
        정산은 탭이 없다. 다섯 칸을 넘길 수 없어서 홈의 이 카드와 내 정보가
        들어가는 길이다. 이번 달 숫자를 여기 먼저 보여 주는 이유이기도 하다.
      */}
      <Link href="/my/payroll" className="block">
        <Card className="transition hover:bg-surface-hover">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-field bg-brand-opacity text-brand">
              <Wallet size={20} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-font-2">이번 달 예상 지급액</p>
              <p className="text-[20px] font-bold text-font-0 tabular-nums">
                {formatCurrency(monthNetPay)}
              </p>
              <p className="text-[12px] text-font-2">
                {/* 세후 금액이라는 것을 적어 둔다. 안 적으면 덜 들어왔다고 여긴다. */}
                근무 {monthWorkCount}일 · 원천징수를 뺀 실지급액입니다
              </p>
            </div>

            <ChevronRight size={16} />
          </div>
        </Card>
      </Link>
    </>
  );
};

export default MyHome;
