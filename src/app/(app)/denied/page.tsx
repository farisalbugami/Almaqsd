import Link from "next/link";
import { PageHead } from "@/components/ui";

export default function Denied() {
  return (
    <>
      <PageHead title="لا تملك صلاحية" />
      <div className="content">
        <div className="card">
          <div className="empty">
            <div>هذه الشاشة خارج نطاق صلاحيات دورك الحالي.</div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn" href="/">العودة إلى لوحة المعلومات</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
