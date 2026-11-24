export function Skeleton({ height = 240 }: { height?: number }) {
  return <div class="skeleton" style={{ height: `${height}px`, width: '100%' }} />;
}

export function CardRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div class="shelf-row">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} class="skeleton" style={{ aspectRatio: '2 / 3' }} />
      ))}
    </div>
  );
}
