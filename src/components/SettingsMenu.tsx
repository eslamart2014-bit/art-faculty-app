"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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
}

export default function SettingsMenu({
  isOpen,
  onClose,
  user,
  onOpenAdminPanel,
  onOpenRoster,
  onOpenAdvancedSettings,
  onOpenAddCourse,
  onOpenArchive,
  onOpenSuggestions
}: SettingsMenuProps) {
  const [appVersion, setAppVersion] = useState("1.7");
  
  useEffect(() => {
    if (isOpen) {
      setAppVersion(localStorage.getItem('appVersion') || "1.7");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose();
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
          background: "rgba(0,0,0,0.6)",
          zIndex: 100,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Menu Container */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          background: "#1e1e1e",
          borderTop: "1px solid #333",
          borderRadius: "20px 20px 0 0",
          padding: "20px",
          boxSizing: "border-box",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
          zIndex: 200,
          animation: "slideUp 0.3s ease-out",
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
            padding: 15px;
            border-bottom: 1px solid #333;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            color: #fff;
          }
        `}</style>

        {["مدير", "مساعد مطور"].includes(user?.role) && (
          <div className="settings-item" onClick={() => { onClose(); onOpenAdminPanel(); }}>
            <span style={{ marginLeft: "10px" }}>🛡️</span> إدارة المستخدمين والتراخيص
          </div>
        )}

        {user?.role === "مدير" && (
          <>
            <div className="settings-item" onClick={() => { onClose(); onOpenRoster(); }}>
              <span style={{ marginLeft: "10px" }}>📋</span> إدارة كشوف الطلاب
            </div>
            <div className="settings-item" onClick={() => { onClose(); onOpenAdvancedSettings(); }}>
              <span style={{ marginLeft: "10px" }}>🧩</span> إعدادات متقدمة
            </div>
          </>
        )}

        <div className="settings-item" onClick={() => { onClose(); onOpenAddCourse(); }}>
          <span style={{ marginLeft: "10px" }}>➕</span> إضافة مقرر
        </div>
        <div className="settings-item" onClick={() => { onClose(); onOpenArchive(); }}>
          <span style={{ marginLeft: "10px" }}>🗄️</span> الأرشيف
        </div>
        <div className="settings-item" onClick={() => { onClose(); onOpenSuggestions(); }}>
          <span style={{ marginLeft: "10px" }}>💡</span> اقتراحات التطوير
        </div>

        <div
          className="settings-item"
          onClick={handleLogout}
          style={{ color: "#d32f2f", borderTop: "5px solid #333", marginTop: "10px" }}
        >
          <span style={{ marginLeft: "10px" }}>🚪</span> تسجيل خروج
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 10px",
            marginTop: "10px",
            borderTop: "1px dashed #444",
            background: "rgba(0,0,0,0.3)",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#888", fontWeight: "bold" }}>
            📌 الإصدار الحالي: <span style={{ color: "#2196F3" }}>v{appVersion}</span>
          </div>
        </div>
      </div>
    </>
  );
}
