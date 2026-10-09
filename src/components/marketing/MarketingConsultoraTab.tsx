import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "Como vender mais neste mês?",
  "Qual preço devo utilizar?",
  "Vale a pena anunciar meus eventos?",
  "Meu último evento vendeu pouco. Por quê?",
];

const MarketingConsultoraTab = () => {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("marketing_consultant_messages" as any)
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages((data as any[]).filter((m: any) => m.role !== "system") as Msg[]);
      });
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (text: string) => {
    if (!text.trim() || sending || !session) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-consultant`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: next }),
      });
      if (res.status === 429) { toast.error("Muitas requisições. Tente em instantes."); setSending(false); return; }
      if (res.status === 402) { toast.error("Créditos de IA esgotados."); setSending(false); return; }
      if (!res.ok || !res.body) { toast.error("Erro na IA consultora"); setSending(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data: ")) continue;
          const payload = s.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j?.choices?.[0]?.delta?.content;
            if (delta) {
              assistant += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assistant };
                return copy;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card flex flex-col h-[70vh] max-h-[720px]">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold">IA Consultora de Marketing</h3>
          <p className="text-xs text-muted-foreground">Responde com base nos dados reais da sua conta.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Comece perguntando o que quiser sobre vendas e marketing.</p>
            <div className="flex gap-2 flex-wrap justify-center max-w-lg mx-auto">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs px-3 py-2 rounded-full border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {m.content || (sending && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder="Pergunte à IA consultora…"
            rows={1}
            className="resize-none min-h-[44px] max-h-40"
            disabled={sending}
          />
          <Button onClick={() => send(input)} disabled={sending || !input.trim()} size="icon" className="shrink-0 h-11 w-11">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketingConsultoraTab;