import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, TrendingUp, Award, PieChart as PieIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Data = {
  byEvent: { name: string; receita: number; pedidos: number }[];
  byDay: { date: string; receita: number; visitantes: number }[];
  byCategory: { name: string; value: number }[];
  kpi: { revenue: number; orders: number; visitors: number; ticket: number; conversion: number };
};

const COLORS = ["#673DE6", "#4B2CD3", "#8B5CF6", "#A78BFA", "#C4B5FD", "#EDE7FF"];

const MarketingRelatoriosTab = () => {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 30 * 86400_000);
      const sinceIso = since.toISOString();

      const { data: events } = await supabase
        .from("events").select("id, name, category").eq("organizer_id", user.id);
      const eventIds = (events || []).map((e: any) => e.id);

      if (!eventIds.length) {
        setData({ byEvent: [], byDay: [], byCategory: [], kpi: { revenue: 0, orders: 0, visitors: 0, ticket: 0, conversion: 0 } });
        setLoading(false); return;
      }

      const [ordersRes, logsRes] = await Promise.all([
        supabase.from("orders").select("id, amount, event_id, created_at").in("event_id", eventIds).in("status", ["pago", "enviado"]).gte("created_at", sinceIso),
        supabase.from("marketing_events_log" as any).select("event_id, created_at, event_name").in("event_id", eventIds).gte("created_at", sinceIso),
      ]);

      const orders = ordersRes.data || [];
      const logs = (logsRes.data as any[]) || [];

      const perEvent: Record<string, { name: string; receita: number; pedidos: number; cat: string }> = {};
      for (const e of events as any[]) perEvent[e.id] = { name: e.name, receita: 0, pedidos: 0, cat: e.category || "Outros" };
      for (const o of orders) {
        const p = perEvent[(o as any).event_id]; if (!p) continue;
        p.receita += Number((o as any).amount || 0); p.pedidos++;
      }

      const byEvent = Object.values(perEvent).filter((p) => p.receita > 0).sort((a, b) => b.receita - a.receita).slice(0, 10)
        .map(({ name, receita, pedidos }) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, receita, pedidos }));

      const catMap: Record<string, number> = {};
      for (const p of Object.values(perEvent)) catMap[p.cat] = (catMap[p.cat] || 0) + p.receita;
      const byCategory = Object.entries(catMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

      const dayMap: Record<string, { date: string; receita: number; visitantes: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = { date: `${d.getDate()}/${d.getMonth() + 1}`, receita: 0, visitantes: 0 };
      }
      for (const o of orders) {
        const key = new Date((o as any).created_at).toISOString().slice(0, 10);
        if (dayMap[key]) dayMap[key].receita += Number((o as any).amount || 0);
      }
      const visitorsPerDay: Record<string, Set<string>> = {};
      for (const l of logs) {
        if (l.event_name !== "PageView") continue;
        const key = new Date(l.created_at).toISOString().slice(0, 10);
        if (!dayMap[key]) continue;
        if (!visitorsPerDay[key]) visitorsPerDay[key] = new Set();
        visitorsPerDay[key].add((l as any).visitor_id || Math.random().toString());
      }
      for (const key of Object.keys(dayMap)) {
        dayMap[key].visitantes = visitorsPerDay[key]?.size || 0;
      }
      const byDay = Object.values(dayMap);

      const revenue = orders.reduce((s, o: any) => s + Number(o.amount || 0), 0);
      const visitors = logs.filter((l) => l.event_name === "PageView").length;
      const kpi = {
        revenue, orders: orders.length, visitors,
        ticket: orders.length ? revenue / orders.length : 0,
        conversion: visitors ? (orders.length / visitors) * 100 : 0,
      };

      setData({ byEvent, byDay, byCategory, kpi });
      setLoading(false);
    })();
  }, [user?.id]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [["Data", "Receita", "Visitantes"], ...data.byDay.map((d) => [d.date, d.receita.toString(), d.visitantes.toString()])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "relatorio-marketing.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Carregando relatórios…</div>;
  if (!data) return null;

  const empty = data.kpi.revenue === 0 && data.kpi.visitors === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2" disabled={empty}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Receita", value: fmtBRL(data.kpi.revenue) },
          { label: "Pedidos", value: data.kpi.orders.toLocaleString("pt-BR") },
          { label: "Visitantes", value: data.kpi.visitors.toLocaleString("pt-BR") },
          { label: "Ticket médio", value: fmtBRL(data.kpi.ticket) },
          { label: "Conversão", value: `${data.kpi.conversion.toFixed(2)}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-card border border-border p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-xl font-extrabold tracking-tight mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Sem dados suficientes ainda. Conecte pixels e receba os primeiros pedidos para popular os relatórios.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="font-bold">Receita e visitantes por dia</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="receita" stroke="#673DE6" strokeWidth={2} dot={false} name="Receita (R$)" />
                  <Line yAxisId="right" type="monotone" dataKey="visitantes" stroke="#A78BFA" strokeWidth={2} dot={false} name="Visitantes" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-primary" />
                <h3 className="font-bold">Top eventos por receita</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byEvent} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                    <Bar dataKey="receita" fill="#673DE6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon className="w-4 h-4 text-primary" />
                <h3 className="font-bold">Receita por modalidade</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                      {data.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketingRelatoriosTab;