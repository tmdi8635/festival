"use client";

import { useEffect, useRef } from "react";
import { useMyAttendanceMutation } from "@/api/my/mutateMyAttendance";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Clock, MapPin, Phone, Warning } from "@/icons";
import { showErrorToast } from "@/lib/toast";
import { useAttendanceSettings } from "@/store/useOrgStore";
import {
  applyCheckTimeRule,
  describeCheckTimeRule,
  formatDistance,
  calculateDistanceMeters,
  toCheckDateTime,
  toTimeInput,
} from "@/type/event";
import type { MyWork } from "@/type/my";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";

interface CheckTimeModalProps {
  work: MyWork;
  side: "IN" | "OUT";
  onClose: () => void;
}

/**
 * 출퇴근을 찍기 전에 **무엇이 기록될지 먼저 보여 준다.**
 *
 * 07:10에 눌렀는데 08:00으로 들어가는 것은 규칙상 맞는 동작이지만, 알리지 않으면
 * 본인에게는 시스템이 시간을 빼앗은 것으로 보인다. 그 오해는 담당자에게 전화로 온다.
 * 그래서 **누르기 전에** 기록될 시각과 그 이유를 같은 화면에 세운다.
 *
 * 위치도 여기서 확인한다. 화면을 열자마자 묻지 않고 이 모달에서 묻는 이유는,
 * 맥락 없이 뜬 권한 창은 대부분 반사적으로 거부되고 한 번 거부되면
 * 설정에서 직접 되돌리기 전까지 다시 물어볼 수 없기 때문이다.
 */
const CheckTimeModal = ({ work, side, onClose }: CheckTimeModalProps) => {
  const attendance = useAttendanceSettings();
  const { position, error, isLoading, request } = useGeolocation();
  const { checkInMutation, checkOutMutation } = useMyAttendanceMutation();

  const isCheckIn = side === "IN";
  const label = isCheckIn ? "출근" : "퇴근";
  const rule = isCheckIn ? attendance.checkIn : attendance.checkOut;
  const mutation = isCheckIn ? checkInMutation : checkOutMutation;

  /* 좌표가 없는 행사는 위치를 확인하지 않는다. 서버도 같은 규칙으로 판정한다. */
  const needsLocation =
    typeof work.venueLatitude === "number" &&
    typeof work.venueLongitude === "number" &&
    attendance.checkInRadiusMeters > 0;

  /*
    모달이 열리면 곧바로 위치를 묻는다.

    "이미 물었나"를 state가 아니라 ref로 센다. effect 안에서 setState를 하면
    React Compiler 린트에 걸리고(가이드 7장), 여기서 필요한 것은 다시 그리는 일이
    아니라 **두 번 묻지 않는 것**뿐이다. (StrictMode는 effect를 두 번 돌린다)
  */
  const hasAsked = useRef(false);

  useEffect(() => {
    if (!needsLocation || hasAsked.current) return;

    hasAsked.current = true;
    void request();
  }, [needsLocation, request]);

  /** 지금 누르면 몇 시로 들어가는지. 서버와 같은 함수로 낸다. */
  const now = new Date().toISOString();
  const scheduled = isCheckIn
    ? toCheckDateTime(work.workDate, work.startTime)
    : toCheckDateTime(work.workDate, work.endTime, work.endDayOffset);

  const recordedAt = applyCheckTimeRule(now, scheduled ?? now, rule, side);
  const isAdjusted = toTimeInput(recordedAt) !== toTimeInput(now);

  const distanceMeters =
    position && needsLocation
      ? calculateDistanceMeters(
          position.latitude,
          position.longitude,
          work.venueLatitude!,
          work.venueLongitude!,
        )
      : undefined;

  const isTooFar =
    distanceMeters !== undefined &&
    distanceMeters > attendance.checkInRadiusMeters;

  const isReady = !needsLocation || (Boolean(position) && !isTooFar);

  const handleSubmit = () => {
    mutation.mutate(
      {
        assignmentId: work.assignmentId,
        latitude: position?.latitude,
        longitude: position?.longitude,
      },
      {
        onSuccess: onClose,
        onError: (submitError) => showErrorToast(submitError),
      },
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${label} 기록`}
      description={`${work.eventTitle} · ${work.positionName}`}
      size="sm"
      footer={
        /*
          flex가 아니라 grid다.

          `Button`은 `shrink-0`이라 flex 안에서 줄어들지 못한다. 폭이 좁은 폰에서
          `fullWidth` 두 개를 나란히 두면 각자 100%를 차지해 뒤 버튼이
          화면 밖으로 밀려난다. 반씩 나누는 일은 grid가 해야 한다.
        */
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button
            fullWidth
            disabled={!isReady || mutation.isPending}
            isLoading={mutation.isPending}
            onClick={handleSubmit}
          >
            {label} 기록
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 기록될 시각. 이 모달의 본론이라 맨 위에 크게 둔다. */}
        <div className="flex flex-col items-center gap-1 rounded-card bg-subtle px-4 py-5">
          <span className="flex items-center gap-1.5 text-[13px] text-font-2">
            <Clock size={14} />
            지금 {toTimeInput(now)}
          </span>
          <span className="text-[30px] font-bold text-font-0 tabular-nums">
            {toTimeInput(recordedAt)}
          </span>
          <span className="text-[13px] text-font-1">{label}으로 기록됩니다</span>
        </div>

        {/*
          찍는 시각과 기록되는 시각이 다를 때만 이유를 세운다.
          같은데도 매번 규칙 설명이 뜨면 다음부터는 아무도 읽지 않는다.
        */}
        {isAdjusted && (
          <Alert tone="info" title="기록 규칙이 적용되었습니다.">
            {describeCheckTimeRule(rule, side)}
          </Alert>
        )}

        {needsLocation && (
          <div className="flex flex-col gap-2">
            {isLoading && (
              <p className="flex items-center gap-2 text-[13px] text-font-2">
                <Spinner size={14} />
                위치를 확인하고 있습니다…
              </p>
            )}

            {position && !isTooFar && (
              <p className="flex items-center gap-1.5 text-[13px] text-success">
                <MapPin size={14} />
                현장 확인됨
                {distanceMeters !== undefined &&
                  ` (약 ${formatDistance(distanceMeters)})`}
              </p>
            )}

            {isTooFar && distanceMeters !== undefined && (
              <Alert tone="danger" title="현장에서 너무 멀리 있습니다.">
                지금 위치가 현장에서 {formatDistance(distanceMeters)} 떨어져
                있습니다. {attendance.checkInRadiusMeters}m 안에서 찍어 주세요.
              </Alert>
            )}

            {error && (
              <Alert tone="danger" title="위치를 확인할 수 없습니다.">
                {error.message}
              </Alert>
            )}

            {(error || isTooFar) && (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" fullWidth onClick={() => request()}>
                  다시 시도
                </Button>

                {/*
                  막다른 길을 만들지 않는다.

                  권한이 꺼진 폰은 설정을 고치기 전까지 영영 못 찍는데, 그 사람은
                  이미 현장에 서 있다. 관리자가 대신 기록해 주는 길이 원래 있으므로
                  그리로 바로 연결한다.
                */}
                {work.managerPhone && (
                  <a
                    href={`tel:${work.managerPhone}`}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-field border border-border-main text-[14px] text-font-1 transition active:scale-[0.98]"
                  >
                    <Phone size={15} />
                    담당자 {work.managerName}에게 전화
                  </a>
                )}

                <p className="flex items-start gap-1.5 text-[12px] text-font-2">
                  <Warning size={13} className="mt-0.5 shrink-0" />
                  담당자가 대신 기록해 드릴 수 있습니다.
                </p>
              </div>
            )}
          </div>
        )}

        {!needsLocation && (
          <p className="text-[12px] text-font-2">
            이 행사는 현장 좌표가 등록되어 있지 않아 위치를 확인하지 않습니다.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default CheckTimeModal;
