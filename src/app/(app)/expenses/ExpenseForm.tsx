"use client";

import { useActionState, useState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function ExpenseForm({
  action,
  properties,
  presetProperty,
}: {
  action: (p: State, fd: FormData) => Promise<State>;
  properties: { id: string; name: string; units: { id: string; code: string }[] }[];
  presetProperty?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [pid, setPid] = useState(presetProperty ?? "");
  const units = properties.find((p) => p.id === pid)?.units ?? [];

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}

      <div className="grid g3">
        <label className="f">
          <span>العقار *</span>
          <select name="propertyId" required value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">— اختر العقار —</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="f">
          <span>الوحدة (اختياري)</span>
          <select name="unitId" defaultValue="">
            <option value="">على مستوى العقار</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
          </select>
        </label>
        <label className="f">
          <span>التصنيف *</span>
          <select name="category" defaultValue="MAINTENANCE">
            <option value="MAINTENANCE">صيانة</option>
            <option value="UTILITIES">مرافق وخدمات</option>
            <option value="SECURITY">أمن وحراسة</option>
            <option value="CLEANING">نظافة</option>
            <option value="GOVERNMENT">رسوم حكومية</option>
            <option value="INSURANCE">تأمين</option>
            <option value="MARKETING">تسويق</option>
            <option value="OTHER">أخرى</option>
          </select>
        </label>
        <label className="f"><span>التاريخ *</span><input name="spentAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label className="f"><span>المبلغ قبل الضريبة *</span><input name="amount" type="number" step="0.01" required /></label>
        <label className="f"><span>الضريبة</span><input name="vatAmount" type="number" step="0.01" defaultValue={0} /></label>
        <label className="f"><span>المورّد / المقاول</span><input name="vendor" /></label>
        <label className="f">
          <span>التحميل على *</span>
          <select name="chargeTo" defaultValue="OWNER">
            <option value="OWNER">على المالك — يُخصم من كشف حسابه</option>
            <option value="COMPANY">على الشركة</option>
          </select>
        </label>
        <label className="f"><span>رابط المرفق</span><input name="attachment" dir="ltr" placeholder="اختياري" /></label>
      </div>

      <label className="f"><span>البيان *</span><input name="description" required placeholder="مثال: صيانة مصعد المبنى الرئيسي" /></label>

      <div className="hint">إذا تجاوز المبلغ سقف الصرف المتفق عليه في عقد إدارة المالك، يُحفظ المصروف كمعلّق بانتظار موافقة المالك.</div>
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : "تسجيل المصروف"}</button></div>
    </form>
  );
}
