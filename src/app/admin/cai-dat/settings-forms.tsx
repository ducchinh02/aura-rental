"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, UserPen, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { Field } from "@/components/admin/field";
import { MoneyInput } from "@/components/admin/money-input";
import { TimeSelect } from "@/components/admin/time-select";
import { formatPhone } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import {
  createAccount,
  createBranch,
  deleteCategory,
  resetPassword,
  saveCategory,
  setBranchActive,
  updateAccount,
  updateAccountInfo,
  updateBranch,
  updateSettings,
} from "./actions";

function useRun() {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>, success: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      onDone?.();
    });
  return { pending, run };
}

// Ngân hàng phổ biến cho VietQR (mã BIN theo NAPAS)
const BANKS = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
];

type Settings = {
  cleaning_days: number;
  transfer_days: number;
  ship_days_local: number;
  ship_days_province: number;
  hold_hours: number;
  hourly_buffer_minutes: number;
  late_fee_per_day: number;
  bank_bin: string;
  bank_account: string;
  bank_holder: string;
};

export function SettingsForm({ initial, editable }: { initial: Settings; editable: boolean }) {
  const [values, setValues] = useState(initial);
  const { pending, run } = useRun();
  const num = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: Number(e.target.value) }));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateSettings(values), "Đã lưu cài đặt");
      }}
    >
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-3">
        <Field label="Ngày giặt ủi sau mỗi lượt" htmlFor="s-clean">
          <Input id="s-clean" type="number" min={0} value={values.cleaning_days} onChange={num("cleaning_days")} />
        </Field>
        <Field label="Ngày chuyển giữa các cơ sở" htmlFor="s-transfer">
          <Input id="s-transfer" type="number" min={0} value={values.transfer_days} onChange={num("transfer_days")} />
        </Field>
        <Field label="Giờ giữ chỗ khi chờ cọc" htmlFor="s-hold">
          <Input id="s-hold" type="number" min={1} value={values.hold_hours} onChange={num("hold_hours")} />
        </Field>
        <Field
          label="Chuẩn bị giữa 2 lượt thuê giờ (phút)"
          htmlFor="s-hourly-buffer"
          hint="Thời gian là, hấp váy trước khi cho lượt tiếp theo thuê."
        >
          <Input
            id="s-hourly-buffer"
            type="number"
            min={0}
            step={15}
            value={values.hourly_buffer_minutes}
            onChange={num("hourly_buffer_minutes")}
          />
        </Field>
        <Field label="Ngày ship nội thành" htmlFor="s-ship-local">
          <Input id="s-ship-local" type="number" min={0} value={values.ship_days_local} onChange={num("ship_days_local")} />
        </Field>
        <Field label="Ngày ship ngoại tỉnh" htmlFor="s-ship-province">
          <Input
            id="s-ship-province"
            type="number"
            min={0}
            value={values.ship_days_province}
            onChange={num("ship_days_province")}
          />
        </Field>
        <Field label="Phí trả trễ mỗi ngày" htmlFor="s-late">
          <MoneyInput
            id="s-late"
            value={values.late_fee_per_day}
            onValueChange={(v) => setValues((s) => ({ ...s, late_fee_per_day: v }))}
          />
        </Field>
      </fieldset>

      <fieldset disabled={!editable} className="grid gap-4 border-t pt-5 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold">Tài khoản nhận cọc (hiện mã VietQR cho khách)</legend>
        <Field label="Ngân hàng" htmlFor="s-bank">
          <Select value={values.bank_bin} onValueChange={(v) => setValues((s) => ({ ...s, bank_bin: v }))}>
            <SelectTrigger id="s-bank" className="w-full">
              <SelectValue placeholder="Chọn ngân hàng" />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map((b) => (
                <SelectItem key={b.bin} value={b.bin}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Số tài khoản" htmlFor="s-account">
          <Input
            id="s-account"
            inputMode="numeric"
            value={values.bank_account}
            onChange={(e) => setValues((s) => ({ ...s, bank_account: e.target.value }))}
          />
        </Field>
        <Field label="Tên chủ tài khoản" htmlFor="s-holder">
          <Input
            id="s-holder"
            value={values.bank_holder}
            onChange={(e) => setValues((s) => ({ ...s, bank_holder: e.target.value.toUpperCase() }))}
          />
        </Field>
      </fieldset>

      {editable && (
        <Button type="submit" disabled={pending} className="self-end">
          {pending ? "Đang lưu…" : "Lưu cài đặt"}
        </Button>
      )}
    </form>
  );
}

