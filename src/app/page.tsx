"use client";

import { preloadFacultyData } from "@/lib/admin/preloadFacultyData";
import { normalizeAcademicDegree } from "@/lib/courses/academicHelper";
import { isAndroidAppClient, isInstalledPWA, isIOSClient } from "@/lib/auth/deviceFingerprint";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/core/supabase";
import Login from "@/components/auth/Login";

import AppBar from "@/components/layout/AppBar";
import SettingsMenu from "@/components/layout/SettingsMenu";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AddCourseModal from "@/components/courses/AddCourseModal";
import CoursesList from "@/components/courses/CoursesList";
import ProfileModal from "@/components/auth/ProfileModal";
import ArchiveModal from "@/components/admin/ArchiveModal";
import SuggestionsChatModal from "@/components/admin/SuggestionsChatModal";
import AdminUsersModal from "@/components/admin/AdminUsersModal";
import AdvancedSettingsModal from "@/components/admin/AdvancedSettingsModal";
import StudentPortalHubModal from "@/components/portal-hub/StudentPortalHubModal";
import StaffReauthModal from "@/components/auth/StaffReauthModal";
import { BookOpen, Eye } from "lucide-react";
import { syncStaffSessionClient } from "@/lib/auth/staffAuthFetch";

function syncStaffSession(accessToken?: string | null) {
  if (typeof window === 'undefined') return;
  syncStaffSessionClient(accessToken || undefined).catch(() => {});
}

function clearStaffSessionCookie() {
  if (typeof window === 'undefined') return;
  fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
}

