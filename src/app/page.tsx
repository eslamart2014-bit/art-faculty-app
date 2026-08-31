"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Login from "@/components/Login";

import AppBar from "@/components/AppBar";
import SettingsMenu from "@/components/SettingsMenu";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AddCourseModal from "@/components/courses/AddCourseModal";
import CoursesList from "@/components/courses/CoursesList";
import ProfileModal from "@/components/ProfileModal";
import ArchiveModal from "@/components/ArchiveModal";
import SuggestionsChatModal from "@/components/SuggestionsChatModal";
import AdminUsersModal from "@/components/AdminUsersModal";
import AdvancedSettingsModal from "@/components/AdvancedSettingsModal";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [originalAdminUser, setOriginalAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeAdminModal, setActiveAdminModal] = useState<"users" | "roster" | null>(null);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user).then(profile => {
          setUser(profile);
          setOriginalAdminUser(['مدير', 'مدير مساعد'].includes(profile.role) ? profile : null);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const profile = await fetchProfile(session.user);
          if (profile) {
            if (profile.is_suspended || (profile.locked_until && new Date(profile.locked_until) > new Date())) {
              alert("تم إيقاف حسابك أو قفله بواسطة الإدارة.");
              await supabase.auth.signOut();
              setUser(null);
              return;
            }
            setUser(profile);
            setOriginalAdminUser(['مدير', 'مدير مساعد'].includes(profile.role) ? profile : null);
          }
        } else {
          setUser(null);
          setOriginalAdminUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (authUser: any) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
      
    // Update last_seen in the background
    if (data && !data.is_suspended) {
      supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", authUser.id).then();
    }
    
    return { ...authUser, ...data };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column" }}>
        <div className="loader-circle"></div>
        <div style={{ color: "#ccc", fontSize: "14px", marginTop: "10px" }}>جاري التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <PwaInstallPrompt />
        <Login onLogin={setUser} />
      </>
    );
  }

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column" }}>
      <PwaInstallPrompt />
      <AppBar 
        user={user} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
      />
      
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        user={user} 
        onUpdateProfile={(updates) => setUser({ ...user, ...updates })} 
      />
      
      <div style={{ padding: "15px", flexGrow: 1, overflowY: "auto" }}>
        <h2 style={{ color: "var(--success)", marginTop: "10px", marginBottom: "15px", fontSize: "18px" }}>📚 مقرراتي الدراسية</h2>
        <CoursesList user={user} refreshTrigger={refreshTrigger} />
      </div>

      {originalAdminUser && user.id !== originalAdminUser.id && (
        <div style={{ background: "#FF9800", color: "#000", padding: "10px", textAlign: "center", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>👀 أنت تتصفح بحساب: {user.full_name}</span>
          <button 
            onClick={() => setUser(originalAdminUser)}
            style={{ background: "#000", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "12px" }}
          >العودة لحسابك</button>
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
      />
    </div>
  );
}
