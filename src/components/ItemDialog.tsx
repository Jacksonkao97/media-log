import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Trash2, X } from "lucide-react";
import {
  CATEGORIES,
  REGIONS,
  STATUSES,
  WATCHES,
  type Item,
  type ItemFields,
  type Region,
} from "@/lib/schema";
import { Button, CATEGORY, IconButton, Segmented } from "./ui";

/** What the dialog is open for: a new item in `region`, or editing `item` that lives in `region`. */
export type DialogTarget = { region: Region; item: Item | null };

interface Props {
  target: DialogTarget | null;
  onSave: (fields: ItemFields, region: Region) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Centred modal on desktop, bottom sheet on phones. */
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
      aria-labelledby="dlg-title"
      className="border-line bg-panel text-ink m-auto max-h-[min(90dvh,760px)] w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-2xl border p-0 shadow-2xl transition-[opacity,translate,scale] duration-200 ease-out max-md:mx-0 max-md:mt-auto max-md:mb-0 max-md:max-h-[92dvh] max-md:w-full max-md:max-w-full max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 starting:scale-[.98] starting:opacity-0 max-md:starting:translate-y-8 max-md:starting:scale-100"
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

// 16px text on phones: iOS Safari zooms the page into any smaller input on focus.
const INPUT =
  "border-line bg-page text-ink placeholder:text-ink-faint focus:border-accent focus:ring-accent/25 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 max-md:text-base";

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
  const editing = Boolean(target.item);

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
    <form onSubmit={submit} className="flex max-h-[inherit] flex-col">
      <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 max-md:px-4">
        {/* Grab handle: a visual cue that this is a sheet. */}
        <span
          aria-hidden
          className="bg-line absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full md:hidden"
        />
        <h2 id="dlg-title" className="text-lg font-semibold">
          {editing ? "编辑作品" : "新增作品"}
        </h2>
        <IconButton
          icon={X}
          label="关闭"
          onClick={onCancel}
          className="-mr-2"
        />
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-5 max-md:px-4">
        <Field label="名称" required>
          <input
            className={`${INPUT} h-10 max-md:h-11`}
            required
            autoFocus={!editing}
            autoComplete="off"
            placeholder="例如：全知读者视角"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-4 max-md:grid-cols-1">
          <Field
            label="进度"
            hint="写成「125」「第41卷」都行，列表里的 +1 会加第一个数字"
          >
            <input
              className={`${INPUT} h-10 max-md:h-11`}
              autoComplete="off"
              placeholder="125 / 第41卷 / 剧场版"
              value={f.progress}
              onChange={(e) => set("progress", e.target.value)}
            />
          </Field>
          <Field label="观看状态" group>
            <Segmented
              label="观看状态"
              name="watch"
              value={f.watch}
              options={WATCHES}
              onChange={(v) => set("watch", v)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Field label="分类" group>
            <Segmented
              label="分类"
              name="category"
              value={f.category}
              options={CATEGORIES}
              onChange={(v) => set("category", v)}
              render={(c) => {
                const Icon = CATEGORY[c].icon;
                return (
                  <>
                    <Icon aria-hidden className="size-3.5" />
                    {c}
                  </>
                );
              }}
            />
          </Field>
          <Field label="状态" group>
            <Segmented
              label="状态"
              name="status"
              value={f.status}
              options={STATUSES}
              onChange={(v) => set("status", v)}
            />
          </Field>
        </div>

        <Field
          label="区域"
          group
          hint={
            editing && region !== target.region
              ? `保存后会从「${target.region}」移到「${region}」`
              : undefined
          }
        >
          <Segmented
            label="区域"
            name="region"
            value={region}
            options={REGIONS}
            onChange={setRegion}
          />
        </Field>

        <Field label="链接">
          <input
            className={`${INPUT} h-10 max-md:h-11`}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={f.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </Field>

        <Field label="备注">
          <textarea
            className={`${INPUT} resize-y py-2`}
            rows={2}
            placeholder="正常更新 / 停更2年了 / 无望第二季…"
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>

      <footer className="border-line flex items-center gap-2 border-t px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:px-4">
        {editing && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={onDelete}
            className="-ml-2"
          >
            删除
          </Button>
        )}
        <div className="flex-1" />
        <Button onClick={onCancel}>取消</Button>
        <Button variant="primary" type="submit" className="min-w-20">
          保存
        </Button>
      </footer>
    </form>
  );
}

/** A labelled form row. `group` renders a fieldset/legend for radio groups. */
function Field({
  label,
  required,
  hint,
  group,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  group?: boolean;
  children: ReactNode;
}) {
  const caption = (
    <>
      {label}
      {required && <span className="text-red ml-0.5">*</span>}
    </>
  );
  const help = hint && <span className="text-ink-faint text-xs">{hint}</span>;

  if (group) {
    return (
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="text-ink-dim mb-1.5 text-[13px] font-medium">
          {caption}
        </legend>
        {children}
        {help}
      </fieldset>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink-dim text-[13px] font-medium">{caption}</span>
      {children}
      {help}
    </label>
  );
}