type BranchValues = {
  name: string;
  address: string;
  phone: string;
  map_url: string;
  open_time: string;
  close_time: string;
  fitting_slot_minutes: number | null;
  fitting_capacity: number | null;
};

export function BranchForm({ branchId, initial, editable }: { branchId: string; initial: BranchValues; editable: boolean }) {
  const [values, setValues] = useState(initial);
  const { pending, run } = useRun();
  const set = <K extends keyof BranchValues>(key: K, value: BranchValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const optionalNumber = (value: string) => (value === "" ? null : Number(value));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateBranch(branchId, values), `Đã lưu ${values.name}`);
      }}
    >
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên cơ sở" htmlFor={`b-name-${branchId}`}>
          <Input id={`b-name-${branchId}`} value={values.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="Số điện thoại" htmlFor={`b-phone-${branchId}`}>
          <Input id={`b-phone-${branchId}`} value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Địa chỉ" htmlFor={`b-address-${branchId}`} className="sm:col-span-2">
          <Input id={`b-address-${branchId}`} value={values.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Link Google Maps" htmlFor={`b-map-${branchId}`} className="sm:col-span-2">
          <Input id={`b-map-${branchId}`} value={values.map_url} onChange={(e) => set("map_url", e.target.value)} />
        </Field>
        <Field label="Mở cửa" htmlFor={`b-open-${branchId}`}>
          <TimeSelect id={`b-open-${branchId}`} value={values.open_time} onChange={(v) => set("open_time", v)} />
        </Field>
        <Field label="Đóng cửa" htmlFor={`b-close-${branchId}`}>
          <TimeSelect id={`b-close-${branchId}`} value={values.close_time} onChange={(v) => set("close_time", v)} />
        </Field>
        <Field
          label="Mỗi lượt thử (phút)"
          htmlFor={`b-slot-${branchId}`}
          hint="Để trống: khách chọn giờ tự do."
        >
          <Input
            id={`b-slot-${branchId}`}
            type="number"
            min={5}
            value={values.fitting_slot_minutes ?? ""}
            onChange={(e) => set("fitting_slot_minutes", optionalNumber(e.target.value))}
          />
        </Field>
        <Field label="Số khách thử cùng lúc" htmlFor={`b-cap-${branchId}`} hint="Để trống: không giới hạn.">
          <Input
            id={`b-cap-${branchId}`}
            type="number"
            min={1}
            value={values.fitting_capacity ?? ""}
            onChange={(e) => set("fitting_capacity", optionalNumber(e.target.value))}
          />
        </Field>
      </fieldset>
      {editable && (
        <Button type="submit" disabled={pending} className="self-end">
          {pending ? "Đang lưu…" : "Lưu cơ sở"}
        </Button>
      )}
    </form>
  );
}

