"use client";

import { useActionState, useState } from "react";
import { money } from "@/lib/format";

type State = { error?: string; ok?: string } | undefined;
type UnitOpt = { id: string; text: string; marketRent: number | null; type: string };

export function LeaseForm({
  action,
  units,
  tenants,
  presetUnitId,
}: {
  action: (p: State, fd: FormData) => Promise<State>;
  units: UnitOpt[];
  tenants: { id: string; name: string; code: string }[];
  presetUnitId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [rent, setRent] = useState(0);
  const [inst, setInst] = useState(1);
  const [vat, setVat] = useState(0);

  const perInstallment = inst > 0 ? rent / inst : 0;
  const vatAmount = perInstallment * (vat / 100);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="err">{state.error}</div> : null}

      <div className="grid g3">
        <label className="f">
          <span>الوحدة *</span>
          <select
            name="unitId"
            defaultValue={presetUnitId ?? ""}
            required
            onChange={(e) => {
              const u = units.find((x) => x.id === e.target.value);
              if (u?.marketRent) setRent(u.marketRent);
              if (u && (u.type === "SHOP" || u.type === "OFFICE" || u.type === "SHOWROOM" || u.type === "WAREHOUSE")) setVat(15);
            }}
          >
            <option value="">— اختر الوحدة —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.text}</option>)}
          </select>
          <span className="hint">تظهر الوحدات الشاغرة والمحجوزة فقط</span>
        </label>

        <label className="f">
          <span>المستأجر *</span>
          <select name="tenantId" required defaultValue="">
            <option value="">— اختر المستأجر —</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
          </select>
        </label>

        <label className="f"><span>رقم عقد إيجار</span><input name="ejarNumber" dir="ltr" placeholder="اختياري" /></label>
        <label className="f"><span>تاريخ البداية *</span><input name="startDate" type="date" required /></label>
        <label className="f"><span>تاريخ النهاية *</span><input name="endDate" type="date" required /></label>
        <label className="f">
          <span>الإيجار السنوي (ر.س) *</span>
          <input name="annualRent" type="number" step="0.01" required value={rent || ""} onChange={(e) => setRent(Number(e.target.value))} />
        </label>
        <label className="f">
          <span>عدد الدفعات في السنة *</span>
          <select name="installments" value={inst} onChange={(e) => setInst(Number(e.target.value))}>
            <option value={1}>سنوية (1)</option>
            <option value={2}>نصف سنوية (2)</option>
            <option value={4}>ربع سنوية (4)</option>
            <option value={12}>شهرية (12)</option>
          </select>
        </label>
        <label className="f">
          <span>ضريبة القيمة المضافة %</span>
          <select name="vatRate" value={vat} onChange={(e) => setVat(Number(e.target.value))}>
            <option value={0}>معفى — سكني</option>
            <option value={15}>15% — تجاري / مكتبي</option>
          </select>
        </label>
        <label className="f"><span>التأمين المسترد (ر.س)</span><input name="deposit" type="number" step="0.01" defaultValue={0} /></label>
      </div>

      <label className="row sm" style={{ gap: 6 }}>
        <input type="checkbox" name="autoRenew" style={{ width: "auto" }} />
        <span>تجديد تلقائي عند الانتهاء</span>
      </label>

      <label className="f"><span>ملاحظات</span><textarea name="notes" /></label>

      {rent > 0 && inst > 0 ? (
        <div className="card card-body" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }}>
          <div className="b" style={{ marginBottom: 6 }}>معاينة الجدول المالي</div>
          <div className="row sm" style={{ gap: 24 }}>
            <span>قيمة الدفعة: <b>{money(perInstallment)}</b></span>
            <span>الضريبة: <b>{money(vatAmount)}</b></span>
            <span>إجمالي الدفعة: <b>{money(perInstallment + vatAmount)}</b></span>
            <span>عدد الدفعات في السنة: <b>{inst}</b></span>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            سيُنشئ النظام الفواتير تلقائياً بتواريخ استحقاقها عند حفظ العقد.
          </div>
        </div>
      ) : null}

      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "جارٍ الإنشاء…" : "إنشاء العقد وتوليد الفواتير"}</button></div>
    </form>
  );
}
