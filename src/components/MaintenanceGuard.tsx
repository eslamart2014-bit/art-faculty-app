"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRef = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentIsMaintenance = false;

    const checkStatus = async () => {
      // 1. Check if user is admin to allow bypass
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile && (profile.role === 'مدير' || profile.role === 'admin' || profile.role === 'أدمن')) {
          setIsAdmin(true);
          isAdminRef.current = true;
        }
      }

      // 2. Fetch maintenance state
      const { data: settings } = await supabase.from("system_settings").select("*").single();
      if (settings) {
        currentIsMaintenance = settings.is_maintenance_mode || false;
        setIsMaintenance(currentIsMaintenance);
        setMessage(settings.maintenance_message || "تطبيقنا يخضع لعملية صيانة حالياً. نرجو المحاولة لاحقاً...");
      }
      setLoading(false);
    };

    checkStatus();

    // 3. Subscribe to realtime changes
    const channel = supabase
      .channel('system_settings_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings' },
        (payload) => {
          const newData = payload.new;
          setIsMaintenance(newData.is_maintenance_mode || false);
          setMessage(newData.maintenance_message || "تطبيقنا يخضع لعملية صيانة حالياً. نرجو المحاولة لاحقاً...");
          
          // Force reload for normal users when maintenance ends to get new app version
          if (currentIsMaintenance && !newData.is_maintenance_mode && !isAdminRef.current) {
             window.location.reload();
          }
          currentIsMaintenance = newData.is_maintenance_mode;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return null; 

  if (isMaintenance && !isAdmin) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#121212', color: '#fff',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 99999, padding: '20px', textAlign: 'center'
      }}>
        <div style={{ fontSize: '60px', marginBottom: '20px', animation: 'pulse 2s infinite' }}>🚧</div>
        <h1 style={{ color: 'var(--primary)', marginBottom: '15px' }}>وضع الصيانة</h1>
        <p style={{ fontSize: '18px', maxWidth: '400px', lineHeight: 1.6 }}>{message}</p>
        <p style={{ fontSize: '14px', color: '#888', marginTop: '30px' }}>
          ستختفي هذه الشاشة تلقائياً فور انتهاء الصيانة والتحديث.
        </p>
        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {isMaintenance && isAdmin && (
        <div style={{
          background: 'var(--warning)', color: '#000',
          textAlign: 'center', padding: '5px', fontSize: '12px',
          fontWeight: 'bold', zIndex: 10000, position: 'relative'
        }}>
          ⚠️ التطبيق حالياً في وضع الصيانة للمستخدمين (أنت تتصفح كمسؤول)
        </div>
      )}
      {children}
    </>
  );
}
