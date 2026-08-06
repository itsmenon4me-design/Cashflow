interface SparklineProps {
  data: number[];
}

export function Sparkline({ data }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / (max - min || 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-10 w-full" aria-hidden="true">
      <polyline
        fill="none"
        stroke="var(--primary)"
        strokeWidth="4"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
