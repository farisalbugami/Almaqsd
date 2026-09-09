"use client";

import { useActionState, useState } from "react";
import { terminateLease, renewLease } from "../actions";

export function LeaseActions({
  leaseId,
  status,
  endDate,
  annualRent,
}: {
  leaseId: string;
  status: string;
  endDate: string;
  annualRent: number;
}) {
  const [state, formAction, pending] = useActionState(renewLease.bind(null, leaseId), undefined);
  const [confirming, setConfirming] = useState(false);

  const nextStart = new Date(new Date(endDate).getTime() + 86_400_000).toISOString().slice(0, 10);
  const nextEnd = (() => {
    const d = new Date(nextStart);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();

  if (status !== "ACTIVE") {
    return (
      <div className="card">
        <div className="card-head"><h3>إجراءات العقد</h3></div>
        <div className="empty">العقد غير ساري — لا توجد إجراءات متاحة.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head"><h3>إجراءات العقد</h3></div>
      <div className="card-body stack">
        {state?.error ? <div className="err">{state.error}</div> : null}

        <form action={formAction} className="stack">
          <div className="b">تجديد العقد</div>
          <div className="grid g3">
            <label className="f"><span>بداية التجديد</span><input name="startDate" type="date" defaultValue={nextStart} required /></label>
            <label className="f"><span>نهاية التجديد</span><input name="endDate" type="date" defaultValue={nextEnd} required /></label>
            <label className="f"><span>الإيجار السنوي الجديد</span><input name="annualRent" type="number" step="0.01" defaultValue={annualRent} required /></label>
          </div>
          <div className="hint">ينهي العقد الحالي وينشئ عقداً جديداً بجدول فواتير جديد.</div>
          <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ التجديد…" : "تجديد العقد"}</button></div>
        </form>

        <hr style={{ border: 0, borderTop: "1px solid var(--rule)" }} />

        <div className="stack">
          <div className="b">فسخ العقد</div>
          <div className="hint">يُعيد الوحدة إلى حالة «شاغرة» ويلغي الفواتير غير المستحقة بعد اليوم.</div>
          {confirming ? (
            <div className="row">
              <form action={terminateLease.bind(null, leaseId)}>
                <button className="btn danger" type="submit">تأكيد الفسخ</button>
              </form>
              <button className="btn" type="button" onClick={() => setConfirming(false)}>إلغاء</button>
            </div>
          ) : (
            <div><button className="btn danger" type="button" onClick={() => setConfirming(true)}>فسخ العقد</button></div>
          )}
        </div>
      </div>
    </div>
  );
}
