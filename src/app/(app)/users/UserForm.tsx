"use client";

import { useActionState, useState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function UserForm({
  action,
  owners,
}: {
  action: (p: State, fd: FormData) => Promise<State>;
  owners: { id: string; name: string; code: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [role, setRole] = useState("OPERATIONS");

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}
      <div className="grid g3">
        <label className="f"><span>الاسم *</span><input name="name" required /></label>
        <label className="f"><span>البريد *</span><input name="email" type="email" required dir="ltr" /></label>
        <label className="f"><span>كلمة المرور *</span><input name="password" type="password" required minLength={6} dir="ltr" /></label>
        <label className="f">
          <span>الدور *</span>
          <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ADMIN">مدير النظام</option>
            <option value="FINANCE">الفريق المالي</option>
            <option value="OPERATIONS">الفريق الإداري والتشغيل</option>
            <option value="LEGAL">الفريق القانوني</option>
            <option value="MAINTENANCE">فريق الصيانة</option>
            <option value="OWNER">مالك / مستثمر (بوابة)</option>
          </select>
        </label>
        <label className="f"><span>الجوال</span><input name="phone" dir="ltr" /></label>
        {role === "OWNER" ? (
          <label className="f">
            <span>المالك المرتبط *</span>
            <select name="ownerId" required defaultValue="">
              <option value="">— اختر المالك —</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</button></div>
    </form>
  );
}
