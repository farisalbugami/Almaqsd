"use client";

import { useActionState } from "react";
import { generatePayout } from "./actions";

export function PayoutForm({ owners }: { owners: { id: string; name: string; code: string }[] }) {
  const [state, formAction, pending] = useActionState(generatePayout, undefined);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}
      <div className="grid g4">
        <label className="f">
          <span>المالك *</span>
          <select name="ownerId" required defaultValue="">
            <option value="">— اختر المالك —</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label className="f"><span>من *</span><input name="from" type="date" required defaultValue={monthStart} /></label>
        <label className="f"><span>إلى *</span><input name="to" type="date" required defaultValue={monthEnd} /></label>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الاحتساب…" : "احتساب وتوليد التوريد"}</button>
        </div>
      </div>
      <div className="hint">
        يحتسب النظام: المحصّل فعلياً في الفترة − المصروفات المعتمدة على المالك − عمولة الإدارة حسب عقده = صافي التوريد.
      </div>
    </form>
  );
}
