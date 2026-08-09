import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className }: SkeletonProps) => {
  return <span className={cn("skeleton block rounded-[6px]", className)} />;
};

export default Skeleton;
