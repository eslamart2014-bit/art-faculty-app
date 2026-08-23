"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    setAppVersion(localStorage.getItem('appVersion') || "1.7");
  }, []);
  const [tab, setTab] = useState<"normal" | "first">("normal");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [firstTimeStep, setFirstTimeStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [degree, setDegree] = useState("م");

  const handleLogin = async () => {
    if (isLocked) {
      setError("تم تعليق الحساب مؤقتاً. يرجى مراجعة الإدارة.");
      return;
    }
    if (!email || !password) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) {
        setIsLocked(true);
        setError("تم قفل الحساب بسبب تجاوز 3 محاولات خاطئة. يرجى مراجعة الإدارة.");
        try {
          await fetch('/api/auth/lock', { method: 'POST', body: JSON.stringify({ email }) });
        } catch (err) {}
      } else {
        setError(`بيانات الدخول غير صحيحة. (تبقت لك ${3 - newAttempts} محاولات)`);
      }
    } else if (data.user) {
      // Check if suspended or locked
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      onLogin({ ...data.user, ...profile });
    }
  };

  const handleFirstTimeStep1 = async () => {
    if (!email || !password || !confirmPassword) {
      setError("يرجى تعبئة جميع الحقول");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    setError("");

    // Verify if email is in invitations and pending
    const { data: invCheck } = await supabase
      .from("invitations")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("status", "pending")
      .maybeSingle();

    setLoading(false);

    if (!invCheck) {
      setError("هذا البريد غير مدعو أو تم تفعيله مسبقاً.");
      return;
    }

    // Success, move to step 2 to collect user data
    setFirstTimeStep(2);
    setError("");
  };

  const handleFirstTimeStep2 = async () => {
    if (!fullName || !degree) {
      setError("يرجى إدخال الاسم والدرجة العلمية");
      return;
    }

    setLoading(true);
    setError("");

    let authUser = null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already exists")) {
        // Try to sign in instead to recover the half-created account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
           setLoading(false);
           setError("هذا الحساب مسجل مسبقاً بكلمة مرور مختلفة. جرب الدخول العادي أو اطلب من الإدارة تغيير كلمة المرور.");
           return;
        }
        authUser = signInData.user;
      } else {
        setLoading(false);
        setError("حدث خطأ أثناء التفعيل: " + error.message);
        return;
      }
    } else {
      authUser = data.user;
    }

    // Wait a brief moment for the auth trigger (if any) to create the profile, 
    // or we just explicitly upsert the profile with their new data.
    if (authUser) {
      try {
        const res = await fetch('/api/auth/register-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: authUser.id, 
            email: email, 
            fullName: fullName, 
            degree: degree 
          })
        });
        const result = await res.json();
        
        if (!result.success) {
          console.error("Error updating profile:", result.error);
        }
      } catch (err) {
        console.error("Error calling register-profile API:", err);
      }

      setLoading(false);
      alert("تم التفعيل وتحديث بياناتك بنجاح! جاري دخول النظام...");
      // Auto login them by calling onLogin with the fetched profile
      onLogin({ ...authUser, full_name: fullName, degree: degree });
    } else {
      setLoading(false);
      setError("تم التسجيل ولكن حدث خطأ في استرجاع بيانات المستخدم.");
    }
  };

  return (
    <div className="login-container">
      <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          {/* Logo placeholder, user should add app-logo.png to public folder */}
          <img
            src="/app-logo.png"
            alt="شعار فنية"
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "24px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
              border: "2px solid rgba(255,255,255,0.15)",
              display: "inline-block",
              backgroundColor: "#222" // Fallback color
            }}
          />
          <div style={{ fontSize: "14px", color: "#4CAF50", fontWeight: "bold", marginTop: "10px" }}>تحديث {appVersion}</div>
        </div>
        <h2 style={{ textAlign: "center", marginTop: "5px", marginBottom: "12px", color: "var(--primary)" }}>
          نظام التربية الفنية
        </h2>

        <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "4px", marginBottom: "15px" }}>
          <button
            onClick={() => { setTab("normal"); setError(""); }}
            style={{
              flex: 1, padding: "8px 4px", fontSize: "13px", fontWeight: "bold",
              background: tab === "normal" ? "var(--primary)" : "transparent",
              color: tab === "normal" ? "white" : "#aaa",
              border: "none", borderRadius: "8px", margin: 0, cursor: "pointer"
            }}
          >
            🔑 دخول عادي
          </button>
          <button
            onClick={() => { setTab("first"); setError(""); }}
            style={{
              flex: 1, padding: "8px 4px", fontSize: "13px", fontWeight: "bold",
              background: tab === "first" ? "var(--success)" : "transparent",
              color: tab === "first" ? "white" : "#aaa",
              border: "none", borderRadius: "8px", margin: 0, cursor: "pointer"
            }}
          >
            ✨ تفعيل لأول مرة
          </button>
        </div>

        {tab === "normal" ? (
          <div>
            <input
              type="email"
              placeholder="البريد الإلكتروني"
              style={{ textAlign: "left", direction: "ltr" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <div style={{ textAlign: "right", marginBottom: "15px", display: "flex", justifyContent: "space-between" }}>
              <span onClick={async () => {
                if (!email) { alert("أدخل بريدك الإلكتروني أولاً"); return; }
                const { error } = await supabase.auth.resetPasswordForEmail(email);
                if (error) alert("خطأ: " + error.message);
                else alert("تم إرسال رابط استعادة كلمة المرور لبريدك (إذا كان مسجلاً).");
              }} style={{ color: "var(--primary)", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}>
                نسيت كلمة المرور؟
              </span>
            </div>
            <button onClick={handleLogin} disabled={loading || isLocked} style={{ background: isLocked ? "#555" : "var(--primary)" }}>
              {loading ? "جاري التحميل..." : (isLocked ? "مغلق مؤقتاً" : "دخول النظام")}
            </button>
          </div>
        ) : (
          <div>
            {firstTimeStep === 1 ? (
              <>
                <div style={{ fontSize: "12px", color: "var(--warning)", marginBottom: "10px", lineHeight: 1.4, textAlign: "center" }}>
                  ⚠️ يشترط أن يكون بريدك الإلكتروني قد تم تسجيله مسبقاً من قِبل الأدمن.
                </div>
                <input
                  type="email"
                  placeholder="بريدك المعتمد في النظام"
                  style={{ textAlign: "left", direction: "ltr" }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="أنشئ كلمة مرور جديدة"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="تأكيد كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button onClick={handleFirstTimeStep1} disabled={loading} style={{ background: "var(--success)" }}>
                  {loading ? "جاري التحقق..." : "التالي: استكمال البيانات"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: "12px", color: "var(--success)", marginBottom: "10px", lineHeight: 1.4, textAlign: "center", fontWeight: "bold" }}>
                  ✅ تم التحقق من بريدك. يرجى إدخال بياناتك الأساسية.
                </div>
                <input
                  type="text"
                  placeholder="الاسم ثلاثي (باللغة العربية)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <label style={{ fontSize: "13px", color: "#aaa", display: "block", textAlign: "right", marginBottom: "5px" }}>الدرجة العلمية:</label>
                <select value={degree} onChange={(e) => setDegree(e.target.value)} style={{ marginBottom: "15px" }}>
                  <option value="م">معيد (م)</option>
                  <option value="م.د">مدرس مساعد (م.د)</option>
                  <option value="د">مدرس (د)</option>
                  <option value="أ.م.د">أستاذ مساعد (أ.م.د)</option>
                  <option value="أ.د">أستاذ (أ.د)</option>
                </select>
                <button onClick={handleFirstTimeStep2} disabled={loading} style={{ background: "var(--primary)" }}>
                  {loading ? "جاري الحفظ..." : "تأكيد ودخول النظام"}
                </button>
                <button onClick={() => setFirstTimeStep(1)} className="secondary" style={{ marginTop: "10px" }}>
                  رجوع
                </button>
              </>
            )}
          </div>
        )}

        {error && (
          <div style={{ color: "var(--error)", marginTop: "12px", textAlign: "center", fontWeight: "bold", fontSize: "13px", minHeight: "20px" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
