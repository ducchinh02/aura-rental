"use client";

import { Copy } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { vietQrPayload } from "@/lib/vietqr";

// Tên ngân hàng theo mã BIN (Napas) cho các ngân hàng hay dùng
const BANKS: Record<string, string> = {
  "970436": "Vietcombank",
  "970415": "VietinBank",
  "970418": "BIDV",
  "970405": "Agribank",
  "970422": "MB Bank",
  "970407": "Techcombank",
  "970416": "ACB",
  "970432": "VPBank",
  "970423": "TPBank",
  "970403": "Sacombank",
  "970437": "HDBank",
  "970441": "VIB",
};

export type BankInfo = { bin: string; account: string; holder: string };

function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className="truncate font-medium tabular">{display ?? value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Chép ${label.toLowerCase()}`}
          onClick={() =>
            navigator.clipboard.writeText(value).then(
              () => toast.success(`Đã chép ${label.toLowerCase()}`),
              () => toast.error("Không chép được, bạn ghi lại giúp shop nhé"),
            )
          }
        >
          <Copy />
        </Button>
      </dd>
    </div>
  );
}

/** Mã QR vẽ bằng SVG từ chuỗi VietQR */
function QrSvg({ value, label, className }: { value: string; label: string; className?: string }) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  let path = "";
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) path += `M${col} ${row}h1v1h-1z`;
    }
  }
  return (
    <svg viewBox={`-2 -2 ${modules.size + 4} ${modules.size + 4}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={modules.size + 4} height={modules.size + 4} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

/** Thông tin chuyển cọc: mã VietQR (ngân hàng nào cũng quét được) + số tài khoản để chép */
export function DepositPayment({
  code,
  amount,
  bank,
  deadline,
}: {
  code: string;
  amount: number;
  bank: BankInfo | null;
  deadline?: string | null;
}) {
  if (!bank) {
    return (
      <p className="rounded-lg bg-muted px-4 py-3 text-sm">
        Shop sẽ nhắn số tài khoản để bạn chuyển cọc {formatMoney(amount)}. Nội dung chuyển khoản ghi mã đơn{" "}
        <span className="font-mono font-medium">{code}</span>.
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
      <figure className="mx-auto flex w-48 flex-col items-center gap-1.5 rounded-xl border bg-white p-3">
        <QrSvg
          value={vietQrPayload({ bin: bank.bin, account: bank.account, amount, message: code })}
          label={`Mã QR chuyển cọc ${formatMoney(amount)} cho đơn ${code}`}
          className="w-full"
        />
        <figcaption className="text-[0.6875rem] font-semibold tracking-wide text-[#005ba6]">VietQR · Napas 247</figcaption>
      </figure>
      <div>
        <p className="text-sm text-muted-foreground">
          Mở app ngân hàng, quét mã QR{deadline ? ` và chuyển trước ${formatDateTime(deadline)}` : ""}. Số tiền và
          nội dung đã điền sẵn.
        </p>
        <dl className="mt-2 divide-y">
          <CopyRow label="Số tiền" value={String(amount)} display={formatMoney(amount)} />
          <CopyRow label="Nội dung" value={code} />
          <CopyRow label="Số tài khoản" value={bank.account} display={`${bank.account} (${BANKS[bank.bin] ?? "ngân hàng"})`} />
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-sm text-muted-foreground">Chủ tài khoản</dt>
            <dd className="font-medium">{bank.holder}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
