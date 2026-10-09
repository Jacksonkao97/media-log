import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CATEGORIES,
  REGIONS,
  STATUSES,
  WATCHES,
  type Item,
  type ItemFields,
  type Region,
} from "@/lib/schema";
import { Button } from "./ui";

/** What the dialog is open for: a new item in `region`, or editing `item` that lives in `region`. */
export type DialogTarget = { region: Region; item: Item | null };

interface Props {
  target: DialogTarget | null;
  onSave: (fields: ItemFields, region: Region) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ItemDialog({ target, onSave, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (target && !dlg.open) dlg.showModal();
    if (!target && dlg.open) dlg.close();
  }, [target]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="border-line bg-panel text-ink m-auto w-[min(520px,calc(100vw-32px))] rounded-xl border p-0 shadow-[0_18px_50px_rgba(0,0,0,.45)]"
    >
      {target && (
        <DialogForm
          key={target.item?.id ?? "new"}
          target={target}
          onSave={onSave}
          onDelete={onDelete}
          onCancel={onClose}
        />
      )}
    </dialog>
  );
}

function initialFields({ item, region }: DialogTarget): ItemFields {
  return {
    name: item?.name ?? "",
    progress: item?.progress ?? "",
    watch: item?.watch ?? "看着",
    status: item?.status ?? "未完结",
    category: item?.category ?? (region === "欧美" ? "电影" : "动画"),
    url: item?.url ?? "",
    note: item?.note ?? "",
  };
}

const INPUT =
  "w-full rounded-lg border border-line bg-page px-2.5 py-[7px] text-[13px] text-ink focus:border-accent focus:outline-none";

function DialogForm({
  target,
  onSave,
  onDelete,
  onCancel,
}: {
  target: DialogTarget;
  onSave: Props["onSave"];
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(() => initialFields(target));
  const [region, setRegion] = useState<Region>(target.region);
  const set = <K extends keyof ItemFields>(k: K, v: ItemFields[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const name = f.name.trim();
    if (!name) return;
    onSave(
      {
        ...f,
        name,
        progress: f.progress.trim(),
        url: f.url.trim(),
        note: f.note.trim(),
      },
      region,
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-[13px] px-[22px] pt-5 pb-4"
    >
      <h2 className="mb-0.5 text-base font-[650]">
        {target.item ? "编辑条目" : "新增条目"}
      </h2>

      <Field
        label={
          <>
            名称 <b className="text-red">*</b>
          </>
        }
      >
        <input
          className={INPUT}
          required
          autoFocus
          autoComplete="off"
          placeholder="例如：全知读者视角"
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="进度">
          <input
            className={INPUT}
            autoComplete="off"
            placeholder="125 / 第41卷 / 剧场版"
            value={f.progress}
            onChange={(e) => set("progress", e.target.value)}
          />
        </Field>
        <Field label="观看状态">
          <Select
            value={f.watch}
            options={WATCHES}
            onChange={(v) => set("watch", v)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-1">
        <Field label="状态">
          <Select
            value={f.status}
            options={STATUSES}
            onChange={(v) => set("status", v)}
          />
        </Field>
        <Field label="分类">
          <Select
            value={f.category}
            options={CATEGORIES}
            onChange={(v) => set("category", v)}
          />
        </Field>
        <Field label="区域">
          <Select value={region} options={REGIONS} onChange={setRegion} />
        </Field>
      </div>

      <Field label="链接">
        <input
          className={INPUT}
          type="url"
          autoComplete="off"
          placeholder="https://…"
          value={f.url}
          onChange={(e) => set("url", e.target.value)}
        />
      </Field>

      <Field label="备注">
        <textarea
          className={`${INPUT} resize-y`}
          rows={2}
          placeholder="正常更新 / 停更2年了 / 无望第二季…"
          value={f.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </Field>

      <footer className="border-line-soft mt-1 flex items-center gap-2 border-t pt-[13px]">
        {target.item && (
          <Button variant="danger" onClick={onDelete}>
            删除
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" type="submit">
          保存
        </Button>
      </footer>
    </form>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-ink-dim text-xs">{label}</span>
      {children}
    </label>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      className={INPUT}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}
