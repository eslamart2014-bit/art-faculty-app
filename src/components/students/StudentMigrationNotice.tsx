"use client";

import React from "react";

export type MigrationStudentInfo = {
  student_code: string;
  full_name: string;
  pin_code: string;
  academic_year?: string;
  section?: string;
  status?: string;
};

interface StudentMigrationNoticeProps {
  student?: MigrationStudentInfo | null;
  apkDownloadUrl?: string;
  apkVersion?: string;
  isTestMode?: boolean;
  onContinueToWeb?: () => void;
  onSwitchStudentCode?: (newCode: string) => void;
}

const TELEGRAM_BOT_URL = "https://t.me/NEZAMFANYAbot";
const TELEGRAM_DEEP_LINK = "tg://resolve?domain=NEZAMFANYAbot";

export default function StudentMigrationNotice(_props: StudentMigrationNoticeProps) {
  const handleGoToTelegram = () => {
    if (typeof window === "undefined") return;
    try {
      // محاولة فتح تطبيق تليجرام مباشرة عبر الـ Deep Link ثم التوجيه للرابط الرسمي
      window.location.href = TELEGRAM_DEEP_LINK;
      setTimeout(() => {
        window.location.href = TELEGRAM_BOT_URL;
      }, 350);
    } catch {
      window.location.href = TELEGRAM_BOT_URL;
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--background)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--surface)",
          border: "1px solid var(--border-light)",
          borderRadius: "16px",
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
        }}
      >
        {/* أيقونة تليجرام */}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#229ED9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.665 3.717L2.93497 10.554C1.72497 11.04 1.73197 11.715 2.71297 12.016L7.26497 13.436L17.797 6.791C18.295 6.488 18.75 6.651 18.376 6.983L9.84297 14.684H9.84097L9.84297 14.685L9.52897 19.377C9.98897 19.377 10.192 19.166 10.45 18.917L12.661 16.767L17.26 20.164C18.108 20.631 18.717 20.391 18.928 19.379L21.947 5.151C22.256 3.912 21.474 3.351 20.665 3.717Z"
              fill="#FFFFFF"
            />
          </svg>
        </div>

        {/* الجملة الوحيدة المطلوبة */}
        <h1
          style={{
            margin: 0,
            color: "var(--text)",
            fontSize: "20px",
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          تم نقل البوابة بالكامل إلى تليجرام
        </h1>

        {/* زر الانتقال إلى تليجرام */}
        <a
          href={TELEGRAM_BOT_URL}
          onClick={(e) => {
            e.preventDefault();
            handleGoToTelegram();
          }}
          style={{
            width: "100%",
            background: "#229ED9",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "14px 20px",
            fontSize: "15px",
            fontWeight: 500,
            cursor: "pointer",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxSizing: "border-box",
          }}
        >
          <span>الانتقال إلى تليجرام</span>
        </a>
      </div>
    </div>
  );
}
