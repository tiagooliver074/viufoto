import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Search, ShoppingBag, Percent, DollarSign, Receipt } from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");

const MarketingDashboardTab = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["marketing-dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const uid = user!.id;
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();

      const { data: events } = await supabase
        .from("events")
        .select("id")
        .eq("organizer_id", uid);
      const eventIds = (events || []).map((e) => e.id);

      if (!eventIds.length) {
        return {
          visitors: 0, searches: 0, photosSold: 0, conversion: 0, revenue: 0, avgTicket: 0,
        };
      }

      const [logsRes, searchRes, ordersRes, itemsRes] = await Promise.all([
        supabase
          .from("marketing_events_log" as any)
          .select("id", { count: "exact", head: true })
          .in("event_id", eventIds)
          .gte("created_at", since)
          .eq("event_name", "PageView"),
        supabase
          .from("face_search_logs")
          .select("id", { count: "exact", head: true })
          .in("event_id", eventIds)
          .gte("created_at", since),
        supabase
          .from("orders")
          .select("id, amount")
          .in("event_id", eventIds)
          .in("status", ["pago", "enviado"])
          .gte("created_at", since),
        supabase
          .from("order_items")
          .select("id, order_id, event_photos!inner(event_id)")
          .in("event_photos.event_id", eventIds),
      ]);

      const orders = ordersRes.data || [];
      const revenue = orders.reduce((s, o: any) => s + Number(o.amount || 0), 0);
      const visitors = logsRes.count || 0;
      const searches = searchRes.count || 0;
      const photosSold = (itemsRes.data || []).length;
      const conversion = visitors > 0 ? (orders.length / visitors) * 100 : 0;
      const avgTicket = orders.length ? revenue / orders.length : 0;

      return { visitors, searches, photosSold, conversion, revenue, avgTicket };
    },
  });

  const Card = ({ icon: Icon, label, value, hint }: any) => (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  const d = data;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card icon={Eye} label="Visitantes das galerias" value={isLoading ? "…" : fmtNum(d?.visitors ?? 0)} />
        <Card icon={Search} label="Buscas realizadas" value={isLoading ? "…" : fmtNum(d?.searches ?? 0)} />
        <Card icon={ShoppingBag} label="Fotos vendidas" value={isLoading ? "…" : fmtNum(d?.photosSold ?? 0)} />
        <Card icon={Percent} label="Taxa de conversão" value={isLoading ? "…" : `${(d?.conversion ?? 0).toFixed(2)}%`} />
        <Card icon={DollarSign} label="Receita" value={isLoading ? "…" : fmtBRL(d?.revenue ?? 0)} />
        <Card icon={Receipt} label="Ticket médio" value={isLoading ? "…" : fmtBRL(d?.avgTicket ?? 0)} />
      </div>

      {!isLoading && (d?.visitors ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Ainda sem visitantes registrados. Conecte um pixel na aba <strong className="text-foreground">Pixels</strong> e
          comece a receber eventos assim que alguém acessar suas galerias.
        </div>
      )}
    </div>
  );
};

export default MarketingDashboardTab;