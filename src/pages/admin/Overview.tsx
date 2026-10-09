import { useEffect, useState } from "react";
import { TrendingUp, Users, Camera, DollarSign, Activity, ShoppingCart, Loader2, ImageIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface KpiData {
  totalRevenue: number;
  viufotoCommission: number;
  totalUsers: number;
  totalPhotographers: number;
  totalPhotos: number;
  totalVideos: number;
  activeEvents: number;
  totalOrders: number;
  paidOrders: number;
  ticketMedio: number;
}

const COMMISSION_INICIO = 0.12;
const COMMISSION_PRO = 0.10;

const categoryColors: Record<string, string> = {
  "Corrida": "hsl(18 100% 50%)",
  "Ciclismo": "hsl(186 100% 50%)",
  "Triathlon": "hsl(82 100% 50%)",
  "Natação": "hsl(210 100% 50%)",
  "Outros": "hsl(0 0% 40%)",
};

const Overview = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData>({ totalRevenue: 0, viufotoCommission: 0, totalUsers: 0, totalPhotographers: 0, totalPhotos: 0, totalVideos: 0, activeEvents: 0, totalOrders: 0, paidOrders: 0, ticketMedio: 0 });
  const [monthlyData, setMonthlyData] = useState<{ month: string; receita: number; comissao: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [topPhotographers, setTopPhotographers] = useState<{ name: string; events: number; revenue: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { count: userCount },
          { count: photoCount },
          { count: videoCount },
          { data: events },
          { data: orders },
          { data: profiles },
          { data: photographerRoles },
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("event_photos").select("*", { count: "exact", head: true }),
          supabase.from("event_videos").select("*", { count: "exact", head: true }),
          supabase.from("events").select("id, category, status, organizer_id, plan_type"),
          supabase.from("orders").select("id, amount, status, created_at, event_id"),
          supabase.from("profiles").select("user_id, full_name"),
          supabase.from("user_roles").select("user_id").eq("role", "photographer"),
        ]);

        const paidOrders = orders?.filter(o => (o.status === "pago" || o.status === "enviado")) || [];
        const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
        const activeEvents = events?.filter(e => e.status === "ativo").length || 0;

        // Calculate ViuFoto commission per event plan
        let viufotoCommission = 0;
        paidOrders.forEach(o => {
          const event = events?.find(e => e.id === o.event_id);
          const rate = event?.plan_type === "profissional" ? COMMISSION_PRO : COMMISSION_INICIO;
          viufotoCommission += Number(o.amount) * rate;
        });

        setKpis({
          totalRevenue,
          viufotoCommission,
          totalUsers: userCount || 0,
          totalPhotographers: photographerRoles?.length || 0,
          totalPhotos: photoCount || 0,
          totalVideos: videoCount || 0,
          activeEvents,
          totalOrders: orders?.length || 0,
          paidOrders: paidOrders.length,
          ticketMedio: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
        });

        // Monthly revenue (last 6 months)
        const now = new Date();
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const months: { month: string; receita: number; comissao: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthOrders = paidOrders.filter(o => {
            const od = new Date(o.created_at);
            return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
          });
          const receita = monthOrders.reduce((s, o) => s + Number(o.amount), 0);
          let comissao = 0;
          monthOrders.forEach(o => {
            const event = events?.find(e => e.id === o.event_id);
            const rate = event?.plan_type === "profissional" ? COMMISSION_PRO : COMMISSION_INICIO;
            comissao += Number(o.amount) * rate;
          });
          months.push({ month: monthNames[d.getMonth()], receita, comissao });
        }
        setMonthlyData(months);

        // Category distribution
        const catMap: Record<string, number> = {};
        events?.forEach(e => { catMap[e.category || "Outros"] = (catMap[e.category || "Outros"] || 0) + 1; });
        setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value, color: categoryColors[name] || "hsl(0 0% 40%)" })));

        // Top photographers
        if (events && profiles) {
          const orgMap: Record<string, number> = {};
          const orgRevenue: Record<string, number> = {};
          events.forEach(e => { orgMap[e.organizer_id] = (orgMap[e.organizer_id] || 0) + 1; });
          paidOrders.forEach(o => {
            const event = events.find(e => e.id === o.event_id);
            if (event) orgRevenue[event.organizer_id] = (orgRevenue[event.organizer_id] || 0) + Number(o.amount);
          });
          setTopPhotographers(
            Object.entries(orgMap)
              .map(([uid, count]) => ({ name: profiles.find(p => p.user_id === uid)?.full_name || "Sem nome", events: count, revenue: orgRevenue[uid] || 0 }))
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5)
          );
        }
      } catch (err) {
        console.error("Error fetching overview data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpiCards = [
    { label: "Comissão ViuFoto", value: fmt(kpis.viufotoCommission), icon: DollarSign, color: "text-primary" },
    { label: "Receita Total", value: fmt(kpis.totalRevenue), icon: TrendingUp, color: "text-accent" },
    { label: "Ticket Médio", value: fmt(kpis.ticketMedio), icon: ShoppingCart, color: "text-lime" },
    { label: "Usuários", value: kpis.totalUsers.toLocaleString(), icon: Users, color: "text-primary" },
    { label: "Fotógrafos Ativos", value: kpis.totalPhotographers.toLocaleString(), icon: Camera, color: "text-accent" },
    { label: "Eventos Ativos", value: kpis.activeEvents.toString(), icon: Activity, color: "text-lime" },
    { label: "Fotos Enviadas", value: kpis.totalPhotos.toLocaleString(), icon: ImageIcon, color: "text-primary" },
    { label: "Pedidos Pagos", value: kpis.paidOrders.toLocaleString(), icon: ShoppingCart, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h2">Overview</h1>
        <p className="body-small text-muted-foreground">Visão geral da plataforma — dados reais</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="glass-card p-4 hover:border-primary/20 transition-all duration-300">
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
            <p className="h3">{kpi.value}</p>
            <p className="caption text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="h5 mb-4">Receita vs Comissão (últimos 6 meses)</h3>
          {monthlyData.some(m => m.receita > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="receita" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Receita Total" />
                  <Bar dataKey="comissao" fill="hsl(18 100% 50%)" radius={[4, 4, 0, 0]} name="Comissão ViuFoto" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Nenhuma receita registrada ainda</div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="h5 mb-4">Eventos por Categoria</h3>
          {categoryData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Nenhum evento cadastrado</div>
          )}
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="h5 mb-4">🏆 Top Organizadores por Receita</h3>
        {topPhotographers.length > 0 ? (
          <div className="space-y-3">
            {topPhotographers.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.events} eventos</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-primary">{fmt(p.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
        )}
      </div>
    </div>
  );
};

export default Overview;
