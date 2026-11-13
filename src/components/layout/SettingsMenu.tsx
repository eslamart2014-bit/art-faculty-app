"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import {
  Shield,
  Bot,
  SlidersHorizontal,
  Plus,
  Archive,
  Lightbulb,
  LogOut,
  Tag,
} from "lucide-react";

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onOpenAdminPanel: () => void;
  onOpenRoster: () => void;
  onOpenAdvancedSettings: () => void;
  onOpenAddCourse: () => void;
  onOpenArchive: () => void;
  onOpenSuggestions: () => void;
  onOpenStudentPortalHub?: () => void;
  onOpenIdentityVerification?: () => void;
}

export default function SettingsMenu({
  isOpen,
  onClose,
  user,
  onOpenAdminPanel,
  onOpenAdvancedSettings,
  onOpenAddCourse,
  onOpenArchive,
  onOpenSuggestions,
  onOpenStudentPortalHub,
}: SettingsMenuProps) {
  useEffect(() => {
    window.history.pushState({ modal: true }, "");
  }, []);

  const [appVersion, setAppVersion] = useState("4.0.1");

  useEffect(() => {
    if (isOpen) {
      setAppVersion(localStorage.getItem("appVersion") || "4.0.1");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
    } catch {}
    await supabase.auth.signOut();
    localStorage.removeItem("cached_profile");
    localStorage.removeItem("fania_staff_session_token");
    window.location.href = "/";
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(6, 9, 15, 0.75)",
          zIndex: 100,
        }}
      />

      {/* Menu Container */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          background: "var(--surface)",
          borderTop: "1px solid var(--border-light)",
          borderRadius: "16px 16px 0 0",
          padding: "16px",
          boxSizing: "border-box",
          boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.35)",
          zIndex: 200,
          animation: "slideUp 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          direction: "rtl",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .settings-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: var(--text);
            border-radius: 8px;
            transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .settings-item:hover {
            background: var(--surface-hover);
          }
          .settings-item-icon {
            width: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            flex-shrink: 0;
          }
        `}</style>

        {["مدير", "مدير مساعد"].includes(user?.role) && (
          <div className="settings-item" onClick={() => { onClose(); onOpenAdminPanel(); }}>
            <span className="settings-item-icon"><Shield size={18} strokeWidth={1.5} /></span>
            <span>إدارة المستخدمين والتراخيص</span>
          </div>
        )}

        {user?.role === "مدير" && (
          <div
            className="settings-item"
            onClick={() => { onClose(); onOpenStudentPortalHub?.(); }}
            style={{ color: "var(--accent-ink)" }}
          >
            <span className="settings-item-icon" style={{ color: "var(--accent-ink)" }}><Bot size={18} strokeWidth={1.5} /></span>
            <span>إدارة بوت الطلاب والتحكم الأكاديمي</span>
          </div>
        )}

        {user?.role === "مدير" && (
          <div className="settings-item" onClick={() => { onClose(); onOpenAdvancedSettings(); }}>
            <span className="settings-item-icon"><SlidersHorizontal size={18} strokeWidth={1.5} /></span>
            <span>إعدادات متقدمة (المقررات، الكشوف، التواريخ)</span>
          </div>
        )}

        <div className="settings-item" onClick={() => { onClose(); onOpenAddCourse(); }}>
          <span className="settings-item-icon"><Plus size={18} strokeWidth={1.5} /></span>
          <span>إضافة مقرر</span>
        </div>

        <div className="settings-item" onClick={() => { onClose(); onOpenArchive(); }}>
          <span className="settings-item-icon"><Archive size={18} strokeWidth={1.5} /></span>
          <span>الأرشيف</span>
        </div>

        <div className="settings-item" onClick={() => { onClose(); onOpenSuggestions(); }}>
          <span className="settings-item-icon"><Lightbulb size={18} strokeWidth={1.5} /></span>
          <span>اقتراحات التطوير</span>
        </div>

        <div
          className="settings-item"
          onClick={handleLogout}
          style={{ color: "var(--error-ink)", borderBottom: "none", marginTop: "8px" }}
        >
          <span className="settings-item-icon" style={{ color: "var(--error-ink)" }}><LogOut size={18} strokeWidth={1.5} /></span>
          <span>تسجيل خروج</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            marginTop: "8px",
            border: "1px solid var(--border)",
            background: "var(--bg-deep)",
            borderRadius: "8px",
          }}
        >
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Tag size={14} strokeWidth={1.5} />
            <span>الإصدار الحالي: <span style={{ color: "var(--accent-ink)" }}>v{appVersion}</span></span>
          </div>
        </div>
      </div>
    </>
  );
}
