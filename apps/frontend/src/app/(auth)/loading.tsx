// Route-level loading boundary for the whole (auth) group.
// This skeleton reserves space for a centered form and prevents layout shift
// during client-side navigation.
export default function AuthLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="space-y-4">
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        <div className="h-4 w-56 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}