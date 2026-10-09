import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { Loader2, TrendingUp, Users, Camera, Calendar, ShoppingCart, Image, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    const fetch = async () => {
      const [{ data: o }, { data: ph }, { data: vi }, { data: ev }, { data: pr }, { data: rl }] = await Promise.all([
        supabase.from("orders").select("id, amount, status, created_at, event_id"),
        supabase.from("event_photos").select("id, created_at"),
        supabase.from("event_videos").select("id, created_at"),
        supabase.from("events").select("id, name, plan_type, organizer_id, created_at, category"),
        supabase.from("profiles").select("user_id, full_name, created_at"),
        supabase.from("user_roles").select("user_id, role, created_at"),
      ]);
      setOrders(o || []);
      setPhotos(ph || []);
      setVideos(vi || []);
      setEvents(ev || []);
      setProfiles(pr || []);
      setRoles(rl || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  // Growth data
  const growthData = useMemo(() => {
    const days: { date: string; label: string; users: number; photographers: number; events: number; orders: number; revenue: number }[] = [];
    const now = new Date();
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const usersCount = profiles.filter(p => p.created_at?.startsWith(dayStr)).length;
      const photographersCount = roles.filter(r => r.role === "photographer" && r.created_at?.startsWith(dayStr)).length;
      const eventsCount = events.filter(e => e.created_at?.startsWith(dayStr)).length;
      const dayOrders = orders.filter(o => o.created_at?.startsWith(dayStr));
      const revenue = dayOrders.filter(o => (o.status === "pago" || o.status === "enviado")).reduce((s, o) => s + Number(o.amount), 0);
      days.push({ date: dayStr, label, users: usersCount, photographers: photographersCount, events: eventsCount, orders: dayOrders.length, revenue });
    }
    return days;
  }, [profiles, roles, events, orders, periodDays]);

  // Category distribution
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach(e => map.set(e.category, (map.get(e.category) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [events]);

  // Plan distribution
  const planData = useMemo(() => {
    let inicio = 0, pro = 0;
    events.forEach(e => { if (e.plan_type === "profissional") pro++; else inicio++; });
    return [{ name: "Início", value: inicio }, { name: "Profissional", value: pro }].filter(d => d.value > 0);
  }, [events]);

  // Top photographers by revenue
  const topPhotographers = useMemo(() => {
    const map = new Map<string, number>();
    orders.filter(o => (o.status === "pago" || o.status === "enviado")).forEach(o => {
      const ev = events.find(e => e.id === o.event_id);
      if (ev) map.set(ev.organizer_id, (map.get(ev.organizer_id) || 0) + Number(o.amount));
    });
    return Array.from(map.entries())
      .map(([id, revenue]) => ({ name: profiles.find(p => p.user_id === id)?.full_name || id.slice(0, 8), revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orders, events, profiles]);

  // Summary KPIs
  const kpis = useMemo(() => {
    const totalUsers = profiles.length;
    const totalPhotographers = new Set(roles.filter(r => r.role === "photographer").map(r => r.user_id)).size;
    const totalEvents = events.length;
    const paidOrders = orders.filter(o => (o.status === "pago" || o.status === "enviado"));
    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.amount), 0);
    const totalPhotos = photos.length;
    const totalVideos = videos.length;
    const conversionRate = orders.length > 0 ? (paidOrders.length / orders.length * 100) : 0;
    return { totalUsers, totalPhotographers, totalEvents, totalRevenue, totalPhotos, totalVideos, totalOrders: orders.length, paidOrders: paidOrders.length, conversionRate };
  }, [profiles, roles, events, orders, photos, videos]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="h2">Analytics Avançados</h1>
          <p className="body-small text-muted-foreground">Crescimento, engajamento e métricas da plataforma</p>
        </div>
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {(["7d", "30d", "90d"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Usuários", value: kpis.totalUsers, icon: Users },
          { label: "Fotógrafos", value: kpis.totalPhotographers, icon: Camera },
          { label: "Eventos", value: kpis.totalEvents, icon: Calendar },
          { label: "Receita Total", value: fmt(kpis.totalRevenue), icon: DollarSign },
          { label: "Fotos", value: kpis.totalPhotos.toLocaleString(), icon: Image },
          { label: "Pedidos", value: kpis.totalOrders, icon: ShoppingCart },
          { label: "Pagos", value: kpis.paidOrders, icon: TrendingUp },
          { label: "Conversão", value: `${kpis.conversionRate.toFixed(1)}%`, icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="glass-card p-4">
            <k.icon className="w-5 h-5 text-primary mb-2" />
            <p className="h3">{k.value}</p>
            <p className="caption text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Growth chart */}
      <div className="glass-card p-5">
        <h3 className="h5 mb-4">Crescimento da Plataforma</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={Math.floor(periodDays / 8)} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
              <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" name="Usuários" />
              <Area type="monotone" dataKey="events" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.15)" name="Eventos" />
              <Area type="monotone" dataKey="orders" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.1)" name="Pedidos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="h5 mb-4">Receita Diária</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={Math.floor(periodDays / 8)} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="h5 mb-4">Eventos por Categoria</h3>
          {categoryData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Plan distribution + Top photographers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="h5 mb-4">Distribuição por Plano</h3>
          {planData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="h5 mb-4">Top Fotógrafos por Receita</h3>
          {topPhotographers.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {topPhotographers.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold">{fmt(p.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem vendas</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
