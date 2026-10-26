"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signIn, type SignInState } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  const inactive = searchParams.get("error") === "inactive";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />

      <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          autoFocus
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      </FieldGroup>

      {(state.error || inactive) && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error ?? "Tài khoản đã bị khoá. Liên hệ chủ shop để mở lại."}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Spinner />}
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
