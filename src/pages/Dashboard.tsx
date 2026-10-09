import DashboardSidebar from "@/components/DashboardSidebar";
import { Link } from "react-router-dom";
import {
  Camera, Video, DollarSign, ShoppingCart, TrendingUp, PlusCircle,
  Upload, Eye, Store, MapPin, ImageIcon, Flame, ArrowRight, AlertTriangle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import LevelProgressCard from "@/components/levels/LevelProgressCard";
import QuickUploadModal from "@/components/dashboard/QuickUploadModal";
import { getCoverUrl } from "@/lib/eventCover";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";
import { PageTitle, PageSubtitle, SectionTitle, CardTitle, Caption } from "@/components/ui/Typography";

/* ── animated counter ── */
function AnimatedNumber({ value, prefix = "", duration = 1200 }: { value: number; prefix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);
  return <>{prefix}{display.toLocaleString("pt-BR")}</>;
}

const Dashboard = () => {
  const { user, profile, displayName } = useAuth();
  const firstName = displayName?.split(" ")[0] || "Fotógrafo";

  const [uploadType, setUploadType] = useState<"photos" | "videos" | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const EVENTS_PAGE_SIZE = 9;
  const eventsRef = useRef<HTMLDivElement>(null);

  /* ── events ── */
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["my-events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organizer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  /* ── orders for my events ── */
  const eventIds = events.map((e) => e.id);
  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders-dashboard", eventIds],
    queryFn: async () => {
      if (!eventIds.length) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("event_id", eventIds);
      if (error) throw error;
      return data;
    },
    enabled: eventIds.length > 0,
  });

  /* ── photos count ── */
  const { data: photosCount = 0 } = useQuery({
    queryKey: ["my-photos-count", eventIds],
    queryFn: async () => {
      if (!eventIds.length) return 0;
      const { count, error } = await supabase
        .from("event_photos")
        .select("id", { count: "exact", head: true })
        .in("event_id", eventIds);
      if (error) throw error;
      return count || 0;
    },
    enabled: eventIds.length > 0,
  });

  /* ── videos count ── */
  const { data: videosCount = 0 } = useQuery({
    queryKey: ["my-videos-count", eventIds],
    queryFn: async () => {
      if (!eventIds.length) return 0;
      const { count, error } = await supabase
        .from("event_videos")
        .select("id", { count: "exact", head: true })
        .in("event_id", eventIds);
      if (error) throw error;
      return count || 0;
    },
    enabled: eventIds.length > 0,
  });

  /* ── order items for sold counts ── */
  const paidOrders = orders.filter((o) => o.status === "pago" || o.status === "enviado");
  const paidOrderIds = paidOrders.map((o) => o.id);

  const { data: orderItems = [] } = useQuery({
    queryKey: ["my-order-items", paidOrderIds],
    queryFn: async () => {
      if (!paidOrderIds.length) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", paidOrderIds);
      if (error) throw error;
      return data;
    },
    enabled: paidOrderIds.length > 0,
  });

  /* ── KPIs ── */
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthPaid = monthOrders.filter((o) => o.status === "pago" || o.status === "enviado");

  const revenue = monthPaid.reduce((sum, o) => sum + Number(o.amount), 0);
  const photosSold = orderItems.filter((i) => i.photo_id).length;
  const videosSold = orderItems.filter((i) => i.video_id).length;
  const totalOrders = monthOrders.length;
  const ticketMedio = monthPaid.length > 0 ? revenue / monthPaid.length : 0;

  /* ── chart data (last 6 months) ── */
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (5 - i), 1);
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const m = d.getMonth();
    const y = d.getFullYear();
    const total = orders
      .filter((o) => {
        const od = new Date(o.created_at);
        return od.getMonth() === m && od.getFullYear() === y && (o.status === "pago" || o.status === "enviado");
      })
      .reduce((s, o) => s + Number(o.amount), 0);
    return { name: label, valor: total };
  });

  /* ── motivational messages ── */
  const getMessage = () => {
    if (revenue > 500) return "Mês está indo muito bem! 🚀";
    if (totalOrders > 0) return "Você já tem pedidos esse mês 💪";
    if (events.length > 0) return "Seus eventos estão prontos para vender!";
    return "Crie seu primeiro evento e comece a faturar!";
  };

  const statusLabel = (s: string) => {
    if (s === "ativo") return "Ativo";
    if (s === "em_breve") return "Em Breve";
    return "Inativo";
  };

  const statusClasses = (s: string) => {
    if (s === "ativo") return "bg-emerald-500/10 text-emerald-600";
    if (s === "em_breve") return "bg-yellow-500/10 text-yellow-600";
    return "bg-muted text-muted-foreground";
  };

  const isLoading = eventsLoading;

  /* ── wallet status ── */
  const walletConfigured = !!profile?.cpf_cnpj;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-8 overflow-auto space-y-6">
        {/* ── WALLET WARNING ── */}
        {!isLoading && !walletConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Configure seu recebimento para começar a vender</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Para vender, complete seus dados em Configurações › Minha Conta (nome, CPF e telefone) e ative o recebimento na aba Carteira.
              </p>
            </div>
            <Link
              to="/dashboard/configuracoes?tab=carteira"
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all whitespace-nowrap flex items-center gap-2"
            >
              Configurar recebimento
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <PageTitle>
              Bem-vindo de volta, {firstName} 👋
            </PageTitle>
            <PageSubtitle className="mt-1">
              Aqui está o resumo do seu desempenho · <span className="text-primary font-medium">{getMessage()}</span>
            </PageSubtitle>
          </div>
        </div>

        {/* ── KPI CARDS ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Faturamento do mês", value: revenue, icon: DollarSign, color: "text-primary", prefix: "R$ ", highlight: true },
              { label: "Fotos vendidas", value: photosSold, icon: Camera, color: "text-emerald-500", prefix: "" },
              { label: "Vídeos vendidos", value: videosSold, icon: Video, color: "text-blue-500", prefix: "" },
              { label: "Pedidos no mês", value: totalOrders, icon: ShoppingCart, color: "text-amber-500", prefix: "" },
              { label: "Ticket médio", value: Math.round(ticketMedio), icon: TrendingUp, color: "text-violet-500", prefix: "R$ " },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`group rounded-xl border border-border p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                  stat.highlight ? "bg-primary/5 border-primary/20" : "bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.highlight ? "bg-primary/10" : "bg-muted"}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <SectionTitle className={`text-xl sm:text-2xl ${stat.highlight ? "text-primary" : "text-foreground"}`}>
                  <AnimatedNumber value={stat.value} prefix={stat.prefix} />
                </SectionTitle>
                <Caption className="sm:text-xs mt-1">{stat.label}</Caption>
              </div>
            ))}
          </div>
        )}

        {/* ── QUICK ACTIONS ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionTitle className="text-base sm:text-lg mb-4">🎯 Comece por aqui</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              to="/dashboard/criar-evento"
              className="flex items-center gap-3 p-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
            >
              <PlusCircle className="w-5 h-5" />
              Criar novo evento
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Link>
            <button
              type="button"
              onClick={() => setUploadType("photos")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background text-foreground font-medium text-sm hover:bg-muted transition-all text-left"
            >
              <Upload className="w-5 h-5 text-primary" />
              Enviar fotos
            </button>
            <button
              type="button"
              onClick={() => setUploadType("videos")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background text-foreground font-medium text-sm hover:bg-muted transition-all text-left"
            >
              <Video className="w-5 h-5 text-primary" />
              Enviar vídeos
            </button>
            <Link
              to="/dashboard/financeiro"
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background text-foreground font-medium text-sm hover:bg-muted transition-all"
            >
              <DollarSign className="w-5 h-5 text-primary" />
              Ver vendas
            </Link>
          </div>
        </div>

        {/* ── NÍVEL & PROGRESSO ── */}
        <LevelProgressCard />

        {/* ── CHART + LOJA ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <h3 className="h5 text-foreground mb-4">📈 Faturamento dos últimos 6 meses</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Faturamento"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Loja card */}
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Minha loja de fotos</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Personalize sua vitrine, cores, logo e links.
              </p>
            </div>
            <Link
              to="/dashboard/configuracoes"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              Personalizar loja
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* ── EVENTS GRID ── */}
        <div ref={eventsRef}>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Meus Eventos</SectionTitle>
            <span className="text-xs text-muted-foreground">
              {events.length} evento(s){events.length > EVENTS_PAGE_SIZE ? ` · página ${eventsPage} de ${Math.ceil(events.length / EVENTS_PAGE_SIZE)}` : ""}
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">Nenhum evento criado ainda</p>
              <Link
                to="/dashboard/criar-evento"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Criar primeiro evento
              </Link>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.slice((eventsPage - 1) * EVENTS_PAGE_SIZE, eventsPage * EVENTS_PAGE_SIZE).map((event) => (
                <Link
                  key={event.id}
                  to={`/dashboard/evento/${event.id}`}
                  className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  {/* Cover */}
                  <div className="h-32 bg-muted relative overflow-hidden">
                    {event.cover_url ? (
                      <img src={getCoverUrl(event.cover_url, 600) ?? undefined} alt={event.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClasses(event.status)}`}>
                      {statusLabel(event.status)}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {event.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>{new Date(event.event_date).toLocaleDateString("pt-BR")}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{event.category}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {events.length > EVENTS_PAGE_SIZE && (() => {
              const totalPages = Math.ceil(events.length / EVENTS_PAGE_SIZE);
              const go = (p: number) => {
                if (p < 1 || p > totalPages) return;
                setEventsPage(p);
                setTimeout(() => eventsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              };
              const pages: (number | "ellipsis")[] = [];
              for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || Math.abs(i - eventsPage) <= 1) pages.push(i);
                else if (pages[pages.length - 1] !== "ellipsis") pages.push("ellipsis");
              }
              return (
                <Pagination className="mt-6">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); go(eventsPage - 1); }} />
                    </PaginationItem>
                    {pages.map((p, i) => (
                      <PaginationItem key={i}>
                        {p === "ellipsis" ? <PaginationEllipsis /> : (
                          <PaginationLink href="#" isActive={p === eventsPage} onClick={(e) => { e.preventDefault(); go(p); }}>{p}</PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => { e.preventDefault(); go(eventsPage + 1); }} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              );
            })()}
            </>
          )}
        </div>

        {/* ── STATS FOOTER ── */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">{photosCount} fotos enviadas</span>
          </div>
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-500" />
            <span className="text-muted-foreground">{videosCount} vídeos enviados</span>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="text-muted-foreground">{events.filter((e) => e.status === "ativo").length} eventos ativos</span>
          </div>
        </div>
      </main>
      <QuickUploadModal
        open={uploadType !== null}
        type={uploadType ?? "photos"}
        onClose={() => setUploadType(null)}
      />
    </div>
  );
};

export default Dashboard;
