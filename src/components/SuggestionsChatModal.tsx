"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  MessageSquare, 
  Inbox, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Filter, 
  RefreshCw,
  User,
  GraduationCap
} from "lucide-react";

interface SuggestionsChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function SuggestionsChatModal({ isOpen, onClose, user }: SuggestionsChatModalProps) {
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: true }, "");
    }
  }, [isOpen]);

  // Tab: suggestions (الرسائل والمقترحات) vs complaints (الشكاوى الطلابية)
  const [activeMainTab, setActiveMainTab] = useState<"suggestions" | "complaints">("suggestions");

  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Complaints State
  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [complaintFilter, setComplaintFilter] = useState<"all" | "new" | "replied">("all");
  const [replySuccessMsg, setReplySuccessMsg] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "مدير" || user?.role === "مدير مساعد";
  const activeUserId = isAdmin ? selectedUserId : user?.id;

  useEffect(() => {
    if (isOpen && user) {
      if (isAdmin) {
        fetchAllChats();
        fetchComplaints();
      } else {
        fetchMessages(user.id);
        markAsRead(user.id, false);
      }
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchAllChats = async () => {
    setLoading(true);
    const { data: chatData } = await supabase
      .from("suggestions_chat")
      .select("user_id, created_at, read_by_admin")
      .order("created_at", { ascending: false });
      
    if (chatData) {
      const userIds = Array.from(new Set(chatData.map(c => c.user_id)));
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
        
      const chatsList = userIds.map(uid => {
        const profile = profilesData?.find(p => p.id === uid);
        const unreadCount = chatData.filter(c => c.user_id === uid && !c.read_by_admin).length;
        return {
          id: uid,
          name: profile?.full_name || `مستخدم (${uid})`,
          unread: unreadCount
        };
      });
      
      setAllChats(chatsList);
    }
    setLoading(false);
  };

  const fetchMessages = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("suggestions_chat")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
      
    setMessages(data || []);
    setLoading(false);
  };

  const markAsRead = async (uid: string, byAdmin: boolean) => {
    if (byAdmin) {
      await supabase.from("suggestions_chat").update({ read_by_admin: true }).eq("user_id", uid).eq("read_by_admin", false);
    } else {
      await supabase.from("suggestions_chat").update({ read_by_user: true }).eq("user_id", uid).eq("read_by_user", false);
    }
  };

  const handleSelectUser = (uid: string) => {
    setSelectedUserId(uid);
    fetchMessages(uid);
    markAsRead(uid, true);
    setAllChats(prev => prev.map(c => c.id === uid ? { ...c, unread: 0 } : c));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeUserId) return;
    setSending(true);
    
    const newMsg = {
      user_id: activeUserId,
      message: inputText.trim(),
      is_admin: isAdmin,
      read_by_admin: isAdmin,
      read_by_user: !isAdmin
    };
    
    const { error } = await supabase.from("suggestions_chat").insert(newMsg);
    
    if (!error) {
      setInputText("");
      fetchMessages(activeUserId);
    } else {
      alert("حدث خطأ أثناء الإرسال");
    }
    setSending(false);
  };

  // جلب الشكاوى الطلابية
  const fetchComplaints = async () => {
    setLoadingComplaints(true);
    try {
      const res = await fetch("/api/admin/portal/complaints");
      const data = await res.json();
      if (data && data.complaints) {
        setComplaintsList(data.complaints);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComplaints(false);
    }
  };

  // إرسال رد رسمي على الشكوى
  const handleSendComplaintReply = async (complaintId: string) => {
    const text = replyTextMap[complaintId];
    if (!text || !text.trim()) {
      alert("يرجى كتابة نص الرد أولاً");
      return;
    }

    setSendingReplyId(complaintId);
    try {
      const res = await fetch("/api/admin/portal/reply-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaint_id: complaintId,
          reply_text: text.trim(),
          admin_name: user?.full_name || "إدارة الكلية"
        })
      });
      const data = await res.json();
      if (data && data.success) {
        setReplySuccessMsg("تم إرسال الرد الرسمي للطالب بنجاح!");
        setTimeout(() => setReplySuccessMsg(""), 3500);
        setReplyTextMap(prev => ({ ...prev, [complaintId]: "" }));
        fetchComplaints();
      } else {
        alert("فشل إرسال الرد: " + (data?.error || "خطأ غير معروف"));
      }
    } catch (e) {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setSendingReplyId(null);
    }
  };

  if (!isOpen) return null;

  const filteredComplaints = complaintsList.filter(c => {
    const isReplied = c.status === "تم الرد" || Boolean(c.officialReply);
    if (complaintFilter === "new") return !isReplied;
    if (complaintFilter === "replied") return isReplied;
    return true;
  });

  const unreadComplaintsCount = complaintsList.filter(c => c.status === "جديدة" && !c.officialReply).length;
  const unreadChatsCount = allChats.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.85)", zIndex: 1000,
      display: "flex", justifyContent: "center", alignItems: "center",
      padding: "16px"
    }} onClick={onClose}>
      
      <div style={{
        background: "#141b29", borderRadius: "16px", width: "100%", maxWidth: "680px", height: "88vh",
        display: "flex", flexDirection: "column", direction: "rtl", border: "1px solid #2a374f", overflow: "hidden",
        boxShadow: "0 10px 40px rgba(0,0,0,0.6)"
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: "12px 18px", background: "#0d131f", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isAdmin && selectedUserId && activeMainTab === "suggestions" && (
              <button 
                onClick={() => setSelectedUserId(null)} 
                style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", borderRadius: "8px", padding: "4px 8px", cursor: "pointer", fontSize: "14px" }}
              >
                🡲 العودة
              </button>
            )}
            <h3 style={{ margin: 0, color: "#fff", fontSize: "15px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>💬</span>
              <span>مركز الرسائل والشكاوى</span>
            </h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="إغلاق">✕</button>
        </div>

        {/* Tab Navigation for Admins (المقترحات vs الشكاوى الطلابية) */}
        {isAdmin && (
          <div style={{ display: "flex", background: "#0d131f", borderBottom: "1px solid #1e293b", padding: "6px 14px", gap: "8px" }}>
            <button
              onClick={() => { setActiveMainTab("suggestions"); setSelectedUserId(null); }}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "10px",
                border: activeMainTab === "suggestions" ? "1px solid #3b82f6" : "1px solid transparent",
                background: activeMainTab === "suggestions" ? "rgba(59, 130, 246, 0.15)" : "transparent",
                color: activeMainTab === "suggestions" ? "#60a5fa" : "#94a3b8",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <MessageSquare size={16} />
              <span>مقترحات الزملاء والمحادثات</span>
              {unreadChatsCount > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", borderRadius: "999px", padding: "1px 6px", fontSize: "10px" }}>
                  {unreadChatsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveMainTab("complaints"); fetchComplaints(); }}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "10px",
                border: activeMainTab === "complaints" ? "1px solid #ec4899" : "1px solid transparent",
                background: activeMainTab === "complaints" ? "rgba(236, 72, 153, 0.15)" : "transparent",
                color: activeMainTab === "complaints" ? "#f472b6" : "#94a3b8",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <Inbox size={16} />
              <span>صندوق الشكاوى الطلابية</span>
              {unreadComplaintsCount > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", borderRadius: "999px", padding: "1px 6px", fontSize: "10px", fontWeight: "bold" }}>
                  {unreadComplaintsCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Content Body */}
        {activeMainTab === "suggestions" ? (
          /* ========================================================= */
          /* تبويب: مقترحات الزملاء والمحادثات الداخلية */
          /* ========================================================= */
          <>
            {isAdmin && !selectedUserId ? (
              // قائمة محادثات الزملاء للمدير
              <div style={{ flexGrow: 1, overflowY: "auto", padding: "16px" }}>
                {loading ? <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "30px" }}>جاري التحميل...</div> : null}
                {!loading && allChats.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#64748b", marginTop: "40px", fontSize: "13px" }}>
                    لا توجد رسائل أو مقترحات جديدة من الزملاء بعد
                  </div>
                ) : null}
                
                {allChats.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => handleSelectUser(c.id)}
                    style={{ 
                      background: "#0d131f", 
                      padding: "14px", 
                      borderRadius: "12px", 
                      marginBottom: "10px", 
                      cursor: "pointer", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      border: "1px solid #1e293b",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <User size={18} />
                      </div>
                      <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>{c.name}</div>
                    </div>
                    {c.unread > 0 && (
                      <div style={{ background: "#ef4444", color: "#fff", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" }}>
                        {c.unread} جديدة
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // شاشة المحادثة الفعلية
              <>
                <div style={{ flexGrow: 1, overflowY: "auto", padding: "16px", background: "#0d131f", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {loading ? <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "20px" }}>جاري تحميل الرسائل...</div> : null}
                  {!loading && messages.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#64748b", marginTop: "40px", fontSize: "13px", lineHeight: "1.6" }}>
                      أهلاً بك! 👋<br/>يمكنك كتابة أي مقترح لتطوير المنظومة أو ملاحظة للإدارة.
                    </div>
                  ) : null}

                  {messages.map((m, idx) => {
                    const isMe = isAdmin ? m.is_admin : !m.is_admin;
                    return (
                      <div key={idx} style={{ alignSelf: isMe ? "flex-start" : "flex-end", maxWidth: "80%" }}>
                        <div style={{
                          background: isMe ? "#1d4ed8" : "#1e293b",
                          color: "#fff",
                          padding: "10px 14px",
                          borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                          fontSize: "13px",
                          lineHeight: "1.6",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}>
                          {m.message}
                        </div>
                        <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px", textAlign: isMe ? "left" : "right", padding: "0 4px" }}>
                          {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* حقل الإدخال */}
                <div style={{ padding: "12px 16px", background: "#141b29", borderTop: "1px solid #1e293b", display: "flex", gap: "8px", alignItems: "center" }}>
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="اكتب رسالتك أو مقترحك هنا..."
                    style={{ flexGrow: 1, padding: "11px 16px", borderRadius: "10px", background: "#0d131f", border: "1px solid #2a374f", color: "#fff", outline: "none", fontSize: "13px" }}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={sending || !inputText.trim()}
                    style={{ background: "#2563eb", color: "#fff", border: "none", width: "42px", height: "42px", borderRadius: "10px", display: "flex", justifyContent: "center", alignItems: "center", cursor: (sending || !inputText.trim()) ? "not-allowed" : "pointer" }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          /* ========================================================= */
          /* تبويب: صندوق الشكاوى الطلابية والردود الرسمية */
          /* ========================================================= */
          <div style={{ flexGrow: 1, overflowY: "auto", padding: "16px" }}>
            
            {/* أزرار الفلترة والتحديث */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {[
                  { id: "all", label: "الكل" },
                  { id: "new", label: `جديدة (${unreadComplaintsCount})` },
                  { id: "replied", label: "تم الرد" }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setComplaintFilter(f.id as any)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "8px",
                      border: complaintFilter === f.id ? "1px solid #ec4899" : "1px solid #1e293b",
                      background: complaintFilter === f.id ? "rgba(236, 72, 153, 0.2)" : "#0d131f",
                      color: complaintFilter === f.id ? "#fff" : "#94a3b8",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: complaintFilter === f.id ? "bold" : "normal"
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchComplaints}
                disabled={loadingComplaints}
                style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "5px 10px", borderRadius: "8px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <RefreshCw size={12} className={loadingComplaints ? "spin" : ""} />
                <span>تحديث</span>
              </button>
            </div>

            {replySuccessMsg && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px", borderRadius: "10px", marginBottom: "12px", fontSize: "12px", textAlign: "center" }}>
                {replySuccessMsg}
              </div>
            )}

            {/* قائمة الشكاوى */}
            {loadingComplaints ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>جاري تحميل الشكاوى الطلابية...</div>
            ) : filteredComplaints.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "50px 0" }}>
                <Inbox size={36} style={{ margin: "0 auto 10px auto", opacity: 0.4 }} />
                <div style={{ fontSize: "13px" }}>لا توجد شكاوى في هذا القسم</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredComplaints.map(c => {
                  const isReplied = c.status === "تم الرد" || Boolean(c.officialReply);
                  return (
                    <div 
                      key={c.id} 
                      style={{ 
                        background: "#0d131f", 
                        border: "1px solid #1e293b", 
                        borderRadius: "12px", 
                        padding: "14px",
                        borderRight: isReplied ? "4px solid #10b981" : "4px solid #f59e0b"
                      }}
                    >
                      {/* معلومات الشاكي */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                        <div>
                          <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>{c.student_name}</div>
                          <div style={{ color: "#38bdf8", fontSize: "11px" }}>
                            كود: {c.student_code} • {c.academic_year || 'الفرقة الدراسية'} • موجهة إلى: <b>{c.target_entity}</b>
                          </div>
                        </div>

                        <span style={{ 
                          fontSize: "11px", 
                          padding: "3px 8px", 
                          borderRadius: "8px", 
                          fontWeight: "bold",
                          background: isReplied ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: isReplied ? "#34d399" : "#fbbf24"
                        }}>
                          {isReplied ? "✓ تم الرد" : "⏳ جديدة"}
                        </span>
                      </div>

                      {/* موضوع ونص الشكوى */}
                      <div style={{ background: "#141b29", padding: "10px", borderRadius: "8px", border: "1px solid #1a2336", color: "#e2e8f0", fontSize: "12px", lineHeight: "1.6", marginBottom: "10px" }}>
                        {c.content}
                      </div>

                      {/* الرد الرسمي إن وجد */}
                      {c.officialReply && (
                        <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "10px", borderRadius: "8px", color: "#a7f3d0", fontSize: "12px", marginBottom: "8px" }}>
                          <div style={{ fontWeight: "bold", color: "#34d399", marginBottom: "3px", fontSize: "11px" }}>
                            رد الإدارة الرسمي ({c.officialReply.repliedBy || "الإدارة"}):
                          </div>
                          <div>{c.officialReply.text}</div>
                        </div>
                      )}

                      {/* نموذج إرسال رد جديد */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <input
                          type="text"
                          placeholder={isReplied ? "تحديث الرد الرسمي للطالب..." : "اكتب رد الإدارة الرسمي المباشر للطالب..."}
                          value={replyTextMap[c.id] || ""}
                          onChange={(e) => setReplyTextMap({ ...replyTextMap, [c.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSendComplaintReply(c.id); }}
                          style={{ flex: 1, padding: "8px 12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                        />
                        <button
                          onClick={() => handleSendComplaintReply(c.id)}
                          disabled={sendingReplyId === c.id || !replyTextMap[c.id]?.trim()}
                          style={{ background: "#10b981", color: "#fff", border: "none", padding: "0 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Send size={13} />
                          <span>{sendingReplyId === c.id ? "جاري..." : "رد"}</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
