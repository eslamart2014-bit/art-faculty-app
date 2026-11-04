"use client";

import StudentPortalHubModal from "@/components/portal-hub/StudentPortalHubModal";

const PREVIEW_ADMIN = {
  id: "local-admin-preview",
  full_name: "د. إسلام عبد اللطيف حسن",
  role: "مدير",
  degree: "د",
  can_verify_students: true,
};

export default function AdminPreviewPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#070b14", direction: "rtl" }}>
      <StudentPortalHubModal
        isOpen={true}
        onClose={() => {
          window.location.href = "/?faculty=1";
        }}
        user={PREVIEW_ADMIN}
        onOpenIdentityModal={() => window.open("/coordinator", "_blank")}
      />
    </div>
  );
}
