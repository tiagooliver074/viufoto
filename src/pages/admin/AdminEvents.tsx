import { useEffect, useState } from "react";
import { Search, MapPin, Loader2, Eye, EyeOff, Trash2, ScanText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IndexingProgressCard } from "@/components/admin/IndexingProgressCard";
import { DlqStatusCard } from "@/components/admin/DlqStatusCard";

interface EventData {
  id: string;
  name: string;
  location: string;
  event_date: string;
  status: string;
  category: string;
  plan_type: string;
  visibility: boolean;
  organizer_name: string;
  photoCount: number;
  revenue: number;
}

const statusBadge: Record<string, string> = {
  ativo: "bg-lime/15 text-lime",
  em_breve: "bg-accent/15 text-accent",
  inativo: "bg-muted text-muted-foreground",
};
const statusLabel: Record<string, string> = { ativo: "Ativo", em_breve: "Em Breve", inativo: "Inativo" };

const AdminEvents = () => {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    const [{ data: eventsRaw }, { data: photos }, { data: orders }, { data: profiles }] = await Promise.all([
      supabase.from("events").select("id, name, location, event_date, status, category, plan_type, visibility, organizer_id"),
      supabase.from("event_photos").select("id, event_id"),
      supabase.from("orders").select("event_id, amount, status").in("status", ["pago", "enviado"]),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    if (eventsRaw) {
      const mapped: EventData[] = eventsRaw.map(e => ({
        id: e.id,
        name: e.name,
        location: e.location,
        event_date: e.event_date,
        status: e.status,
        category: e.category,
        plan_type: e.plan_type,
        visibility: e.visibility,
        organizer_name: profiles?.find(p => p.user_id === e.organizer_id)?.full_name || "—",
        photoCount: photos?.filter(p => p.event_id === e.id).length || 0,
        revenue: orders?.filter(o => o.event_id === e.id).reduce((s, o) => s + Number(o.amount), 0) || 0,
      }));
      setEvents(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const toggleVisibility = async (eventId: string, current: boolean) => {
    const { error } = await supabase.from("events").update({ visibility: !current }).eq("id", eventId);
    if (error) { toast.error("Erro ao alterar visibilidade"); return; }
    toast.success(current ? "Evento ocultado" : "Evento visível");
    fetchEvents();
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) { toast.error("Erro ao excluir evento"); return; }
    toast.success("Evento excluído");
    fetchEvents();
  };

  const [reindexing, setReindexing] = useState<string | null>(null);
  const reindexBibs = async (eventId: string, force: boolean) => {
    setReindexing(eventId);
    const tId = toast.loading(force ? "Reprocessando todas as fotos…" : "Indexando fotos pendentes…");
    try {
      const { data, error } = await supabase.functions.invoke("bib-reindex-event", {
        body: { event_id: eventId, force, limit: 50 },
      });
      if (error) throw error;
      toast.success(
        `OCR concluído: ${data.processed} fotos · ${data.total_detections} números · ${data.errors_count} erros`,
        { id: tId, duration: 6000 }
      );
      if (data.remaining_hint) toast.warning(data.remaining_hint, { duration: 8000 });
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : String(e)}`, { id: tId });
    } finally {
      setReindexing(null);
    }
  };

  const filtered = events.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.organizer_name.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === "all" || e.status === tab;
    return matchSearch && matchTab;
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Eventos</h1>
        <p className="text-sm text-muted-foreground">{events.length} eventos cadastrados</p>
      </div>

      <DlqStatusCard />

      <div className="flex gap-2 flex-wrap">
        {[{ key: "all", label: "Todos" }, { key: "ativo", label: "Ativos" }, { key: "em_breve", label: "Em Breve" }, { key: "inativo", label: "Inativos" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar evento ou fotógrafo..." className="bg-transparent text-sm outline-none w-full" />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((event) => (
            <div key={event.id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{event.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" /> {event.location}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">📸 {event.organizer_name}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`${statusBadge[event.status] || "bg-muted text-muted-foreground"} px-2 py-0.5 rounded-full text-[10px] font-semibold`}>
                    {statusLabel[event.status] || event.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground">
                    {event.plan_type === "profissional" ? "PRO" : "Início"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-secondary/50 rounded-lg p-2">
                  <p className="text-sm font-bold">{event.photoCount}</p>
                  <p className="text-[10px] text-muted-foreground">Fotos</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2">
                  <p className="text-sm font-bold">{fmt(event.revenue)}</p>
                  <p className="text-[10px] text-muted-foreground">Receita</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2">
                  <p className="text-sm font-bold">{new Date(event.event_date).toLocaleDateString("pt-BR")}</p>
                  <p className="text-[10px] text-muted-foreground">Data</p>
                </div>
              </div>

              <IndexingProgressCard eventId={event.id} />

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <button onClick={() => toggleVisibility(event.id, event.visibility)} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  {event.visibility ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {event.visibility ? "Ocultar" : "Mostrar"}
                </button>
                <button onClick={() => deleteEvent(event.id)} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
                <button
                  onClick={() => reindexBibs(event.id, false)}
                  disabled={reindexing === event.id}
                  title="Fallback: reprocessar fotos que falharam no OCR automático"
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 sm:ml-auto"
                >
                  {reindexing === event.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
                  Reprocessar OCR
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 text-center text-muted-foreground"><p className="text-sm">Nenhum evento encontrado</p></div>
      )}
    </div>
  );
};

export default AdminEvents;
