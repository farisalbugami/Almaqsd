"use client";

import { setExpenseStatus } from "./actions";

export function ApproveButtons({ id }: { id: string }) {
  return (
    <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
      <button className="btn sm" type="button" onClick={() => setExpenseStatus(id, "APPROVED")}>اعتماد</button>
      <button className="btn sm danger" type="button" onClick={() => setExpenseStatus(id, "REJECTED")}>رفض</button>
    </div>
  );
}
