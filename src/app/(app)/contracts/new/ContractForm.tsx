"use client";

import { useActionState, useState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function ContractForm({
  action,
  owners,
  presetOwner,
}: {
  action: (p: State, fd: FormData) => Promise<State>;
  owners: { id: string; name: string; code: string }[];
  presetOwner?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState("PERCENT_COLLECTED");

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}

      <div className="grid g3">
        <label className="f">
          <span>المالك *</span>
          <select name="ownerId" required defaultValue={presetOwner ?? ""}>
            <option value="">— اختر المالك —</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
          </select>
        </label>
        <label className="f"><span>تاريخ البداية *</span><input name="startDate" type="date" required /></label>
        <label className="f"><span>تاريخ النهاية *</span><input name="endDate" type="date" required /></label>
        <label className="f">
          <span>نوع العمولة *</span>
          <select name="commissionType" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="PERCENT_COLLECTED">نسبة من المحصّل فعلياً</option>
            <option value="PERCENT_CONTRACTED">نسبة من الإيجار المتعاقد</option>
            <option value="FIXED_MONTHLY">مبلغ شهري ثابت</option>
          </select>
        </label>
        <label className="f">
          <span>{type === "FIXED_MONTHLY" ? "المبلغ الشهري (ر.س) *" : "نسبة العمولة % *"}</span>
          <input name="commissionRate" type="number" step="0.01" required placeholder={type === "FIXED_MONTHLY" ? "15000" : "5"} />
        </label>
        <label className="f">
          <span>سقف الصرف دون الرجوع للمالك</span>
          <input name="spendLimit" type="number" step="0.01" defaultValue={0} />
          <span className="hint">صفر = بلا سقف</span>
        </label>
        <label className="f">
          <span>الحالة</span>
          <select name="status" defaultValue="ACTIVE">
            <option value="ACTIVE">ساري</option>
            <option value="DRAFT">مسودة</option>
          </select>
        </label>
      </div>

      <label className="f"><span>نطاق الخدمة</span><textarea name="scope" placeholder="تشغيل وتأجير، تحصيل، صيانة، تسويق…" /></label>
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : "حفظ عقد الإدارة"}</button></div>
    </form>
  );
}
