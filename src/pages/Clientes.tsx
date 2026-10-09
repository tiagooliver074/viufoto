import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Search, Calendar, Download, Mail, Copy, ExternalLink, Eye, EyeOff, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type SortKey = "purchases" | "spent" | "recent";

interface ClientRow {
  email: string;
  name: string;
  phone: string | null;
  purchases: number;
  photos: number;
  videos: number;
  total: number;
  lastPurchase: string | null;
  events: Set<string>;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskPhone = (p: string | null) => {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length < 8) return p;
  return `(${d.slice(-11, -9) || d.slice(0, 2)}) ${d.slice(-9, -7)}*****${d.slice(-2)}`;
};

const fmtPhone = (p: string | null) => {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
};

const relativeTime = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Hoje";
  if (days < 30) return `Há ${days} dia${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Há ${months} ${months > 1 ? "meses" : "mês"}`;
  const years = Math.floor(months / 12);
  return `Há ${years} ano${years > 1 ? "s" : ""}`;
};

const Clientes = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("purchases");
  const [showPhone, setShowPhone] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["photographer-clients", user?.id],
    queryFn: async () => {
      if (!user?.id) return { events: [], orders: [] as any[], items: [] as any[] };
      const { data: events } = await supabase
        .from("events")
        .select("id, name")
        .eq("organizer_id", user.id);
      const eventIds = (events || []).map((e) => e.id);
      if (!eventIds.length) return { events: events || [], orders: [], items: [] };
      const { data: orders } = await supabase
        .from("orders")
        .select("id, event_id, client_name, client_email, status, amount, created_at")
        .in("event_id", eventIds)
        .in("status", ["pago", "enviado"]);
      const orderIds = (orders || []).map((o) => o.id);
      let items: any[] = [];
      if (orderIds.length) {
        const { data: it } = await supabase
          .from("order_items")
          .select("order_id, photo_id, video_id")
          .in("order_id", orderIds);
        items = it || [];
      }
      // fetch phones from profiles by matching emails (best-effort)
      const emails = Array.from(new Set((orders || []).map((o) => o.client_email).filter(Boolean)));
      let phonesByEmail = new Map<string, string>();
      if (emails.length) {
        // profiles table doesn't have email; skip — phone left null
      }
      return { events: events || [], orders: orders || [], items, phonesByEmail };
    },
    enabled: !!user?.id,
  });

  const eventNameById = useMemo(() => {
    const m = new Map<string, string>();
    (data?.events || []).forEach((e: any) => m.set(e.id, e.name));
    return m;
  }, [data]);

  const clients = useMemo<ClientRow[]>(() => {
    if (!data) return [];
    const itemsByOrder = new Map<string, { photos: number; videos: number }>();
    (data.items || []).forEach((it: any) => {
      const cur = itemsByOrder.get(it.order_id) || { photos: 0, videos: 0 };
      if (it.photo_id) cur.photos += 1;
      if (it.video_id) cur.videos += 1;
      itemsByOrder.set(it.order_id, cur);
    });

    const fromTs = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;

    const map = new Map<string, ClientRow>();
    (data.orders || []).forEach((o: any) => {
      if (eventFilter !== "all" && o.event_id !== eventFilter) return;
      const t = new Date(o.created_at).getTime();
      if (t < fromTs || t > toTs) return;
      const key = (o.client_email || "").toLowerCase() || `__${o.id}`;
      const it = itemsByOrder.get(o.id) || { photos: 0, videos: 0 };
      const existing = map.get(key);
      if (existing) {
        existing.purchases += 1;
        existing.photos += it.photos;
        existing.videos += it.videos;
        existing.total += Number(o.amount || 0);
        existing.events.add(o.event_id);
        if (!existing.lastPurchase || new Date(o.created_at) > new Date(existing.lastPurchase)) {
          existing.lastPurchase = o.created_at;
        }
      } else {
        map.set(key, {
          email: o.client_email || "",
          name: o.client_name || "Cliente",
          phone: null,
          purchases: 1,
          photos: it.photos,
          videos: it.videos,
          total: Number(o.amount || 0),
          lastPurchase: o.created_at,
          events: new Set([o.event_id]),
        });
      }
    });

    let arr = Array.from(map.values());
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    arr.sort((a, b) => {
      if (sortKey === "purchases") return b.purchases - a.purchases;
      if (sortKey === "spent") return b.total - a.total;
      return new Date(b.lastPurchase || 0).getTime() - new Date(a.lastPurchase || 0).getTime();
    });
    return arr;
  }, [data, search, sortKey, eventFilter, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return clients.reduce(
      (acc, c) => ({
        clients: acc.clients + 1,
        revenue: acc.revenue + c.total,
        purchases: acc.purchases + c.purchases,
      }),
      { clients: 0, revenue: 0, purchases: 0 },
    );
  }, [clients]);

  const exportCSV = () => {
    const rows = [
      ["Cliente", "E-mail", "Telefone", "Compras", "Fotos", "Vídeos", "Última compra", "Valor total"],
      ...clients.map((c) => [
        c.name,
        c.email,
        c.phone || "",
        String(c.purchases),
        String(c.photos),
        String(c.videos),
        c.lastPurchase ? new Date(c.lastPurchase).toLocaleString("pt-BR") : "",
        c.total.toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-viufoto-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-8 overflow-auto">
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              {totals.clients} cliente{totals.clients !== 1 ? "s" : ""} • {totals.purchases} compra
              {totals.purchases !== 1 ? "s" : ""} • Total {fmtBRL(totals.revenue)}
            </p>
          </div>
          <button
            onClick={exportCSV}
            disabled={!clients.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 mt-6 mb-4 grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-3 relative">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full appearance-none pl-3 pr-9 py-2.5 rounded-lg bg-secondary border border-border text-sm outline-none focus:border-primary"
            >
              <option value="all">Todos os eventos</option>
              {(data?.events || []).map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="md:col-span-3 flex items-center gap-2 border border-border bg-secondary rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none flex-1 min-w-0"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none flex-1 min-w-0"
            />
          </div>
          <div className="md:col-span-2 relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full appearance-none pl-3 pr-9 py-2.5 rounded-lg bg-secondary border border-border text-sm outline-none focus:border-primary"
            >
              <option value="purchases">Nº de compras</option>
              <option value="spent">Valor gasto</option>
              <option value="recent">Mais recentes</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="md:col-span-12 flex items-center gap-2 text-xs text-muted-foreground">
            <button
              onClick={() => setShowPhone((s) => !s)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-secondary"
            >
              {showPhone ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showPhone ? "Ocultar telefone" : "Mostrar telefone"}
            </button>
            {(eventFilter !== "all" || dateFrom || dateTo || search) && (
              <button
                onClick={() => { setSearch(""); setEventFilter("all"); setDateFrom(""); setDateTo(""); }}
                className="px-2.5 py-1.5 rounded-md hover:bg-secondary"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : clients.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado. Quando seus eventos receberem pedidos pagos, eles aparecerão aqui.
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-border/50">
                {clients.map((c) => (
                  <div key={c.email} className="p-4 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    {showPhone && <p className="text-xs text-muted-foreground">{fmtPhone(c.phone)}</p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{c.purchases} compras • {c.photos} fotos</span>
                      <span className="font-bold text-foreground">{fmtBRL(c.total)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{relativeTime(c.lastPurchase)}</p>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["CLIENTE", "TELEFONE", "COMPRAS", "ÚLTIMA COMPRA", "FOTOS", "VÍDEOS", "VALOR TOTAL", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.email} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                              <Mail className="w-3 h-3" /> {c.email}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {c.events.size} evento{c.events.size > 1 ? "s" : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{showPhone ? fmtPhone(c.phone) : maskPhone(c.phone)}</span>
                            {c.phone && (
                              <button
                                onClick={() => { navigator.clipboard.writeText(c.phone!); toast.success("Telefone copiado"); }}
                                className="text-muted-foreground/60 hover:text-foreground"
                                title="Copiar"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">{c.purchases}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString("pt-BR") : "—"}
                          <span className="block text-[10px]">{relativeTime(c.lastPurchase)}</span>
                        </td>
                        <td className="px-4 py-3 text-foreground">{c.photos}</td>
                        <td className="px-4 py-3 text-foreground">{c.videos}</td>
                        <td className="px-4 py-3 font-bold text-foreground">{fmtBRL(c.total)}</td>
                        <td className="px-4 py-3">
                          <a
                            href={`mailto:${c.email}`}
                            className="p-2 rounded-lg hover:bg-secondary inline-flex"
                            title="Enviar e-mail"
                          >
                            <ExternalLink className="w-4 h-4 text-muted-foreground" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Clientes;