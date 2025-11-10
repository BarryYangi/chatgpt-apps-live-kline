import { CSSProperties } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}

export default function Skeleton({
  width = "100%",
  height = 100,
  className = "",
  style,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded-lg ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}

