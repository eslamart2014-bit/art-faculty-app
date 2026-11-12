"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

function SearchContent() {
  const [init, setInit] = useState(false);
  const [tg, setTg] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const searchParams = useSearchParams();
  const crs = searchParams.get('crs') || '';
  const proj = searchParams.get('proj') || '';

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.onload = () => {
      if ((window as any).Telegram?.WebApp) {
        const webApp = (window as any).Telegram.WebApp;
        webApp.ready();
        webApp.expand();
        setTg(webApp);
      }
      setInit(true);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/students/search?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.students || []);
        }
      } catch (e) {}
      setLoading(false);
    }, 500);
    return () => clearTimeout(delay);
  }, [query]);

  const handleSelect = (code: string) => {
    if (tg) {
      tg.sendData(JSON.stringify({ type: 'SCAN_RESULT', code, crs, proj }));
      tg.close();
    } else {
      alert("Selected: " + code);
    }
  };

  if (!init) {
    return (
      <div style={{ background: "var(--background)", minHeight: "100vh", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
        جاري التحميل...
      </div>
    );
  }

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh", padding: "20px 16px", direction: "rtl", color: "var(--text)", fontFamily: "inherit" }}>
      <div style={{ maxWidth: "460px", margin: "0 auto" }}>
        <h2 style={{ color: "var(--text)", fontSize: "18px", fontWeight: 600, margin: "0 0 12px 0", textAlign: "center" }}>بحث عن طالب</h2>
        {crs && proj && (
          <p style={{ textAlign: "center", color: "var(--text-secondary)", margin: "0 0 16px 0", fontSize: "13px" }}>
            إضافة عمل لمشروع: {proj}
          </p>
        )}
        
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <input 
            type="text" 
            placeholder="اكتب اسم الطالب أو رقمه الجامعي..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              background: "var(--bg-deep)",
              color: "var(--text)",
              padding: "12px 40px 12px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-light)",
              fontSize: "14px",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
          <Search
            size={16}
            strokeWidth={1.5}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none"
            }}
          />
        </div>

        {loading && <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "13px", padding: "12px" }}>جاري البحث...</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {results.map(s => (
            <div 
              key={s.id} 
              onClick={() => handleSelect(s.student_code)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "12px 14px",
                borderRadius: "10px",
                cursor: "pointer"
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>{s.full_name}</div>
              <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                كود: {s.student_code} • فرقة: {s.academic_year} • سكشن: {s.section}
              </div>
            </div>
          ))}
        </div>

        {tg && (
          <button 
            onClick={() => tg.close()} 
            style={{
              width: "100%",
              marginTop: "24px",
              background: "rgba(239, 68, 68, 0.14)",
              color: "var(--error-ink)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            إلغاء وإغلاق
          </button>
        )}
      </div>
    </div>
  );
}

export default function BotSearchPage() {
  return (
    <Suspense fallback={<div style={{ background: "#f3f4f6", minHeight: "100vh" }}></div>}>
      <SearchContent />
    </Suspense>
  );
}
