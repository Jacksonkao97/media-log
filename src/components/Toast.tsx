import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { text: string; error: boolean; id: number };

/** Returns [element, show]. Errors stay up longer than confirmations. */
export function useToast() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string, error = false) => {
    clearTimeout(timer.current);
    setMsg({ text, error, id: Date.now() });
    timer.current = setTimeout(() => setMsg(null), error ? 5000 : 2200);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const node = msg && (
    <div
      key={msg.id}
      role={msg.error ? "alert" : "status"}
      className={`bg-raised fixed bottom-5 left-1/2 z-60 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg border px-4 py-[9px] text-[13px] shadow-[0_8px_26px_rgba(0,0,0,.4)] ${
        msg.error ? "border-red text-red" : "border-line"
      }`}
    >
      {msg.text}
    </div>
  );

  return [node, show] as const;
}