export function CategoryManager({ categories }: { categories: { id: string; name: string; productCount: number }[] }) {
  const [name, setName] = useState("");
  const { pending, run } = useRun();

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y rounded-lg border">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-1.5">
            <Input
              aria-label={`Tên danh mục ${c.name}`}
              defaultValue={c.name}
              className="h-8 border-transparent px-1 shadow-none hover:border-input"
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value.trim() !== c.name)
                  run(() => saveCategory(c.id, e.target.value), "Đã đổi tên danh mục");
              }}
            />
            <span className="shrink-0 text-xs text-muted-foreground">{c.productCount} mẫu</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Xoá ${c.name}`} disabled={pending}>
                  <X />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xoá danh mục “{c.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {c.productCount
                      ? `${c.productCount} mẫu trong danh mục sẽ chuyển về "Chưa phân loại".`
                      : "Danh mục chưa có mẫu nào."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Giữ lại</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => run(() => deleteCategory(c.id), "Đã xoá danh mục")}>
                    Xoá danh mục
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCategory(null, name), "Đã thêm danh mục", () => setName(""));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên danh mục mới" aria-label="Tên danh mục mới" />
        <Button type="submit" variant="outline" disabled={pending || !name.trim()}>
          <Plus />
          Thêm
        </Button>
      </form>
    </div>
  );
}

type Account = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: "owner" | "staff";
  branch_id: string | null;
  is_active: boolean;
};

export function AccountsManager({
  accounts,
  branches,
  currentUserId,
}: {
  accounts: Account[];
  branches: { id: string; name: string; code: string }[];
  currentUserId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y rounded-lg border">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} branches={branches} isSelf={a.id === currentUserId} />
        ))}
      </ul>
      <NewAccountDialog branches={branches} />
    </div>
  );
}

function AccountRow({
  account,
  branches,
  isSelf,
}: {
  account: Account;
  branches: { id: string; name: string; code: string }[];
  isSelf: boolean;
}) {
  const { pending, run } = useRun();
  const scope = account.role === "owner" ? "owner" : (account.branch_id ?? "");
  const save = (patch: Partial<Pick<Account, "role" | "branch_id" | "is_active">>) =>
    run(
      () =>
        updateAccount(account.id, {
          role: patch.role ?? account.role,
          branch_id: patch.branch_id !== undefined ? patch.branch_id : account.branch_id,
          is_active: patch.is_active ?? account.is_active,
        }),
      "Đã cập nhật tài khoản",
    );

  return (
    <li className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <CustomerAvatar name={account.full_name || account.email} />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {account.full_name || account.email}
            {isSelf && <span className="font-normal text-muted-foreground"> (bạn)</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {account.email}
            {account.phone ? (
              <span className="tabular">, {formatPhone(account.phone)}</span>
            ) : (
              <span className="text-amber-700">, chưa có SĐT</span>
            )}
          </p>
        </div>
      </div>
      <Select
        value={scope}
        disabled={pending || isSelf}
        onValueChange={(v) => save(v === "owner" ? { role: "owner", branch_id: null } : { role: "staff", branch_id: v })}
      >
        <SelectTrigger aria-label={`Quyền của ${account.email}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="owner">Chủ shop</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              Nhân viên {b.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={account.is_active}
          disabled={pending || isSelf}
          onCheckedChange={(v) => save({ is_active: v })}
          aria-label={`Cho phép ${account.email} đăng nhập`}
        />
        {account.is_active ? "Đang dùng" : "Đã khoá"}
      </label>
      <div className="flex">
        <EditAccountDialog account={account} />
        <ResetPasswordDialog profileId={account.id} email={account.email} />
      </div>
    </li>
  );
}

function EditAccountDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(account.full_name);
  const [phone, setPhone] = useState(account.phone ?? "");
  const { pending, run } = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <UserPen />
          Thông tin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateAccountInfo(account.id, { full_name: fullName, phone }), "Đã lưu thông tin nhân viên", () =>
              setOpen(false),
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Thông tin nhân viên</DialogTitle>
            <DialogDescription>{account.email}</DialogDescription>
          </DialogHeader>
          <Field label="Tên" htmlFor={`e-name-${account.id}`}>
            <Input id={`e-name-${account.id}`} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Số điện thoại" htmlFor={`e-phone-${account.id}`} hint="Dùng để gọi khi cần, khách không thấy số này.">
            <Input
              id={`e-phone-${account.id}`}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912 345 678"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ profileId, email }: { profileId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const { pending, run } = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil />
          Mật khẩu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => resetPassword(profileId, password), "Đã đổi mật khẩu", () => {
              setOpen(false);
              setPassword("");
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Đặt mật khẩu mới</DialogTitle>
            <DialogDescription>Cho tài khoản {email}. Báo mật khẩu mới cho nhân viên.</DialogDescription>
          </DialogHeader>
          <Field label="Mật khẩu mới" htmlFor="new-password" hint="Tối thiểu 8 ký tự.">
            <Input
              id="new-password"
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Đặt mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewAccountDialog({ branches }: { branches: { id: string; name: string; code: string }[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [scope, setScope] = useState(branches[0]?.id ?? "owner");
  const { pending, run } = useRun();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="self-start">
          <Plus />
          Thêm tài khoản
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                createAccount({
                  email,
                  password,
                  full_name: fullName,
                  phone,
                  role: scope === "owner" ? "owner" : "staff",
                  branch_id: scope === "owner" ? null : scope,
                }),
              `Đã tạo tài khoản ${email}`,
              () => {
                setOpen(false);
                setEmail("");
                setPassword("");
                setFullName("");
                setPhone("");
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Thêm tài khoản</DialogTitle>
            <DialogDescription>Nhân viên đăng nhập bằng email và mật khẩu này.</DialogDescription>
          </DialogHeader>
          <Field label="Tên" htmlFor="a-name">
            <Input id="a-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Số điện thoại" htmlFor="a-phone">
            <Input
              id="a-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912 345 678"
              required
            />
          </Field>
          <Field label="Email" htmlFor="a-email">
            <Input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Mật khẩu" htmlFor="a-password" hint="Tối thiểu 8 ký tự.">
            <Input
              id="a-password"
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          <Field label="Quyền" htmlFor="a-scope">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="a-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    Nhân viên {b.name}
                  </SelectItem>
                ))}
                <SelectItem value="owner">Chủ shop (toàn quyền)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo…" : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BranchActiveSwitch({ branchId, name, active }: { branchId: string; name: string; active: boolean }) {
  const { pending, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={active}
          disabled={pending}
          onCheckedChange={(v) => (v ? run(() => setBranchActive(branchId, true), `Đã mở lại ${name}`) : setConfirming(true))}
          aria-label={`${name} đang hoạt động`}
        />
        {active ? "Đang hoạt động" : "Ngưng hoạt động"}
      </label>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ngưng hoạt động {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Cơ sở sẽ ẩn khỏi lịch, đơn mới và trang khách. Chỉ ngưng được khi cơ sở không còn váy, đơn đang xử lý hay nhân
              viên. Lịch sử đơn cũ vẫn giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ hoạt động</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run(() => setBranchActive(branchId, false), `Đã ngưng ${name}`)}
            >
              Ngưng hoạt động
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function NewBranchDialog({ suggestedCode }: { suggestedCode: string }) {
  const empty = {
    code: suggestedCode,
    name: "",
    address: "",
    phone: "",
    map_url: "",
    open_time: "09:00",
    close_time: "21:00",
    fitting_slot_minutes: 60 as number | null,
    fitting_capacity: null as number | null,
  };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(empty);
  const { pending, run } = useRun();
  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValues({ ...empty, code: suggestedCode });
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Thêm cơ sở
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createBranch(values), `Đã thêm ${values.name}`, () => setOpen(false));
          }}
        >
          <DialogHeader>
            <DialogTitle>Thêm cơ sở</DialogTitle>
            <DialogDescription>
              Sau khi thêm, tạo tài khoản nhân viên cho cơ sở và nhập váy với kho gốc là cơ sở này.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <Field label="Mã" htmlFor="nb-code" hint="Hiện trên lịch, đơn">
              <Input
                id="nb-code"
                value={values.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                maxLength={6}
                required
              />
            </Field>
            <Field label="Tên cơ sở" htmlFor="nb-name">
              <Input
                id="nb-name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Aura Rental - Cơ sở 3"
                required
              />
            </Field>
            <Field label="Địa chỉ" htmlFor="nb-address" className="sm:col-span-2">
              <Input id="nb-address" value={values.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Số điện thoại" htmlFor="nb-phone" className="sm:col-span-2">
              <Input id="nb-phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mở cửa" htmlFor="nb-open">
              <TimeSelect id="nb-open" value={values.open_time} onChange={(v) => set("open_time", v)} />
            </Field>
            <Field label="Đóng cửa" htmlFor="nb-close">
              <TimeSelect id="nb-close" value={values.close_time} onChange={(v) => set("close_time", v)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang thêm…" : "Thêm cơ sở"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
