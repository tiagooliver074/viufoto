import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Calendar, Camera, DollarSign, HardDrive, ScanFace, Activity, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LevelBadge from "@/components/levels/LevelBadge";
import { LEVEL_ICONS, type LevelKey } from "@/lib/levels";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  cpf_cnpj: string | null;
}

interface EventRow {
  id: string;
  name: string;
  event_date: string;
  plan_type: string;
  photos: number;
  sales: number;
  revenue: number;
}

const fmtCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

const StatCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) => (
  <div className="glass-card p-4">
    <Icon className="w-5 h-5 text-primary mb-2" />
    <p className="text-xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const AdminPhotographerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [photogLevel, setPhotogLevel] = useState<{ current_level: LevelKey; is_ambassador: boolean } | null>(null);
  const [ambSaving, setAmbSaving] = useState(false);
  const [totals, setTotals] = useState({
    eventsCount: 0,
    photosCount: 0,
    salesCount: 0,
    revenue: 0,
    planType: "Início",
  });

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      const [{ data: prof }, { data: evs }, { data: photos }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, created_at, last_sign_in_at, cpf_cnpj").eq("user_id", id).maybeSingle(),
        supabase.from("events").select("id, name, event_date, plan_type").eq("organizer_id", id),
        supabase.from("event_photos").select("id, event_id"),
        supabase.from("orders").select("id, event_id, amount, status, created_at, payment_method").in("status", ["pago", "enviado"]),
      ]);

      setProfile(prof as Profile);

      const { data: lvl } = await supabase
        .from("photographer_levels" as any)
        .select("current_level, is_ambassador")
        .eq("user_id", id)
        .maybeSingle();
      setPhotogLevel((lvl as any) ?? { current_level: "bronze", is_ambassador: false });

      const eventList = evs || [];
      const eventIds = eventList.map(e => e.id);
      const photosForUser = (photos || []).filter(p => eventIds.includes(p.event_id));
      const ordersForUser = (orders || []).filter(o => eventIds.includes(o.event_id));

      const rows: EventRow[] = eventList.map(e => {
        const evPhotos = photosForUser.filter(p => p.event_id === e.id).length;
        const evOrders = ordersForUser.filter(o => o.event_id === e.id);
        const evRevenue = evOrders.reduce((s, o) => s + Number(o.amount), 0);
        return {
          id: e.id,
          name: e.name,
          event_date: e.event_date,
          plan_type: e.plan_type,
          photos: evPhotos,
          sales: evOrders.length,
          revenue: evRevenue,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      setEvents(rows);
      const totalRevenue = ordersForUser.reduce((s, o) => s + Number(o.amount), 0);
      const hasPro = eventList.some(e => e.plan_type === "profissional");
      setTotals({
        eventsCount: eventList.length,
        photosCount: photosForUser.length,
        salesCount: ordersForUser.length,
        revenue: totalRevenue,
        planType: hasPro ? "Profissional" : "Início",
      });
      setLoading(false);
    };
    fetch();
  }, [id]);

  const toggleAmbassador = async () => {
    if (!id) return;
    setAmbSaving(true);
    const enabled = !photogLevel?.is_ambassador;
    const { error } = await supabase.rpc("set_ambassador" as any, { _user_id: id, _enabled: enabled });
    setAmbSaving(false);
    if (error) return toast.error(error.message);
    setPhotogLevel((p) => p ? { ...p, is_ambassador: enabled } : p);
    toast.success(enabled ? "Embaixador ativado" : "Embaixador removido");
  };

  const recalcLevel = async () => {
    if (!id) return;
    const { error } = await supabase.rpc("recalc_photographer_level" as any, { _user_id: id });
    if (error) return toast.error(error.message);
    toast.success("Nível recalculado");
    const { data: lvl } = await supabase
      .from("photographer_levels" as any)
      .select("current_level, is_ambassador")
      .eq("user_id", id)
      .maybeSingle();
    setPhotogLevel((lvl as any) ?? null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="glass-card p-8 text-center text-muted-foreground">Fotógrafo não encontrado.</div>
      </div>
    );
  }

  const commissionPct = totals.planType === "Profissional" ? 0.10 : 0.12;
  const platformCommission = totals.revenue * commissionPct;
  const photographerPayout = totals.revenue - platformCommission;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </div>

      {/* Summary */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-lg font-bold shrink-0">
            {(profile.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Camera className="w-4 h-4 text-primary" />
              <h1 className="text-xl font-bold truncate">{profile.full_name || "Sem nome"}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${totals.planType === "Profissional" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {totals.planType}
              </span>
              {photogLevel && <LevelBadge level={photogLevel.current_level} size="sm" />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs text-muted-foreground">
              <div><span className="block text-foreground font-medium">Cadastro</span>{fmtDate(profile.created_at)}</div>
              <div><span className="block text-foreground font-medium">Último acesso</span>{fmtDate(profile.last_sign_in_at)}</div>
              <div><span className="block text-foreground font-medium">User ID</span><span className="font-mono">{profile.user_id.slice(0, 8)}…</span></div>
            </div>
          </div>
        </div>
        {/* Embaixador / nível */}
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
          <span className="text-sm">
            Nível: <strong>{LEVEL_ICONS[photogLevel?.current_level ?? "bronze"]} {photogLevel?.current_level ?? "bronze"}</strong>
          </span>
          <button onClick={recalcLevel} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70">
            Recalcular nível
          </button>
          <label className="flex items-center gap-2 text-sm ml-auto">
            <input type="checkbox" checked={!!photogLevel?.is_ambassador} onChange={toggleAmbassador} disabled={ambSaving} />
            👑 Embaixador (manual)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Eventos" value={totals.eventsCount} icon={Calendar} />
        <StatCard label="Fotos" value={totals.photosCount} icon={Camera} />
        <StatCard label="Vendas" value={totals.salesCount} icon={DollarSign} />
        <StatCard label="Receita Total" value={fmtCurrency(totals.revenue)} icon={DollarSign} />
        <StatCard label={`Comissão Plataforma (${(commissionPct * 100).toFixed(0)}%)`} value={fmtCurrency(platformCommission)} icon={DollarSign} />
        <StatCard label="Repasse ao Fotógrafo" value={fmtCurrency(photographerPayout)} icon={DollarSign} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="eventos" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="facial">Reconhecimento Facial</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="logs">Logs & Diagnóstico</TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="mt-4">
          {events.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">Nenhum evento cadastrado.</div>
          ) : (
            <div className="glass-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-4 font-medium">Evento</th>
                    <th className="text-left p-4 font-medium hidden md:table-cell">Data</th>
                    <th className="text-right p-4 font-medium">Fotos</th>
                    <th className="text-right p-4 font-medium">Vendas</th>
                    <th className="text-right p-4 font-medium">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/evento/${e.id}`)}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{e.name}</span>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell text-muted-foreground">{fmtDate(e.event_date)}</td>
                      <td className="p-4 text-right">{e.photos.toLocaleString("pt-BR")}</td>
                      <td className="p-4 text-right">{e.sales}</td>
                      <td className="p-4 text-right font-semibold text-primary">{fmtCurrency(e.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" /><h3 className="font-semibold">Storage S3</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground mb-1">Bucket</p><p className="font-mono">viufoto-images-bucket</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Path S3</p><p className="font-mono break-all">usuarios/{profile.user_id}/</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Fotos originais</p><p className="font-semibold">{totals.photosCount.toLocaleString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Thumbs (.webp)</p><p className="font-semibold">{totals.photosCount.toLocaleString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Medium</p><p className="font-semibold">{totals.photosCount.toLocaleString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Espaço utilizado</p><p className="text-muted-foreground italic">Indisponível (consultar AWS)</p></div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-3">Visualização somente leitura. A estrutura S3 / CloudFront / Lambda não é alterada por esta página.</p>
          </div>
        </TabsContent>

        <TabsContent value="facial" className="mt-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2"><ScanFace className="w-4 h-4 text-primary" /><h3 className="font-semibold">Reconhecimento Facial</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground mb-1">Status</p><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground">Inativo</span></div>
              <div><p className="text-xs text-muted-foreground mb-1">Faces cadastradas</p><p className="font-semibold">—</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Fotos indexadas</p><p className="font-semibold">—</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Última indexação</p><p className="font-semibold">—</p></div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-3">Pipeline de Rekognition ainda não conectado.</p>
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /><h3 className="font-semibold">Financeiro</h3></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Receita Total" value={fmtCurrency(totals.revenue)} icon={DollarSign} />
              <StatCard label="Comissão Plataforma" value={fmtCurrency(platformCommission)} icon={DollarSign} />
              <StatCard label="Repasse" value={fmtCurrency(photographerPayout)} icon={DollarSign} />
              <StatCard label="Recebimento" value={profile.cpf_cnpj ? "Configurado" : "Pendente"} icon={DollarSign} />
            </div>
            <div className="text-sm">
              <p className="text-xs text-muted-foreground mb-1">Saldo pendente</p>
              <p className="text-muted-foreground italic">Consultar Asaas para saldo realtime.</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Histórico de pagamentos</p>
              <p className="text-sm text-muted-foreground italic">Use o módulo Pagamentos para detalhes por transação.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /><h3 className="font-semibold">Logs & Diagnóstico</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground mb-1">Último evento criado</p><p className="font-semibold">{events[0] ? events[0].name : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Total de fotos</p><p className="font-semibold">{totals.photosCount.toLocaleString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Status CloudFront</p><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground">Não monitorado</span></div>
              <div><p className="text-xs text-muted-foreground mb-1">Status Lambda Processor</p><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground">Não monitorado</span></div>
              <div><p className="text-xs text-muted-foreground mb-1">Último upload</p><p className="text-muted-foreground italic">—</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Último erro de upload</p><p className="text-muted-foreground italic">—</p></div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-3">Telemetria avançada requer integração com CloudWatch/Lambda logs.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPhotographerDetail;