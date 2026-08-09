import { ReactNode } from "react";
import Image from "next/image";
import { Star } from "@/icons";
import { formatPhoneNumber } from "@/type/staff";
import { TableCellStack } from "@/components/ui/Table";
import FavoriteToggle from "./FavoriteToggle";

interface StaffCellProps {
  name: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  /** 즐겨찾기면 이름 옆에 별을 붙인다. */
  isFavorite?: boolean;
  /**
   * 넘기면 이름 옆의 별이 **눌러서 바꿀 수 있는 토글**이 된다.
   *
   * 즐겨찾기는 목록을 훑다가 "얘 괜찮았지" 하고 바로 찍는 동작이다.
   * 상세를 열어야만 바꿀 수 있으면 실제로는 아무도 채우지 않는다.
   * 다만 배치 후보 고르기처럼 지금 할 일이 따로 있는 화면에서는
   * 표시만 하는 편이 낫기 때문에, 토글 여부를 부르는 쪽이 정한다.
   */
  staffId?: number;
  /** 연락처 대신 다른 보조 정보를 보여 줄 때 사용한다. */
  secondary?: string;
  /**
   * 이름 바로 옆에 붙는 배지.
   *
   * 직무처럼 "이 사람이 여기서 무엇을 하는가"를 나타내는 값은 이름에 붙어야 읽힌다.
   * 따로 떨어진 칸에 두면 이름과 직무를 눈으로 다시 이어 붙여야 한다.
   */
  badge?: ReactNode;
}

/** 표 안에서 인력 한 명을 보여 주는 공통 셀. */
const StaffCell = ({
  name,
  phoneNumber,
  profileImageUrl,
  isFavorite = false,
  staffId,
  secondary,
  badge,
}: StaffCellProps) => {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-subtle">
        {profileImageUrl && (
          <Image
            src={profileImageUrl}
            alt=""
            fill
            sizes="36px"
            className="object-cover"
            unoptimized
          />
        )}
      </div>

      <div className="min-w-0">
        <TableCellStack
          primary={
            <span className="flex items-center gap-1.5">
              {name}

              {staffId !== undefined ? (
                <FavoriteToggle
                  staffId={staffId}
                  isFavorite={isFavorite}
                  size={14}
                  className="-my-1"
                />
              ) : (
                isFavorite && (
                  <Star
                    size={13}
                    fill="currentColor"
                    className="shrink-0 text-warning"
                  />
                )
              )}

              {badge}
            </span>
          }
          secondary={
            <span className="tabular-nums">
              {secondary ?? formatPhoneNumber(phoneNumber)}
            </span>
          }
        />
      </div>
    </div>
  );
};

export default StaffCell;
