import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 스크린리더용 라벨 */
  label: string;
  disabled?: boolean;
  className?: string;
}

const Switch = ({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: SwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        /*
          보이는 크기는 24px 그대로 두고 **누를 수 있는 영역만** 위아래로 넓힌다.
          손가락으로 누르는 화면에서 24px는 실제로 빗나가는데, 스위치를 키우면
          표 안에서 혼자 커 보인다. 모양과 히트 영역을 갈라 둔다.
        */
        "before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-['']",
        checked ? "bg-brand" : "bg-border-strong",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-[18px] rounded-full bg-white shadow-card transition",
          checked ? "translate-x-[23px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
};

export default Switch;
