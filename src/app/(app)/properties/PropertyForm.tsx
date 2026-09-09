"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function PropertyForm({
  action,
  owners,
  initial,
  submitLabel,
  showStatus,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  owners: { id: string; name: string; code: string }[];
  initial?: Record<string, unknown>;
  submitLabel: string;
  showStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = (k: string) => {
    const x = initial?.[k];
    if (x === null || x === undefined) return "";
    if (x instanceof Date) return x.toISOString().slice(0, 10);
    return String(x);
  };

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}

      <div className="grid g3">
        <label className="f"><span>رمز العقار *</span><input name="code" defaultValue={v("code")} required dir="ltr" placeholder="PRP-001" /></label>
        <label className="f"><span>اسم العقار *</span><input name="name" defaultValue={v("name")} required /></label>
        <label className="f">
          <span>المالك *</span>
          <select name="ownerId" defaultValue={v("ownerId")} required>
            <option value="">— اختر المالك —</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
          </select>
        </label>
        <label className="f">
          <span>النوع *</span>
          <select name="type" defaultValue={v("type") || "RESIDENTIAL"}>
            <option value="COMMERCIAL">مجمع تجاري</option>
            <option value="OFFICE">مبنى مكتبي</option>
            <option value="RESIDENTIAL">مجمع سكني</option>
            <option value="HOSPITALITY">ضيافة</option>
            <option value="LAND">أرض</option>
          </select>
        </label>
        <label className="f"><span>المدينة *</span><input name="city" defaultValue={v("city")} required /></label>
        <label className="f"><span>الحي</span><input name="district" defaultValue={v("district")} /></label>
        <label className="f"><span>رقم الصك</span><input name="deedNumber" defaultValue={v("deedNumber")} dir="ltr" /></label>
        <label className="f"><span>مساحة الأرض (م²)</span><input name="landArea" type="number" step="0.01" defaultValue={v("landArea")} /></label>
        <label className="f"><span>المساحة المبنية (م²)</span><input name="builtArea" type="number" step="0.01" defaultValue={v("builtArea")} /></label>
        <label className="f"><span>عدد الأدوار</span><input name="floors" type="number" defaultValue={v("floors")} /></label>
        <label className="f"><span>سنة البناء</span><input name="buildYear" type="number" defaultValue={v("buildYear")} /></label>
        <label className="f"><span>القيمة السوقية (ر.س)</span><input name="marketValue" type="number" step="0.01" defaultValue={v("marketValue")} /></label>
        <label className="f"><span>تاريخ التقييم</span><input name="valuedAt" type="date" defaultValue={v("valuedAt")} /></label>
        {showStatus ? (
          <label className="f">
            <span>الحالة</span>
            <select name="status" defaultValue={v("status") || "ACTIVE"}>
              <option value="ACTIVE">نشط</option>
              <option value="UNDER_MAINTENANCE">تحت الصيانة</option>
              <option value="INACTIVE">غير نشط</option>
            </select>
          </label>
        ) : null}
      </div>

      <label className="f"><span>العنوان</span><input name="address" defaultValue={v("address")} /></label>
      <label className="f"><span>ملاحظات</span><textarea name="notes" defaultValue={v("notes")} /></label>

      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : submitLabel}</button></div>
    </form>
  );
}
