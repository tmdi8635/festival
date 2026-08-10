import { GenderFemale, GenderMale } from "@/icons";
import { cn } from "@/lib/utils";
import { GENDER_LABEL, type Gender } from "@/type/staff";

interface GenderMarkProps {
  gender?: Gender;
  size?: number;
  className?: string;
}

/**
 * 이름 옆에 붙는 성별 표시. **성별을 그리는 자리는 여기 하나다.**
 *
 * 행사에는 성별 조건이 걸리는 자리가 있다. (컨퍼런스 안내는 여성만,
 * 설치 · 철거는 남성만) 조건이 있든 없든 사람을 고르는 순간 반드시 보게 되는
 * 값이라, 상세를 열어야 알 수 있으면 담당자는 결국 이름으로 짐작하게 된다.
 *
 * 다만 **곁가지다.** 이름 · 연락처 · 직무를 밀어내면 안 되므로 글자가 아니라
 * 작은 아이콘 하나로 둔다. 색은 판단 신호가 아니므로 상태 색(`danger` ·
 * `success`)을 쓰지 않는다. 성별은 좋고 나쁨이 없다.
 *
 * 읽어 주는 라벨은 한 글자가 아니라 `남성` · `여성` 전체다.
 * 화면에서 아이콘으로 줄인 것이지 뜻을 줄인 것이 아니다.
 */
const GenderMark = ({ gender, size = 13, className }: GenderMarkProps) => {
  if (!gender) return null;

  const Icon = gender === "MALE" ? GenderMale : GenderFemale;

  return (
    <Icon
      size={size}
      role="img"
      aria-label={GENDER_LABEL[gender]}
      className={cn(
        "shrink-0",
        gender === "MALE" ? "text-info" : "text-brand",
        className,
      )}
    />
  );
};

export default GenderMark;
