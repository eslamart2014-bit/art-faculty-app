"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

  if (!init) return <div style={{ background: "#f3f4f6", minHeight: "100vh" }}></div>;

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh", padding: "20px", direction: "rtl" }}>
      <h2 style={{ color: "#333", marginBottom: "15px", textAlign: "center" }}>بحث عن طالب</h2>
      {crs && proj && <p style={{ textAlign: "center", color: "#666", marginBottom: "20px", fontSize: "14px" }}>إضافة عمل لمشروع: {proj}</p>}
      
      <input 
        type="text" 
        placeholder="اكتب اسم الطالب أو رقمه الجامعي..." 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ccc", fontSize: "16px", marginBottom: "20px" }}
      />

      {loading && <div style={{ textAlign: "center", color: "#666" }}>جاري البحث...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {results.map(s => (
          <div 
            key={s.id} 
            onClick={() => handleSelect(s.student_code)}
            style={{ background: "#fff", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", cursor: "pointer" }}
          >
            <div style={{ fontWeight: "bold", color: "#333" }}>{s.full_name}</div>
            <div style={{ fontSize: "13px", color: "#666", marginTop: "5px" }}>
              كود: {s.student_code} | فرقة: {s.academic_year} | سكشن: {s.section}
            </div>
          </div>
        ))}
      </div>

      {tg && (
        <button 
          onClick={() => tg.close()} 
          style={{ width: "100%", marginTop: "30px", background: "#f44336", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", fontSize: "16px" }}
        >
          إلغاء وإغلاق
        </button>
      )}
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