export default function Home() {
  const [user, setUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cached_profile');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return null;
  });
  const [originalAdminUser, setOriginalAdminUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          return ['مدير', 'مدير مساعد'].includes(parsed.role) ? parsed : null;
        }
      } catch (e) {}
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('cached_profile');
    }
    return true;
  });
  const [isRedirectingToStudent, setIsRedirectingToStudent] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('faculty') === '1' || urlParams.get('mode') === 'faculty') {
        localStorage.removeItem('fania_last_portal');
        localStorage.setItem('fania_app_mode', 'faculty');
        return false;
      }
      const isFaculty = Boolean(localStorage.getItem('cached_profile'));
      const isNativeApp = isAndroidAppClient();
      const isIOS = isIOSClient();
      const isPWA = isInstalledPWA();
      const hasStudentSession = Boolean(localStorage.getItem('fania_student_session'));
      const hasStudentCode = Boolean(localStorage.getItem('fania_student_code'));
      const wasStudentPortal = localStorage.getItem('fania_last_portal') === '/system' || localStorage.getItem('fania_app_mode') === 'student';

      // إذا لم يكن دكتور / مسؤول، وكان يفتح من اختصار PWA أو تطبيق أندرويد أو لديه أي أثر طالب سابق:
      if (!isFaculty && (isPWA || isNativeApp || hasStudentSession || hasStudentCode || wasStudentPortal)) {
        return true;
      }
    }
    return false;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeAdminModal, setActiveAdminModal] = useState<"users" | "roster" | null>(null);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [isPortalHubOpen, setIsPortalHubOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isFacultyMode = urlParams.get('faculty') === '1' || urlParams.get('mode') === 'faculty';
      const isFaculty = Boolean(localStorage.getItem('cached_profile'));
      const isNativeApp = isAndroidAppClient();
      const isIOS = isIOSClient();
      const isPWA = isInstalledPWA();
      const hasStudentSession = Boolean(localStorage.getItem('fania_student_session'));
      const hasStudentCode = Boolean(localStorage.getItem('fania_student_code'));
      const wasStudentPortal = localStorage.getItem('fania_last_portal') === '/system' || localStorage.getItem('fania_app_mode') === 'student';

      if (isFacultyMode) {
        localStorage.removeItem('fania_last_portal');
        localStorage.setItem('fania_app_mode', 'faculty');
      } else if (!isFaculty && (isNativeApp || isPWA || hasStudentSession || hasStudentCode || wasStudentPortal)) {
        // أي طالب يفتح الرابط الرئيسي من تطبيق الأندرويد APK أو الـ PWA القديم أو المتصفح يوجه فوراً لشاشة الانتقال لتليجرام
        setIsRedirectingToStudent(true);
        window.location.replace('/student-portal');
        return;
      }

      const openTarget = urlParams.get('open');
      if (openTarget === 'telegram_students' || openTarget === 'portal_hub') {
        setIsPortalHubOpen(true);
      } else if (openTarget === 'advanced_settings') {
        setIsAdvancedSettingsOpen(true);
      }

      const isLocalPreview =
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        (isFacultyMode || Boolean(openTarget));
      if (isLocalPreview && !localStorage.getItem('cached_profile')) {
        const localAdmin = {
          id: 'local-admin-preview',
          full_name: 'د. إسلام عبد اللطيف حسن',
          role: 'مدير',
          degree: 'د',
          can_verify_students: true,
        };
        setUser(localAdmin);
        setOriginalAdminUser(localAdmin);
        setLoading(false);
      }
    }

    // 0ms instant cached profile load for offline/instant launch
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          setUser(parsed);
          setOriginalAdminUser(['مدير', 'مدير مساعد'].includes(parsed.role) ? parsed : null);
          setLoading(false);
        }
      } catch (e) {}
    }

    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session?.user) {
          syncStaffSession(session.access_token);
          const profile = await fetchProfile(session.user);
          if (profile) {
            setUser(profile);
            setOriginalAdminUser(['مدير', 'مدير مساعد'].includes(profile?.role) ? profile : null);
          }
        } else if (typeof window !== 'undefined') {
          // Offline fallback: keep user logged in if cached_profile exists
          const cached = localStorage.getItem('cached_profile');
          if (cached) {
            const parsed = JSON.parse(cached);
            setUser(parsed);
            setOriginalAdminUser(['مدير', 'مدير مساعد'].includes(parsed.role) ? parsed : null);
          }
        }
      } catch (err) {
        console.error("Error initializing session:", err);
      } finally {
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Error getting session:", err);
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('cached_profile');
          if (cached) {
            const parsed = JSON.parse(cached);
            setUser(parsed);
            setOriginalAdminUser(['مدير', 'مدير مساعد'].includes(parsed.role) ? parsed : null);
          }
        } catch(e) {}
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session?.user) {
            syncStaffSession(session.access_token);
            const profile = await fetchProfile(session.user);
            if (profile) {
              if (profile.is_suspended || (profile.locked_until && new Date(profile.locked_until) > new Date())) {
                alert("تم إيقاف حسابك أو قفله بواسطة الإدارة.");
                await supabase.auth.signOut();
                clearStaffSessionCookie();
                setUser(null);
                setOriginalAdminUser(null);
                return;
              }
              setUser(profile);
              setOriginalAdminUser(['مدير', 'مدير مساعد'].includes(profile?.role) ? profile : null);
            }
          } else if (event === 'SIGNED_OUT') {
            // ONLY explicitly wipe user if user intentionally clicked Sign Out!
            clearStaffSessionCookie();
            setUser(null);
            setOriginalAdminUser(null);
            try { localStorage.removeItem('cached_profile'); } catch(e) {}
          }
        } catch (err) {
          console.error("onAuthStateChange error:", err);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Fire-and-forget background preloader whenever user is authenticated
  useEffect(() => {
    if (user?.id) {
      preloadFacultyData(user.id);
    }
  }, [user?.id]);

  const fetchProfile = async (authUser: any) => {
    if (!authUser?.id) return null;

    try {
      const fetchPromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OFFLINE_TIMEOUT")), 1500)
      );

      const { data } = await Promise.race([fetchPromise, timeoutPromise]) as any;
        
      if (data) {
        let isCoord = data.can_verify_students;
        if (isCoord === undefined || isCoord === null) {
          isCoord = !!authUser.user_metadata?.can_verify_students;
          if (!isCoord) {
            try {
              const cachedSettingsStr = typeof window !== 'undefined' ? localStorage.getItem("cached_system_settings") : null;
              const cachedSettings = cachedSettingsStr ? JSON.parse(cachedSettingsStr) : null;
              const coords: string[] = cachedSettings?.telegram_config?.verified_coordinators || [];
              if (coords.includes(authUser.id)) isCoord = true;
            } catch (e) {}
          }
        }
        const merged = { ...authUser, ...data, can_verify_students: isCoord };
        if (typeof window !== 'undefined') {
          // HIGH-5 FIX: Strip sensitive security fields before caching in localStorage
          // These fields must NEVER be used for security decisions from cache anyway
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { failed_attempts, locked_until, is_suspended, aud, app_metadata, user_metadata, ...safeProfile } = merged;
          localStorage.setItem('cached_profile', JSON.stringify(safeProfile));
        }
        if (!data.is_suspended) {
          supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", authUser.id).then();
        }
        return merged;
      }
    } catch (e) {
      console.log("Offline mode or error: could not fetch fresh profile");
    }
    
    // Offline fallback: use cached profile
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.id === authUser.id) {
            return parsed;
          }
        }
      } catch (e) {}
    }

    // Fallback profile if profile row was missing in DB (Self-heal)
    const userMeta = authUser.user_metadata || {};
    const fallbackProfile = {
      id: authUser.id,
      email: authUser.email,
      full_name: userMeta.full_name || authUser.email?.split('@')[0] || 'عضو هيئة تدريس',
      degree: normalizeAcademicDegree(userMeta.degree || 'د'),
      role: 'عضو هيئة تدريس',
      can_verify_students: !!userMeta.can_verify_students,
      is_suspended: false,
      ...authUser
    };

    // Attempt to create the missing profile row in the database so it never fails again
    try {
      supabase.from('profiles').upsert({
        id: authUser.id,
        email: authUser.email,
        full_name: fallbackProfile.full_name,
        degree: fallbackProfile.degree,
        role: 'عضو هيئة تدريس',
        is_suspended: false
      }, { onConflict: 'id' }).then();
    } catch (healErr) {
      console.error("Self-heal profile insert error:", healErr);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cached_profile', JSON.stringify(fallbackProfile));
      } catch (e) {}
    }

    return fallbackProfile;
  };

  if (isRedirectingToStudent) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--background)",
        color: "var(--accent-ink)",
        direction: "rtl"
      }}>
        <div className="loader-circle" />
        <div style={{ fontSize: "15px", fontWeight: 500, color: "var(--text)" }}>جاري فتح بوابة الطلاب</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>نظام التربية الفنية</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column", background: "var(--background)" }}>
        <div className="loader-circle"></div>
        <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "8px" }}>جاري التحميل</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div style={{ padding: "0", maxWidth: "880px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        refreshTrigger={refreshTrigger}
      />
      
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        user={user} 
        onUpdateProfile={(updates) => {
          const updated = { ...user, ...updates };
          setUser(updated);
          try {
            // Strip sensitive fields (same as fetchProfile cache logic)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { failed_attempts, locked_until, is_suspended, aud, app_metadata, user_metadata, ...safeUpdated } = updated;
            localStorage.setItem('cached_profile', JSON.stringify(safeUpdated));
          } catch (e) {}
        }} 
      />
      
      <div style={{ padding: "16px", flexGrow: 1, overflowY: "auto" }}>
        <h2 style={{ color: "var(--text)", marginTop: "4px", marginBottom: "16px", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
          <BookOpen size={18} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
          <span>مقرراتي الدراسية</span>
        </h2>
        <CoursesList user={user} refreshTrigger={refreshTrigger} />
      </div>

      {originalAdminUser && user.id !== originalAdminUser.id && (
        <div style={{ background: "rgba(245, 158, 11, 0.14)", borderTop: "1px solid rgba(245, 158, 11, 0.3)", color: "var(--warning-ink)", padding: "8px 16px", fontWeight: 500, fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Eye size={16} strokeWidth={1.5} />
            <span>أنت تتصفح بحساب: {user.full_name}</span>
          </span>
          <button 
            onClick={() => setUser(originalAdminUser)}
            className="btn-compact"
            style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-light)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
          >العودة لحسابي</button>
        </div>
      )}

      {originalAdminUser?.role === 'مدير' && (
        <AdminDashboard activeModal={activeAdminModal} onClose={() => setActiveAdminModal(null)} />
      )}

      <AddCourseModal 
        isOpen={isAddCourseOpen} 
        onClose={() => setIsAddCourseOpen(false)} 
        user={user} 
        onCourseAdded={() => setRefreshTrigger(prev => prev + 1)} 
      />

      {isSettingsOpen && (
        <SettingsMenu 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          user={user}
          onOpenAdminPanel={() => setActiveAdminModal("users")}
          onOpenRoster={() => setActiveAdminModal("roster")}
          onOpenAdvancedSettings={() => setIsAdvancedSettingsOpen(true)}
          onOpenAddCourse={() => setIsAddCourseOpen(true)}
          onOpenArchive={() => setIsArchiveOpen(true)}
          onOpenSuggestions={() => setIsSuggestionsOpen(true)}
          onOpenStudentPortalHub={() => setIsPortalHubOpen(true)}
          onOpenIdentityVerification={() => window.open('/coordinator', '_blank')}
        />
      )}

      <ArchiveModal 
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        user={user}
        onItemRestored={() => setRefreshTrigger(prev => prev + 1)}
      />

      <SuggestionsChatModal 
        isOpen={isSuggestionsOpen}
        onClose={() => setIsSuggestionsOpen(false)}
        user={user}
      />

      <AdminUsersModal
        isOpen={activeAdminModal === "users"}
        onClose={() => setActiveAdminModal(null)}
        adminUser={originalAdminUser || user}
        onImpersonate={(targetUser) => setUser(targetUser)}
      />

      <AdvancedSettingsModal
        isOpen={isAdvancedSettingsOpen}
        onClose={() => setIsAdvancedSettingsOpen(false)}
        user={user}
        onOpenRoster={() => {
          setIsAdvancedSettingsOpen(false);
          setActiveAdminModal("roster");
        }}
        onOpenPortalHub={() => {
          setIsAdvancedSettingsOpen(false);
          setIsPortalHubOpen(true);
        }}
      />

      <StudentPortalHubModal
        isOpen={isPortalHubOpen}
        onClose={() => setIsPortalHubOpen(false)}
        user={user}
        onOpenIdentityModal={() => window.open('/coordinator', '_blank')}
      />

      <StaffReauthModal />
    </div>
  );
}
