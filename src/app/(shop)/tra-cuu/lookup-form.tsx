"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field } from "@/components/admin/field";
import { BookingStatusBadge } from "@/components/admin/status";
import { DepositPayment, type BankInfo } from "@/components/shop/deposit-payment";
import { formatDateTime, formatPeriod, periodLength, periodOf } from "@/lib/dates";
import { formatMoney, formatPhone } from "@/lib/format";
import { lookupOrder, type LookedUpOrder } from "@/app/(shop)/actions";

export function LookupForm({ bank }: { bank: BankInfo | null }) {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<LookedUpOrder | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await lookupOrder({ code, phone });
      if (!result.ok) {
        setOrder(null);
        setError(result.error);
        return;
      }
      setOrder(result.data);
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Mã đơn" htmlFor="code">
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" required />
        </Field>
        <Field label="Số điện thoại" htmlFor="lookup-phone">
          <Input
            id="lookup-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Tra cứu
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {order && <OrderCard order={order} bank={bank} />}
    </div>
  );
}

function OrderCard({ order, bank }: { order: LookedUpOrder; bank: BankInfo | null }) {
  const period = periodOf(order);
  const owing = Math.max(order.deposit_required - order.amount_paid, 0);
  const needsDeposit = order.status === "pending" && owing > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3 font-mono">
          {order.code}
          <BookingStatusBadge status={order.status} noDeposit={order.deposit_required === 0} />
        </CardTitle>
        <CardDescription>
          {formatPeriod(period)} ({periodLength(period)}),{" "}
          {order.delivery_method === "ship" ? "giao tận nơi" : `nhận tại ${order.branch.name}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="divide-y rounded-lg border text-sm">
          {(order.items ?? []).map((item, i) => (
            <li key={i} className="flex justify-between gap-4 px-4 py-2.5">
              <span>
                {item.product_name}, size {item.size}
              </span>
              <span className="tabular">{formatMoney(item.price)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid gap-2 text-sm tabular">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tổng tiền</dt>
            <dd className="font-medium">{formatMoney(order.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Đã thanh toán</dt>
            <dd>{formatMoney(order.amount_paid)}</dd>
          </div>
        </dl>

        {needsDeposit && (
          <div className="flex flex-col gap-3 border-t pt-5">
            <p className="font-medium">
              Chuyển cọc {formatMoney(owing)}
              {order.hold_expires_at && (
                <span className="font-normal text-muted-foreground"> trước {formatDateTime(order.hold_expires_at)}</span>
              )}
            </p>
            <DepositPayment code={order.code} amount={owing} bank={bank} />
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t pt-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{order.branch.name}</p>
          {order.branch.address && (
            <p className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {order.branch.address}
            </p>
          )}
          {order.branch.phone && (
            <p className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0" />
              <a href={`tel:${order.branch.phone}`} className="tabular hover:text-foreground">
                {formatPhone(order.branch.phone)}
              </a>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
