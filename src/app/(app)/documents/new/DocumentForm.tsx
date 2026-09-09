"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function DocumentForm({
  action,
  properties,
  presetProperty,
}: {
  action: (p: State, fd: FormData) => Promise<State>;
  properties: { id: string; name: string }[];
  presetProperty?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}
      <div className="grid g3">
        <label className="f"><span>عنوان الوثيقة *</span><input name="title" required placeholder="رخصة بلدية — برج المقصد" /></label>
        <label className="f">
          <span>النوع</span>
          <select name="type" defaultValue="LICENSE">
            <option value="DEED">صك</option>
            <option value="LICENSE">رخصة</option>
            <option value="INSURANCE">وثيقة تأمين</option>
            <option value="CONTRACT">عقد</option>
            <option value="CERTIFICATE">شهادة</option>
            <option value="OTHER">أخرى</option>
          </select>
        </label>
        <label className="f">
          <span>العقار المرتبط</span>
          <select name="propertyId" defaultValue={presetProperty ?? ""}>
            <option value="">وثيقة على مستوى الشركة</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="f"><span>رقم الوثيقة</span><input name="number" dir="ltr" /></label>
        <label className="f"><span>تاريخ الإصدار</span><input name="issueDate" type="date" /></label>
        <label className="f"><span>تاريخ الانتهاء</span><input name="expiryDate" type="date" /></label>
        <label className="f"><span>رابط الملف</span><input name="fileUrl" dir="ltr" placeholder="https://…" /></label>
      </div>
      <label className="f"><span>ملاحظات</span><textarea name="notes" /></label>
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : "حفظ الوثيقة"}</button></div>
    </form>
  );
}
