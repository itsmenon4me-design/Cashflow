// Route-level loading boundary for the whole (error) group.
// This skeleton reserves space for an error message and prevents layout shift
// during client-side navigation.
export default function ErrorLoading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}