import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: number;
  className?: string;
}

const Spinner = ({ size = 16, className }: SpinnerProps) => {
  return (
    <span
      role="status"
      aria-label="로딩 중"
      style={{ width: size, height: size }}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
};

export default Spinner;
