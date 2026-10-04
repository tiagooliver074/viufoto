import { useEffect, useState, useMemo } from "react";
import { Loader2, Search, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, CreditCard, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminPayments = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [statusResults, setStatusResults] = useState<Record<string, any>>({});

  const fetchData = async () => {
    setLoading(true);
    const [{ data: o }, { data: e }, { data: p }] = await Promise.all([
      supabase.from("orders").select("*").not("asaas_payment_id", "is", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("events").select("id, name, plan_type, organizer_id"),
      supabase.from("profiles").select("user_id, full_name, cpf_cnpj"),
    ]);
    setOrders(o || []);
    setEvents(e || []);
    setProfiles(p || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const checkPaymentStatus = async (paymentId: string) => {
    setCheckingId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-payment", {
        body: { action: "check_status", paymentId },
      });
      if (data) {
        setStatusResults(prev => ({ ...prev, [paymentId]: data }));
      }
    } catch (err) {
      console.error("Check status error:", err);
    } finally {
      setCheckingId(null);
    }
  };

  const COMMISSION_INICIO = 0.12;
  const COMMISSION_PRO = 0.10;

  const payments = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!o.client_name?.toLowerCase().includes(s) && !o.asaas_payment_id?.toLowerCase().includes(s) && !o.client_email?.toLowerCase().includes(s)) return false;
      }
      return true;
    }).map(o => {
      const event = events.find(e => e.id === o.event_id);
      const photographer = profiles.find(p => p.user_id === event?.organizer_id);
      const rate = event?.plan_type === "profissional" ? COMMISSION_PRO : COMMISSION_INICIO;
      // Modelo de conta mestre: os valores reais já ficam gravados no pedido
      // (creditados no wallet_ledger pelo webhook). Se ainda não tiver sido
      // calculado (pedidos antigos), cai no fallback estimado por plan_type.
      const platformFee = o.platform_fee != null ? Number(o.platform_fee) : Math.round(Number(o.amount) * rate * 100) / 100;
      const photographerAmount = o.photographer_net != null ? Number(o.photographer_net) : Number(o.amount) - platformFee;
      return {
        ...o,
        eventName: event?.name || "—",
        planType: event?.plan_type || "inicio",
        photographerName: photographer?.full_name || "—",
        payoutConfigured: !!photographer?.cpf_cnpj,
        platformFee,
        photographerAmount,
        commissionRate: rate,
      };
    });
  }, [orders, events, profiles, search, filterStatus]);

  const stats = useMemo(() => {
    const total = payments.length;
    const paid = payments.filter(p => p.status === "pago").length;
    const pending = payments.filter(p => p.status === "aguardando_pagamento").length;
    const noWallet = payments.filter(p => !p.payoutConfigured).length;
    return { total, paid, pending, noWallet };
  }, [payments]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusIcon = (status: string) => {
    switch (status) {
      case "pago": case "RECEIVED": case "CONFIRMED": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "aguardando_pagamento": case "PENDING": return <Clock className="w-4 h-4 text-amber-500" />;
      case "cancelado": case "CANCELLED": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos Asaas</h1>
          <p className="text-sm text-muted-foreground">Monitoramento de cobranças, divisão interna (ledger) e status de pagamento</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Cobranças", value: stats.total, icon: CreditCard, color: "text-primary" },
          { label: "Confirmados", value: stats.paid, icon: CheckCircle, color: "text-green-500" },
          { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-500" },
          { label: "Sem recebimento", value: stats.noWallet, icon: AlertTriangle, color: stats.noWallet > 0 ? "text-destructive" : "text-muted-foreground" },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card p-4">
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5 flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou ID Asaas..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none">
          <option value="all">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="aguardando_pagamento">Pendente</option>
          <option value="cancelado">Cancelado</option>
          <option value="enviado">Enviado</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-3 font-medium">Asaas ID</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Evento</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="text-center p-3 font-medium hidden lg:table-cell">
                  <span className="flex items-center justify-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Split</span>
                </th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Recebimento</th>
                <th className="text-center p-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.asaas_payment_id?.slice(0, 16) || "—"}</td>
                  <td className="p-3">
                    <p className="font-medium">{p.client_name}</p>
                    <p className="text-xs text-muted-foreground">{p.client_email}</p>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <p className="truncate max-w-[150px]">{p.eventName}</p>
                    <p className="text-xs text-muted-foreground">{p.planType === "profissional" ? "Pro (10%)" : "Início (12%)"}</p>
                  </td>
                  <td className="p-3 text-right font-medium">{fmt(Number(p.amount))}</td>
                  <td className="p-3 hidden lg:table-cell">
                    <div className="text-xs text-center">
                      <p className="text-primary font-medium">VIU: {fmt(p.platformFee)}</p>
                      <p className="text-muted-foreground">Fot: {fmt(p.photographerAmount)}</p>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(statusResults[p.asaas_payment_id]?.status || p.status)}
                      <span className="text-xs font-semibold">
                        {statusResults[p.asaas_payment_id]?.status || (p.status === "pago" ? "CONFIRMED" : p.status === "aguardando_pagamento" ? "PENDING" : p.status.toUpperCase())}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    {p.payoutConfigured ? (
                      <span className="text-xs text-green-500 font-semibold">Configurado</span>
                    ) : (
                      <span className="text-xs text-destructive font-semibold">Não configurado</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      disabled={checkingId === p.asaas_payment_id || !p.asaas_payment_id}
                      onClick={() => p.asaas_payment_id && checkPaymentStatus(p.asaas_payment_id)}
                      className="px-2 py-1 rounded bg-secondary text-xs hover:bg-secondary/80 transition-colors disabled:opacity-50"
                    >
                      {checkingId === p.asaas_payment_id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Verificar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">Nenhum pagamento encontrado</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
