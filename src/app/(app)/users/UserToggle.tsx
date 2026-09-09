"use client";

import { toggleUser } from "./actions";

export function UserToggle({ id, active }: { id: string; active: boolean }) {
  return (
    <button className={`btn sm ${active ? "danger" : ""}`} type="button" onClick={() => toggleUser(id, !active)}>
      {active ? "تعطيل" : "تفعيل"}
    </button>
  );
}
