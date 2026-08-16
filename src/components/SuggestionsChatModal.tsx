import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface SuggestionsChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function SuggestionsChatModal({ isOpen, onClose, user }: SuggestionsChatModalProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // For Admin view
  const [allChats, setAllChats] = useState<any[]>([]); // list of users who have chats
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "مدير";
  const activeUserId = isAdmin ? selectedUserId : user?.id;

  useEffect(() => {
    if (isOpen && user) {
      if (isAdmin) {
        fetchAllChats();
      } else {
        fetchMessages(user.id);
        markAsRead(user.id, false);
      }
    }
  }, [isOpen, user]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchAllChats = async () => {
    setLoading(true);
    // Fetch distinct users who have sent messages, ideally with their profile name
    // Since Supabase doesn't support 'DISTINCT' easily on RPC without views, we can fetch all and group
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
          name: profile?.full_name || "مستخدم غير معروف",
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
    // update local unread count
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

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.85)", zIndex: 1000,
      display: "flex", justifyContent: "center", alignItems: "center"
    }} onClick={onClose}>
      
      <div style={{
        background: "#1e1e1e", borderRadius: "15px", width: "95%", maxWidth: "600px", height: "85vh",
        display: "flex", flexDirection: "column", direction: "rtl", border: "1px solid #444", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: "15px", background: "#121212", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isAdmin && selectedUserId && (
              <button onClick={() => setSelectedUserId(null)} style={{ background: "none", border: "none", color: "#4CAF50", fontSize: "20px", cursor: "pointer", padding: "0 10px" }}>🡲</button>
            )}
            <h2 style={{ margin: 0, color: "#fff", fontSize: "18px" }}>
              {isAdmin && !selectedUserId ? "💡 صندوق الاقتراحات" : "💡 اقتراحات التطوير (تواصل مع المطور)"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>

        {/* Content */}
        {isAdmin && !selectedUserId ? (
          // Admin Chat List
          <div style={{ flexGrow: 1, overflowY: "auto", padding: "15px" }}>
            {loading ? <div style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>جاري التحميل...</div> : null}
            {!loading && allChats.length === 0 ? <div style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>لا توجد رسائل بعد</div> : null}
            
            {allChats.map(c => (
              <div 
                key={c.id} 
                onClick={() => handleSelectUser(c.id)}
                style={{ background: "#222", padding: "15px", borderRadius: "10px", marginBottom: "10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #333" }}
              >
                <div style={{ color: "#fff", fontWeight: "bold" }}>{c.name}</div>
                {c.unread > 0 && (
                  <div style={{ background: "#f44336", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "12px", fontWeight: "bold" }}>
                    {c.unread}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Chat View
          <>
            <div style={{ flexGrow: 1, overflowY: "auto", padding: "15px", background: "#1a1a1a", display: "flex", flexDirection: "column", gap: "10px" }}>
              {loading ? <div style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>جاري تحميل الرسائل...</div> : null}
              {!loading && messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#666", marginTop: "40px", fontSize: "14px" }}>
                  أهلاً بك! 👋<br/>يمكنك كتابة أي اقتراح لتطوير النظام أو الإبلاغ عن مشكلة، وسيتم الرد عليك هنا.
                </div>
              ) : null}

              {messages.map((m, idx) => {
                const isMe = isAdmin ? m.is_admin : !m.is_admin;
                return (
                  <div key={idx} style={{ alignSelf: isMe ? "flex-start" : "flex-end", maxWidth: "80%" }}>
                    <div style={{
                      background: isMe ? "#128C7E" : "#333",
                      color: "#fff",
                      padding: "10px 15px",
                      borderRadius: isMe ? "15px 15px 0 15px" : "15px 15px 15px 0",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                    }}>
                      {m.message}
                    </div>
                    <div style={{ fontSize: "10px", color: "#777", marginTop: "4px", textAlign: isMe ? "left" : "right", padding: "0 5px" }}>
                      {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: "15px", background: "#121212", borderTop: "1px solid #333", display: "flex", gap: "10px" }}>
              <input 
                type="text" 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                style={{ flexGrow: 1, padding: "12px", borderRadius: "20px", background: "#222", border: "1px solid #444", color: "#fff", outline: "none", fontSize: "14px" }}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
                onClick={handleSendMessage}
                disabled={sending || !inputText.trim()}
                style={{ background: "#4CAF50", color: "#fff", border: "none", width: "45px", height: "45px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", cursor: (sending || !inputText.trim()) ? "not-allowed" : "pointer", fontSize: "20px" }}
              >
                ➤
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
