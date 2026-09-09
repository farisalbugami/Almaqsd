"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function OwnerForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  initial?: Record<string, string | null>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = (k: string) => initial?.[k] ?? "";

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}

      <div className="grid g3">
        <label className="f">
          <span>رمز المالك *</span>
          <input name="code" defaultValue={v("code")} required placeholder="OWN-001" dir="ltr" />
        </label>
        <label className="f">
          <span>الاسم *</span>
          <input name="name" defaultValue={v("name")} required />
        </label>
        <label className="f">
          <span>التصنيف *</span>
          <select name="type" defaultValue={v("type") || "INDIVIDUAL"}>
            <option value="INDIVIDUAL">فرد</option>
            <option value="COMPANY">شركة</option>
            <option value="REIT">صندوق ريت</option>
          </select>
        </label>
        <label className="f">
          <span>رقم الهوية / السجل التجاري</span>
          <input name="idNumber" defaultValue={v("idNumber")} dir="ltr" />
        </label>
        <label className="f">
          <span>الجوال</span>
          <input name="phone" defaultValue={v("phone")} dir="ltr" placeholder="05xxxxxxxx" />
        </label>
        <label className="f">
          <span>البريد الإلكتروني</span>
          <input name="email" type="email" defaultValue={v("email")} dir="ltr" />
        </label>
        <label className="f">
          <span>الآيبان</span>
          <input name="iban" defaultValue={v("iban")} dir="ltr" placeholder="SA00 0000 0000 0000 0000 0000" />
        </label>
        <label className="f">
          <span>البنك</span>
          <input name="bankName" defaultValue={v("bankName")} />
        </label>
      </div>

      <label className="f">
        <span>ملاحظات</span>
        <textarea name="notes" defaultValue={v("notes")} />
      </label>

      <div className="row">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
