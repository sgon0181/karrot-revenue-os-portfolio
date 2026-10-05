export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Loading workspace" role="status">
      <div className="mb-5 border-b border-[#d8e3de] pb-5">
        <div className="h-3 w-36 animate-pulse rounded bg-[#cfe5da]" />
        <div className="mt-3 h-8 w-56 animate-pulse rounded bg-[#dce6e1]" />
        <div className="mt-2 h-4 max-w-xl animate-pulse rounded bg-[#e5ece8]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card h-24 animate-pulse bg-white p-4">
            <div className="h-3 w-24 rounded bg-[#dce6e1]" />
            <div className="mt-4 h-6 w-16 rounded bg-[#cfe5da]" />
          </div>
        ))}
      </div>
      <div className="card mt-5 overflow-hidden">
        <div className="h-14 animate-pulse border-b border-[#d7eee3] bg-[#e7faf2]" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-[6px] bg-[#f1f5f3]" />)}
        </div>
      </div>
      <span className="sr-only">Loading data from the workspace</span>
    </div>
  );
}
