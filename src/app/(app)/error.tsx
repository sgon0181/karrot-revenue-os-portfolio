"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TriangleAlert, WifiOff } from "lucide-react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <section className="card mx-auto mt-10 max-w-xl overflow-hidden" role="alert">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#fff0f1] text-[#d73b4b]">{online ? <TriangleAlert className="size-[18px]" /> : <WifiOff className="size-[18px]" />}</span>
          <div><h1 className="text-base font-semibold text-[#244136]">{online ? "Workspace data could not load" : "You appear to be offline"}</h1><p className="mt-0.5 text-xs text-[#64726c]">Your current page and filters are safe.</p></div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm leading-6 text-[#52635b]">{online ? "The data service returned an unexpected response. Retry the request; if it repeats, check the Supabase connection and source-import health." : "Reconnect to the internet, then retry. No changes have been submitted from this screen."}</p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-[#64726c]">Reference {error.digest}</p> : null}
        <button type="button" onClick={retry} className="button-primary mt-5"><RefreshCw className="size-4" /> Retry</button>
      </div>
    </section>
  );
}
