"use client";

/* The add/edit form. Desktop: a centred shadcn Dialog. Phone: a vaul Drawer
 * (bottom sheet you can swipe down to dismiss). Both render the same form. */

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  REGIONS,
  STATUSES,
  WATCHES,
  type Item,
  type ItemFields,
  type Region,
} from "@/lib/schema";
import { useT } from "./locale";
import { CATEGORY } from "./media";
import { Segmented } from "./Segmented";

/** What the dialog is for: a new item in `region`, or editing `item` that lives in `region`. */
export type DialogTarget = {
  region: Region;
  item: Item | null;
  /** For a new item: fields to start with (from a share or shortcut). */
  prefill?: Partial<ItemFields>;
};

interface Props {
  /** Kept after closing, so the closing animation still shows the form. */
  target: DialogTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (fields: ItemFields, region: Region) => void;
  onDelete: () => void;
}

export function ItemDialog({
  target,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: Props) {
  const isMobile = useIsMobile();
  const t = useT();
  if (!target) return null;

  const title = target.item ? t.editWork : t.addWork;
  const description = target.item
    ? t.editDesc(target.item.name)
    : t.addDesc(t.region[target.region]);
  // The form remounts on every open (Radix unmounts closed content), so its
  // state always starts from the current target.
  const form = (
    <EditorForm
      key={target.item?.id ?? "new"}
      target={target}
      autoFocus={!isMobile && !target.item}
      onSave={onSave}
      onDelete={onDelete}
      onCancel={() => onOpenChange(false)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="px-4 pt-3 pb-2 text-left">
            <DrawerTitle className="text-lg">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {description}
            </DrawerDescription>
          </DrawerHeader>
          {form}
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}

function initialFields({ item, region, prefill }: DialogTarget): ItemFields {
  return {
    name: item?.name ?? "",
    progress: item?.progress ?? "",
    watch: item?.watch ?? "看着",
    status: item?.status ?? "未完结",
    category: item?.category ?? (region === "欧美" ? "电影" : "动画"),
    url: item?.url ?? "",
    note: item?.note ?? "",
    // Always sent, "" when empty, so clearing it removes it (tidyItem).
    cast: item?.cast ?? "",
    // The key is always present (undefined when unset) for the same reason:
    // updateItem spreads these over the old item.
    year: item?.year,
    ...(item ? {} : prefill),
  };
}

// shadcn's Input is 16px on phones already (iOS Safari zooms into anything smaller).
const INPUT = "bg-background h-10 max-md:h-11";

/** The years offered, newest first: two ahead of now (announced works) back
 *  to 1900, plus the item's own year if it falls outside that. */
function yearOptions(current?: number): number[] {
  const top = new Date().getFullYear() + 2;
  const years = Array.from({ length: top - 1899 }, (_, i) => top - i);
  if (current && !years.includes(current)) {
    years.push(current);
    years.sort((a, b) => b - a);
  }
  return years;
}

function EditorForm({
  target,
  autoFocus,
  onSave,
  onDelete,
  onCancel,
}: {
  target: DialogTarget;
  autoFocus: boolean;
  onSave: Props["onSave"];
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(() => initialFields(target));
  const [region, setRegion] = useState<Region>(target.region);
  const set = <K extends keyof ItemFields>(k: K, v: ItemFields[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const editing = Boolean(target.item);
  const t = useT();
  // Cast is optional: 电视剧 offers a button that opens the field. An item
  // that already has a cast shows it straight away.
  const [castOpen, setCastOpen] = useState(() => Boolean(f.cast));
  // Opened by the button: focus the field as it appears.
  const [castFocus, setCastFocus] = useState(false);
  const [years] = useState(() => yearOptions(f.year));

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
        cast: f.cast?.trim() ?? "",
      },
      region,
    );
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 overflow-y-auto px-6 pt-1 pb-5 max-md:px-4">
        <div className="grid grid-cols-[1fr_auto] gap-4 max-md:gap-3">
          <Field id="f-name" label={t.name} required>
            <Input
              id="f-name"
              className={INPUT}
              required
              autoFocus={autoFocus}
              autoComplete="off"
              placeholder={t.namePlaceholder}
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field id="f-year" label={t.year}>
            <NativeSelect
              id="f-year"
              value={f.year ? String(f.year) : ""}
              onChange={(e) =>
                set("year", e.target.value ? Number(e.target.value) : undefined)
              }
              className={cn(
                INPUT,
                "w-28 tabular-nums max-md:w-26 max-md:text-base",
                !f.year && "text-muted-foreground",
              )}
            >
              <NativeSelectOption value="">{t.yearNone}</NativeSelectOption>
              {years.map((y) => (
                <NativeSelectOption key={y} value={y}>
                  {y}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 max-md:grid-cols-1">
          <Field id="f-progress" label={t.progress} hint={t.progressHint}>
            <Input
              id="f-progress"
              className={INPUT}
              autoComplete="off"
              placeholder={t.progressPlaceholder}
              value={f.progress}
              onChange={(e) => set("progress", e.target.value)}
            />
          </Field>
          <Field label={t.watchState}>
            <Segmented
              label={t.watchState}
              value={f.watch}
              options={WATCHES}
              onChange={(v) => set("watch", v)}
              render={(w) => t.watch[w]}
            />
          </Field>
        </div>

        {/* Four categories need the full width; status (two options) shares
            the next row with the region. */}
        <Field label={t.categoryLabel}>
          <Segmented
            label={t.categoryLabel}
            value={f.category}
            options={CATEGORIES}
            onChange={(v) => set("category", v)}
            render={(c) => {
              const Icon = CATEGORY[c].icon;
              return (
                <>
                  <Icon aria-hidden className="size-3.5" />
                  {t.category[c]}
                </>
              );
            }}
          />
        </Field>

        <div className="grid grid-cols-[auto_1fr] gap-4 max-md:grid-cols-1">
          <Field label={t.statusLabel}>
            <Segmented
              label={t.statusLabel}
              value={f.status}
              options={STATUSES}
              onChange={(v) => set("status", v)}
              render={(s) => t.status[s]}
            />
          </Field>
          <Field
            label={t.regionLabel}
            hint={
              editing && region !== target.region
                ? t.moveHint(t.region[target.region], t.region[region])
                : undefined
            }
          >
            <Segmented
              label={t.regionLabel}
              value={region}
              options={REGIONS}
              onChange={setRegion}
              render={(r) => t.region[r]}
            />
          </Field>
        </div>

        {castOpen ? (
          <Field id="f-cast" label={t.cast}>
            <Input
              id="f-cast"
              autoFocus={castFocus}
              className={INPUT}
              autoComplete="off"
              placeholder={t.castPlaceholder}
              value={f.cast ?? ""}
              onChange={(e) => set("cast", e.target.value)}
            />
          </Field>
        ) : (
          f.category === "电视剧" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCastOpen(true);
                setCastFocus(true);
              }}
              className="text-muted-foreground w-fit border-dashed max-md:h-11"
            >
              <Plus aria-hidden />
              {t.addCast}
            </Button>
          )
        )}

        <Field id="f-url" label={t.link}>
          <Input
            id="f-url"
            className={INPUT}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={f.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </Field>

        <Field id="f-note" label={t.note}>
          <Textarea
            id="f-note"
            className="bg-background min-h-16"
            rows={2}
            placeholder={t.notePlaceholder}
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>

      <footer className="flex items-center gap-2 border-t px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:px-4">
        {editing && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive -ml-2 max-md:h-11"
          >
            <Trash2 aria-hidden />
            {t.delete}
          </Button>
        )}
        <div className="flex-1" />
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="max-md:h-11"
        >
          {t.cancel}
        </Button>
        <Button type="submit" className="min-w-20 max-md:h-11">
          {t.save}
        </Button>
      </footer>
    </form>
  );
}

/** A labelled form row. With an `id` the label points at that control; without
 *  one (the segmented groups, which carry their own aria-label) it is a caption. */
function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  const caption = (
    <>
      {label}
      {required && <span className="text-destructive">*</span>}
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {id ? (
        <Label htmlFor={id} className="text-muted-foreground text-[13px]">
          {caption}
        </Label>
      ) : (
        <span className="text-muted-foreground text-[13px] leading-none font-medium">
          {caption}
        </span>
      )}
      {children}
      {hint && <span className="text-faint text-xs">{hint}</span>}
    </div>
  );
}
