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
