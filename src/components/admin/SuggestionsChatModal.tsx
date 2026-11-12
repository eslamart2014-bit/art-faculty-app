"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/core/supabase";
import {
  MessageSquare,
  Inbox,
  Send,
  CheckCircle2,
  Clock,
  RefreshCw,
  User,
  ArrowRight,
  X
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
      background: "rgba(0,0,0,0.8)", zIndex: 1000,
      display: "flex", justifyContent: "center", alignItems: "center",
      padding: "16px"
    }} onClick={onClose}>
      
      <div style={{
        background: "var(--surface)", borderRadius: "16px", width: "100%", maxWidth: "680px", height: "88vh",
        display: "flex", flexDirection: "column", direction: "rtl", border: "1px solid var(--border)", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: "12px 18px", background: "var(--bg-deep)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isAdmin && selectedUserId && activeMainTab === "suggestions" && (
              <button 
                onClick={() => setSelectedUserId(null)} 
                style={{ background: "var(--surface)", border: "1px solid var(--border-light)", color: "var(--accent-ink)", borderRadius: "8px", padding: "5px 10px", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <ArrowRight size={15} strokeWidth={1.5} />
                <span>العودة</span>
              </button>
            )}
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "15px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={17} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>مركز الرسائل والشكاوى</span>
            </h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="إغلاق" aria-label="إغلاق">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Tab Navigation for Admins (المقترحات vs الشكاوى الطلابية) */}
        {isAdmin && (
          <div style={{ display: "flex", background: "var(--bg-deep)", borderBottom: "1px solid var(--border)", padding: "8px 14px", gap: "8px" }}>
            <button
              onClick={() => { setActiveMainTab("suggestions"); setSelectedUserId(null); }}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "8px",
                border: activeMainTab === "suggestions" ? "1px solid var(--primary)" : "1px solid transparent",
                background: activeMainTab === "suggestions" ? "rgba(37, 99, 235, 0.14)" : "transparent",
                color: activeMainTab === "suggestions" ? "var(--accent-ink)" : "var(--text-muted)",
                fontWeight: activeMainTab === "suggestions" ? 600 : 500,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <MessageSquare size={16} strokeWidth={1.5} />
              <span>مقترحات الزملاء والمحادثات</span>
              {unreadChatsCount > 0 && (
                <span className="tabular-nums" style={{ background: "var(--error)", color: "#fff", borderRadius: "6px", padding: "1px 6px", fontSize: "10px", fontWeight: 600 }}>
                  {unreadChatsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveMainTab("complaints"); fetchComplaints(); }}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "8px",
                border: activeMainTab === "complaints" ? "1px solid var(--primary)" : "1px solid transparent",
                background: activeMainTab === "complaints" ? "rgba(37, 99, 235, 0.14)" : "transparent",
                color: activeMainTab === "complaints" ? "var(--accent-ink)" : "var(--text-muted)",
                fontWeight: activeMainTab === "complaints" ? 600 : 500,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <Inbox size={16} strokeWidth={1.5} />
              <span>صندوق الشكاوى الطلابية</span>
              {unreadComplaintsCount > 0 && (
                <span className="tabular-nums" style={{ background: "var(--error)", color: "#fff", borderRadius: "6px", padding: "1px 6px", fontSize: "10px", fontWeight: 600 }}>
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
                {loading ? <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "30px" }}>جاري التحميل...</div> : null}
                {!loading && allChats.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-dim)", marginTop: "40px", fontSize: "13px" }}>
                    لا توجد رسائل أو مقترحات جديدة من الزملاء بعد
                  </div>
                ) : null}
                
                {allChats.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => handleSelectUser(c.id)}
                    style={{ 
                      background: "var(--bg-deep)", 
                      padding: "14px", 
                      borderRadius: "12px", 
                      marginBottom: "10px", 
                      cursor: "pointer", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      border: "1px solid var(--border)",
                      transition: "border-color 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.12)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <User size={18} strokeWidth={1.5} />
                      </div>
                      <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "14px" }}>{c.name}</div>
                    </div>
                    {c.unread > 0 && (
                      <div className="tabular-nums" style={{ background: "var(--error)", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                        {c.unread} جديدة
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // شاشة المحادثة الفعلية
              <>
                <div style={{ flexGrow: 1, overflowY: "auto", padding: "16px", background: "var(--bg-deep)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {loading ? <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "20px" }}>جاري تحميل الرسائل...</div> : null}
                  {!loading && messages.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text-dim)", marginTop: "40px", fontSize: "13px", lineHeight: "1.6" }}>
                      أهلاً بك.<br/>يمكنك كتابة أي مقترح لتطوير المنظومة أو ملاحظة للإدارة.
                    </div>
                  ) : null}

                  {messages.map((m, idx) => {
                    const isMe = isAdmin ? m.is_admin : !m.is_admin;
                    return (
                      <div key={idx} style={{ alignSelf: isMe ? "flex-start" : "flex-end", maxWidth: "80%" }}>
                        <div style={{
                          background: isMe ? "var(--primary)" : "var(--surface)",
                          color: "#fff",
                          padding: "10px 14px",
                          borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                          border: isMe ? "none" : "1px solid var(--border)",
                          fontSize: "13px",
                          lineHeight: "1.6"
                        }}>
                          {m.message}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "3px", textAlign: isMe ? "left" : "right", padding: "0 4px" }}>
                          {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* حقل الإدخال */}
                <div style={{ padding: "12px 16px", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", gap: "8px", alignItems: "center" }}>
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="اكتب رسالتك أو مقترحك هنا..."
                    style={{ flexGrow: 1, padding: "10px 14px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", outline: "none", fontSize: "13px" }}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={sending || !inputText.trim()}
                    style={{ background: "var(--primary)", color: "#fff", border: "none", width: "40px", height: "40px", borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center", cursor: (sending || !inputText.trim()) ? "not-allowed" : "pointer" }}
                  >
                    <Send size={16} strokeWidth={1.5} />
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
                    className="tabular-nums"
                    onClick={() => setComplaintFilter(f.id as any)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: complaintFilter === f.id ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: complaintFilter === f.id ? "rgba(37, 99, 235, 0.16)" : "var(--bg-deep)",
                      color: complaintFilter === f.id ? "var(--accent-ink)" : "var(--text-muted)",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: complaintFilter === f.id ? 600 : 400
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchComplaints}
                disabled={loadingComplaints}
                style={{ background: "var(--surface-hover)", border: "1px solid var(--border-light)", color: "var(--text-muted)", padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <RefreshCw size={12} strokeWidth={1.5} className={loadingComplaints ? "spin" : ""} />
                <span>تحديث</span>
              </button>
            </div>

            {replySuccessMsg && (
              <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid var(--success)", color: "var(--success-ink)", padding: "10px", borderRadius: "8px", marginBottom: "12px", fontSize: "12px", textAlign: "center", fontWeight: 500 }}>
                {replySuccessMsg}
              </div>
            )}

            {/* قائمة الشكاوى */}
            {loadingComplaints ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>جاري تحميل الشكاوى الطلابية...</div>
            ) : filteredComplaints.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-dim)", padding: "50px 0" }}>
                <Inbox size={36} strokeWidth={1.5} style={{ margin: "0 auto 10px auto", opacity: 0.45 }} />
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
                        background: "var(--bg-deep)", 
                        border: "1px solid var(--border)", 
                        borderRadius: "12px", 
                        padding: "14px",
                        borderRight: isReplied ? "3px solid var(--success)" : "3px solid var(--warning)"
                      }}
                    >
                      {/* معلومات الشاكي */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                        <div>
                          <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "14px" }}>{c.student_name}</div>
                          <div className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "11px" }}>
                            كود: {c.student_code} • {c.academic_year || 'الفرقة الدراسية'} • موجهة إلى: <strong style={{ fontWeight: 600 }}>{c.target_entity}</strong>
                          </div>
                        </div>

                        <span style={{ 
                          fontSize: "11px", 
                          padding: "3px 8px", 
                          borderRadius: "6px", 
                          fontWeight: 600,
                          background: isReplied ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.14)",
                          color: isReplied ? "var(--success-ink)" : "var(--warning-ink)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}>
                          {isReplied ? <CheckCircle2 size={12} strokeWidth={1.5} /> : <Clock size={12} strokeWidth={1.5} />}
                          <span>{isReplied ? "تم الرد" : "جديدة"}</span>
                        </span>
                      </div>

                      {/* موضوع ونص الشكوى */}
                      <div style={{ background: "var(--surface)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "12px", lineHeight: "1.6", marginBottom: "10px" }}>
                        {c.content}
                      </div>

                      {/* الرد الرسمي إن وجد */}
                      {c.officialReply && (
                        <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "10px", borderRadius: "8px", color: "var(--success-ink)", fontSize: "12px", marginBottom: "8px" }}>
                          <div style={{ fontWeight: 600, color: "var(--success-ink)", marginBottom: "3px", fontSize: "11px" }}>
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
                          style={{ flex: 1, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "12px" }}
                        />
                        <button
                          onClick={() => handleSendComplaintReply(c.id)}
                          disabled={sendingReplyId === c.id || !replyTextMap[c.id]?.trim()}
                          style={{ background: "var(--success)", color: "#fff", border: "none", padding: "0 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Send size={13} strokeWidth={1.5} />
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
