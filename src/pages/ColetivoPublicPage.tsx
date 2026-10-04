import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Camera, MapPin, ArrowLeft, Send, Loader2 } from "lucide-react";
import ClientNavbar from "@/components/ClientNavbar";
import Footer from "@/components/Footer";

interface MembroPublico {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  portfolio_slug: string | null;
}

function useColetivoPublico(slug: string | undefined) {
  return useQuery({
    queryKey: ["coletivo-publico", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data: coletivo, error } = await supabase
        .from("coletivos_publico" as any)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!coletivo) return null;

      const c = coletivo as any;

      const [{ data: membersRaw }, { data: events }] = await Promise.all([
        supabase
          .from("coletivo_members")
          .select("user_id")
          .eq("coletivo_id", c.id)
          .eq("status", "ativo"),
        supabase
          .from("events")
          .select("location")
          .eq("coletivo_id", c.id)
          .eq("visibility", true),
      ]);

      const userIds = (membersRaw || []).map((m: any) => m.user_id);
      let membros: MembroPublico[] = [];
      if (userIds.length > 0) {
        const [{ data: profiles }, { data: sites }] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds),
          supabase.from("photographer_sites_public" as any).select("user_id, slug").in("user_id", userIds),
        ]);
        const siteBySlugUser = new Map((sites || []).map((s: any) => [s.user_id, s.slug]));
        membros = (profiles || []).map((p: any) => ({
          id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          portfolio_slug: siteBySlugUser.get(p.user_id) || null,
        }));
      }

      const cidades = new Set((events || []).map((e: any) => e.location).filter(Boolean));

      return {
        coletivo: c,
        membros,
        totalEventos: events?.length || 0,
        totalCidades: cidades.size,
      };
    },
    enabled: !!slug,
  });
}

const ColetivoPublicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useColetivoPublico(slug);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleContact = async () => {
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      toast.error("Preencha nome, e-mail e mensagem.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from("coletivo_leads" as any).insert({
        coletivo_id: data!.coletivo.id,
        name: contactName.trim(),
        email: contactEmail.trim(),
        message: contactMessage.trim(),
      });
      if (error) throw error;
      setSent(true);
      toast.success("Mensagem enviada! O coletivo vai te responder em breve.");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ClientNavbar />
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="text-center">
            <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-foreground">Coletivo não encontrado</h1>
            <Link to="/" className="text-primary hover:underline font-medium">Voltar ao início</Link>
          </div>
        </div>
      </div>
    );
  }

  const { coletivo, membros, totalEventos, totalCidades } = data;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ClientNavbar />

      <header className="pt-20 pb-6 bg-gradient-to-br from-primary to-primary/80">
        <div className="container mx-auto px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </Link>
          <div className="flex items-center gap-4">
            {coletivo.avatar_url ? (
              <img src={coletivo.avatar_url} alt="" className="w-16 h-16 rounded-full border-2 border-white/40 object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">
                {(coletivo.name || "?")[0]}
              </div>
            )}
            <div>
              <p className="text-white/70 text-xs uppercase tracking-wide">Coletivo de fotógrafos</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{coletivo.name}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 flex-1 space-y-10 max-w-4xl">
        {coletivo.description && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{coletivo.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="glass-card p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{membros.length}</p>
            <p className="text-xs text-muted-foreground">Fotógrafos</p>
          </div>
          <div className="glass-card p-4 text-center">
            <Camera className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{totalEventos}</p>
            <p className="text-xs text-muted-foreground">Eventos cobertos</p>
          </div>
          <div className="glass-card p-4 text-center col-span-2 sm:col-span-1">
            <MapPin className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{totalCidades}</p>
            <p className="text-xs text-muted-foreground">Cidades atendidas</p>
          </div>
        </div>

        <section>
          <h2 className="font-bold text-lg text-foreground mb-4">Fotógrafos do coletivo</h2>
          {membros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fotógrafo ativo no momento.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {membros.map((m) => {
                const card = (
                  <div className="glass-card p-4 text-center hover:border-primary/40 transition-all h-full">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover mx-auto mb-2" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-2 text-foreground font-bold">
                        {(m.full_name || "?")[0]}
                      </div>
                    )}
                    <p className="text-xs font-semibold text-foreground truncate">{m.full_name || "Fotógrafo"}</p>
                  </div>
                );
                return m.portfolio_slug ? (
                  <Link key={m.id} to={`/fotografo/${m.portfolio_slug}/portfolio`}>{card}</Link>
                ) : (
                  <div key={m.id}>{card}</div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card p-6 max-w-lg mx-auto w-full">
          <h2 className="font-bold text-lg text-foreground mb-1">Quero contratar esse coletivo</h2>
          <p className="text-sm text-muted-foreground mb-4">Vai organizar um evento grande? Fale direto com o grupo.</p>
          {sent ? (
            <p className="text-sm text-emerald-600 font-medium">Mensagem enviada! Em breve o coletivo entra em contato.</p>
          ) : (
            <div className="space-y-3">
              <input
                placeholder="Seu nome"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm outline-none focus:border-primary"
              />
              <input
                type="email"
                placeholder="Seu e-mail"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm outline-none focus:border-primary"
              />
              <textarea
                placeholder="Conte sobre o seu evento (data, local, tipo de cobertura...)"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm outline-none focus:border-primary resize-none"
              />
              <button
                onClick={handleContact}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar mensagem
              </button>
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default ColetivoPublicPage;
