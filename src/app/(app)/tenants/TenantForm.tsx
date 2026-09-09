"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function TenantForm({ action }: { action: (p: State, fd: FormData) => Promise<State> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}
      <div className="grid g3">
        <label className="f"><span>الرمز *</span><input name="code" required dir="ltr" placeholder="TEN-001" /></label>
        <label className="f"><span>الاسم *</span><input name="name" required /></label>
        <label className="f">
          <span>النوع</span>
          <select name="type" defaultValue="INDIVIDUAL"><option value="INDIVIDUAL">فرد</option><option value="COMPANY">شركة</option></select>
        </label>
        <label className="f"><span>الهوية / السجل</span><input name="idNumber" dir="ltr" /></label>
        <label className="f"><span>الجوال</span><input name="phone" dir="ltr" /></label>
        <label className="f"><span>البريد</span><input name="email" type="email" dir="ltr" /></label>
      </div>
      <label className="f"><span>ملاحظات</span><textarea name="notes" /></label>
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : "إضافة المستأجر"}</button></div>
    </form>
  );
}
