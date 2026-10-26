"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/admin/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeBadge } from "@/components/admin/code-badge";
import { StatusBadge } from "@/components/admin/status";
import { itemStatusLabel, type ItemStatus, type Tone } from "@/lib/labels";
import { addItem, updateItem } from "./actions";

type Item = {
  id: string;
  code: string;
  size: string;
  home_branch_id: string;
  status: ItemStatus;
  condition_note: string | null;
  location: string;
  locationTone: Tone;
};

type Branch = { id: string; code: string; name: string };

export function ItemsManager({
  productId,
  codePrefix,
  items,
  branches,
  manageableBranchIds,
  defaultBranchId,
}: {
  productId: string;
  codePrefix: string;
  items: Item[];
  branches: Branch[];
  manageableBranchIds: string[];
  defaultBranchId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [size, setSize] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const branchCode = (id: string) => branches.find((b) => b.id === id)?.code ?? "";

  function suggestCode(nextSize: string, nextBranch: string) {
    if (codeTouched || !nextSize) return;
    const base = `${codePrefix}-${nextSize.toUpperCase()}-${branchCode(nextBranch)}`;
    const taken = new Set(items.map((i) => i.code));
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
    setCode(candidate);
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      onDone?.();
    });

  return (
    <div className="flex flex-col gap-5">
      {items.length > 0 && (
        <div className="-mx-5">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-xs">Mã</TableHead>
                <TableHead className="text-xs">Size</TableHead>
                <TableHead className="text-xs">Kho gốc</TableHead>
                <TableHead className="text-xs">Hôm nay</TableHead>
                <TableHead className="text-xs">Tình trạng</TableHead>
                <TableHead className="pr-5 text-xs">Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const editable = manageableBranchIds.includes(item.home_branch_id);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5">
                      <CodeBadge>{item.code}</CodeBadge>
                    </TableCell>
                    <TableCell className="font-semibold">{item.size}</TableCell>
                    <TableCell>
                      <Select
                        value={item.home_branch_id}
                        disabled={!editable || pending}
                        onValueChange={(v) =>
                          run(() => updateItem(item.id, { home_branch_id: v }), `Đã chuyển kho gốc ${item.code}`)
                        }
                      >
                        <SelectTrigger size="sm" aria-label={`Kho gốc ${item.code}`} className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={item.locationTone}>{item.location}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.status}
                        disabled={!editable || pending}
                        onValueChange={(v) =>
                          run(() => updateItem(item.id, { status: v as ItemStatus }), `Đã cập nhật ${item.code}`)
                        }
                      >
                        <SelectTrigger size="sm" aria-label={`Tình trạng ${item.code}`} className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(itemStatusLabel) as ItemStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {itemStatusLabel[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="pr-5">
                      <Input
                        aria-label={`Ghi chú ${item.code}`}
                        defaultValue={item.condition_note ?? ""}
                        disabled={!editable}
                        placeholder="Ví dụ: sứt khoá kéo"
                        className="h-8"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (item.condition_note ?? ""))
                            run(() => updateItem(item.id, { condition_note: e.target.value }), "Đã lưu ghi chú");
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <form
        className="grid gap-3 sm:grid-cols-[6rem_13rem_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addItem(productId, { size, code, home_branch_id: branchId }), `Đã thêm ${code}`, () => {
            setSize("");
            setCode("");
            setCodeTouched(false);
          });
        }}
      >
        <Field label="Size" htmlFor="new-size">
          <Input
            id="new-size"
            list="size-options"
            value={size}
            onChange={(e) => {
              setSize(e.target.value);
              suggestCode(e.target.value, branchId);
            }}
            required
          />
          <datalist id="size-options">
            {["XS", "S", "M", "L", "XL", "XXL", "FREE"].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Kho gốc" htmlFor="new-branch">
          <Select
            value={branchId}
            onValueChange={(v) => {
              setBranchId(v);
              suggestCode(size, v);
            }}
          >
            <SelectTrigger id="new-branch" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches
                .filter((b) => manageableBranchIds.includes(b.id))
                .map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Mã váy" htmlFor="new-code" hint="Ghi trên mác váy để tìm nhanh.">
          <Input
            id="new-code"
            value={code}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value);
            }}
            required
          />
        </Field>
        <Button type="submit" disabled={pending} className="sm:mb-5">
          <Plus />
          Thêm chiếc
        </Button>
      </form>
    </div>
  );
}
