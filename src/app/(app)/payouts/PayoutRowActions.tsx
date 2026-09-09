"use client";

import { markPayout } from "./actions";

export function PayoutRowActions({ id, status }: { id: string; status: string }) {
  if (status === "PAID") return null;
  return (
    <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
      {status === "DRAFT" ? (
        <button className="btn sm" type="button" onClick={() => markPayout(id, "APPROVED")}>اعتماد</button>
      ) : null}
      {status === "APPROVED" ? (
        <button className="btn sm primary" type="button" onClick={() => markPayout(id, "PAID")}>تأكيد التوريد</button>
      ) : null}
    </div>
  );
}
