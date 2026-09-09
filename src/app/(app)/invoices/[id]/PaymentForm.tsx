"use client";

import { useActionState } from "react";
import { recordPayment } from "../actions";
import { money } from "@/lib/format";

export function PaymentForm({ invoiceId, remaining }: { invoiceId: string; remaining: number }) {
  const [state, formAction, pending] = useActionState(recordPayment.bind(null, invoiceId), undefined);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}

      <div className="grid g2">
        <label className="f">
          <span>المبلغ (ر.س) *</span>
          <input name="amount" type="number" step="0.01" max={remaining} defaultValue={remaining.toFixed(2)} required />
          <span className="hint">المتبقي على الفاتورة: {money(remaining)}</span>
        </label>
        <label className="f">
          <span>تاريخ السداد *</span>
          <input name="paidAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </label>
        <label className="f">
          <span>طريقة السداد</span>
          <select name="method" defaultValue="BANK_TRANSFER">
            <option value="BANK_TRANSFER">تحويل بنكي</option>
            <option value="CHEQUE">شيك</option>
            <option value="SADAD">سداد</option>
            <option value="MADA">مدى</option>
            <option value="CASH">نقداً</option>
          </select>
        </label>
        <label className="f"><span>رقم المرجع / الشيك</span><input name="reference" dir="ltr" /></label>
        <label className="f"><span>البنك</span><input name="bankName" /></label>
      </div>

      <label className="f"><span>ملاحظات</span><textarea name="notes" /></label>
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ التسجيل…" : "تسجيل سند القبض"}</button></div>
    </form>
  );
}
