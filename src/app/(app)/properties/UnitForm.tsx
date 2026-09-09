"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function UnitForm({ action }: { action: (prev: State, fd: FormData) => Promise<State> }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      {state?.ok ? <div className="ok-msg">{state.ok}</div> : null}
      <div className="grid g4">
        <label className="f"><span>رمز الوحدة *</span><input name="code" required placeholder="A-101" dir="ltr" /></label>
        <label className="f">
          <span>النوع</span>
          <select name="type" defaultValue="APARTMENT">
            <option value="APARTMENT">شقة</option>
            <option value="OFFICE">مكتب</option>
            <option value="SHOP">محل</option>
            <option value="SHOWROOM">معرض</option>
            <option value="WAREHOUSE">مستودع</option>
            <option value="CHALET">شاليه</option>
            <option value="VILLA">فيلا</option>
          </select>
        </label>
        <label className="f"><span>الدور</span><input name="floor" /></label>
        <label className="f"><span>المساحة (م²)</span><input name="area" type="number" step="0.01" /></label>
        <label className="f"><span>الغرف</span><input name="rooms" type="number" /></label>
        <label className="f"><span>دورات المياه</span><input name="baths" type="number" /></label>
        <label className="f"><span>الإيجار السنوي المستهدف</span><input name="marketRent" type="number" step="0.01" /></label>
        <label className="f">
          <span>الحالة</span>
          <select name="status" defaultValue="VACANT">
            <option value="VACANT">شاغرة</option>
            <option value="LEASED">مؤجرة</option>
            <option value="RESERVED">محجوزة</option>
            <option value="MAINTENANCE">تحت الصيانة</option>
          </select>
        </label>
        <label className="f"><span>عداد الكهرباء</span><input name="meterElec" dir="ltr" /></label>
        <label className="f"><span>عداد المياه</span><input name="meterWater" dir="ltr" /></label>
      </div>
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الإضافة…" : "إضافة الوحدة"}</button></div>
    </form>
  );
}
