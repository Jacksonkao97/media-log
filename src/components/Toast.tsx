import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";

export interface ToastOptions {
  error?: boolean;
  /** e.g. 撤销 after a delete or a +1. Keeps the toast up longer. */
  action?: { label: string; run: () => void };
}

type Msg = ToastOptions & { text: string; id: number };

/** Returns [element, show]. */
export function useToast() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string, opts: ToastOptions = {}) => {
    clearTimeout(timer.current);
    setMsg({ text, ...opts, id: Date.now() });
    timer.current = setTimeout(
      () => setMsg(null),
      opts.error || opts.action ? 5000 : 2200,
    );
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const node = msg && (
    <div
      key={msg.id}
      role={msg.error ? "alert" : "status"}
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-60 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-4 rounded-xl px-4 py-3 text-sm shadow-xl transition duration-200 max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] starting:translate-y-2 starting:opacity-0 ${
        msg.error ? "bg-red text-page" : "bg-ink text-page"
      }`}
    >
      <span>{msg.text}</span>
      {msg.action && (
        <button
          type="button"
          onClick={() => {
            clearTimeout(timer.current);
            setMsg(null);
            msg.action!.run();
          }}
          className="-my-1.5 -mr-2 inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 font-semibold whitespace-nowrap hover:bg-current/15 max-md:h-10"
        >
          <Undo2 aria-hidden className="size-4" />
          {msg.action.label}
        </button>
      )}
    </div>
  );

  return [node, show] as const;
}
