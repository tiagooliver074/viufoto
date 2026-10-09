import { useEffect, useState, useMemo } from "react";
import { DollarSign, TrendingUp, CreditCard, ShoppingCart, Loader2, Search, Filter, Download, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const COMMISSION_INICIO = 0.12;
const COMMISSION_PRO = 0.10;

const AdminFinance = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  // Filters
  const [searchTx, setSearchTx] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterPhotographer, setFilterPhotographer] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const [{ data: o }, { data: e }, { data: p }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("events").select("id, name, plan_type, organizer_id"),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      setOrders(o || []);
      setEvents(e || []);
      setProfiles(p || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterEvent !== "all" && o.event_id !== filterEvent) return false;
      if (filterPhotographer !== "all") {
        const ev = events.find(e => e.id === o.event_id);
        if (ev?.organizer_id !== filterPhotographer) return false;
      }
      if (filterDateFrom && new Date(o.created_at) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(o.created_at) > new Date(filterDateTo + "T23:59:59")) return false;
      if (searchTx) {
        const s = searchTx.toLowerCase();
        const ev = events.find(e => e.id === o.event_id);
        const ph = profiles.find(p => p.user_id === ev?.organizer_id);
        if (!o.client_name?.toLowerCase().includes(s) && !ph?.full_name?.toLowerCase().includes(s) && !ev?.name?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [orders, events, profiles, filterStatus, filterEvent, filterPhotographer, filterDateFrom, filterDateTo, searchTx]);

  const stats = useMemo(() => {
    const paid = filtered.filter(o => (o.status === "pago" || o.status === "enviado"));
    const pending = filtered.filter(o => o.status === "aguardando_pagamento");
    const totalRev = paid.reduce((s, o) => s + Number(o.amount), 0);
    let commission = 0;
    paid.forEach(o => {
      const ev = events.find(e => e.id === o.event_id);
      const rate = ev?.plan_type === "profissional" ? COMMISSION_PRO : COMMISSION_INICIO;
      commission += Number(o.amount) * rate;
    });
    return {
      totalRevenue: totalRev,
      commission,
      pendingRevenue: pending.reduce((s, o) => s + Number(o.amount), 0),
      paidCount: paid.length,
      pendingCount: pending.length,
      ticketMedio: paid.length > 0 ? totalRev / paid.length : 0,
    };
  }, [filtered, events]);

  const monthlyData = useMemo(() => {
    const paid = filtered.filter(o => (o.status === "pago" || o.status === "enviado"));
    const now = new Date();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const months: { month: string; receita: number; comissao: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mo = paid.filter(o => { const od = new Date(o.created_at); return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear(); });
      const rec = mo.reduce((s, o) => s + Number(o.amount), 0);
      let com = 0;
      mo.forEach(o => { const ev = events.find(e => e.id === o.event_id); com += Number(o.amount) * (ev?.plan_type === "profissional" ? COMMISSION_PRO : COMMISSION_INICIO); });
      months.push({ month: monthNames[d.getMonth()], receita: rec, comissao: com });
    }
    return months;
  }, [filtered, events]);

  const planDistribution = useMemo(() => {
    const paid = filtered.filter(o => (o.status === "pago" || o.status === "enviado"));
    let inicio = 0, pro = 0;
    paid.forEach(o => {
      const ev = events.find(e => e.id === o.event_id);
      if (ev?.plan_type === "profissional") pro += Number(o.amount);
      else inicio += Number(o.amount);
    });
    return [
      { name: "Início", value: inicio },
      { name: "Profissional", value: pro },
    ].filter(d => d.value > 0);
  }, [filtered, events]);

  // Unique photographers for filter
  const photographerOptions = useMemo(() => {
    const ids = [...new Set(events.map(e => e.organizer_id))];
    return ids.map(id => ({ id, name: profiles.find(p => p.user_id === id)?.full_name || "—" })).sort((a, b) => a.name.localeCompare(b.name));
  }, [events, profiles]);

  const transactions = useMemo(() => {
    return filtered.slice(0, 100).map(o => {
      const event = events.find(e => e.id === o.event_id);
      const photographer = profiles.find(p => p.user_id === event?.organizer_id);
      const rate = event?.plan_type === "profissional" ? COMMISSION_PRO : COMMISSION_INICIO;
      const commission = Number(o.amount) * rate;
      return {
        id: o.id,
        idShort: o.id.slice(0, 8),
        client: o.client_name,
        photographer: photographer?.full_name || "—",
        event: event?.name || "—",
        amount: Number(o.amount),
        commission,
        photographerAmount: Number(o.amount) - commission,
        status: o.status,
        date: o.created_at,
        method: o.payment_method,
        asaasId: o.asaas_payment_id,
      };
    });
  }, [filtered, events, profiles]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const statusLabel: Record<string, string> = { pago: "Pago", aguardando_pagamento: "Pendente", enviado: "Enviado", cancelado: "Cancelado" };
  const statusColor: Record<string, string> = { pago: "text-green-500", aguardando_pagamento: "text-amber-500", cancelado: "text-destructive", enviado: "text-primary" };
  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

  const exportCSV = () => {
    const header = "ID,Cliente,Fotógrafo,Evento,Total,Comissão,Fotógrafo(R$),Status,Data,Método\n";
    const rows = transactions.map(t => `${t.idShort},${t.client},${t.photographer},${t.event},${t.amount},${t.commission.toFixed(2)},${t.photographerAmount.toFixed(2)},${statusLabel[t.status] || t.status},${new Date(t.date).toLocaleDateString("pt-BR")},${t.method || "—"}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `financeiro_viufoto_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro Global</h1>
          <p className="text-sm text-muted-foreground">Receita, comissões e transações com filtros avançados</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full mt-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none">
              <option value="all">Todos</option>
              <option value="pago">Pago</option>
              <option value="aguardando_pagamento">Pendente</option>
              <option value="enviado">Enviado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Evento</label>
            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="w-full mt-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none">
              <option value="all">Todos</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fotógrafo</label>
            <select value={filterPhotographer} onChange={e => setFilterPhotographer(e.target.value)} className="w-full mt-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none">
              <option value="all">Todos</option>
              {photographerOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data início</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full mt-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data fim</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full mt-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilterStatus("all"); setFilterEvent("all"); setFilterPhotographer("all"); setFilterDateFrom(""); setFilterDateTo(""); setSearchTx(""); }} className="w-full px-3 py-1.5 rounded-lg bg-secondary text-sm hover:bg-secondary/80 transition-colors">
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "Comissão ViuFoto", value: fmt(stats.commission), icon: DollarSign },
          { label: "Receita Total", value: fmt(stats.totalRevenue), icon: TrendingUp },
          { label: "Ticket Médio", value: fmt(stats.ticketMedio), icon: ShoppingCart },
          { label: "Pedidos Pagos", value: stats.paidCount.toString(), icon: CreditCard },
          { label: "Pendentes", value: `${stats.pendingCount} (${fmt(stats.pendingRevenue)})`, icon: ShoppingCart },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card p-4">
            <kpi.icon className="w-5 h-5 text-primary mb-2" />
            <p className="text-xl font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Receita vs Comissão (6 meses)</h3>
          {monthlyData.some(m => m.receita > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="receita" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Receita" />
                  <Bar dataKey="comissao" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Comissão" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Nenhuma receita no período</div>
          )}
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Receita por Plano</h3>
          {planDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {planDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Transactions table */}
      <div className="glass-card">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Transações ({filtered.length})</h3>
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5 w-64">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={searchTx} onChange={e => setSearchTx(e.target.value)} placeholder="Buscar..." className="bg-transparent text-sm outline-none w-full" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Fotógrafo</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Evento</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-right p-3 font-medium hidden md:table-cell">Comissão</th>
                <th className="text-right p-3 font-medium hidden lg:table-cell">Fotógrafo</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{tx.idShort}</td>
                  <td className="p-3">{tx.client}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{tx.photographer}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground truncate max-w-[150px]">{tx.event}</td>
                  <td className="p-3 text-right font-medium">{fmt(tx.amount)}</td>
                  <td className="p-3 text-right hidden md:table-cell text-primary font-medium">{fmt(tx.commission)}</td>
                  <td className="p-3 text-right hidden lg:table-cell font-medium">{fmt(tx.photographerAmount)}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold ${statusColor[tx.status] || "text-muted-foreground"}`}>{statusLabel[tx.status] || tx.status}</span>
                  </td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">{new Date(tx.date).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">Nenhuma transação encontrada</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminFinance;
