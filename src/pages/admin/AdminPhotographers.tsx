import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, DollarSign, Camera, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PhotographerData {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  plan_type: string;
  asaas_configured: boolean;
  total_events: number;
  total_revenue: number;
  total_photos: number;
}

const AdminPhotographers = () => {
  const [search, setSearch] = useState("");
  const [photographers, setPhotographers] = useState<PhotographerData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const [{ data: roles }, { data: profiles }, { data: events }, { data: orders }, { data: photos }, { data: sites }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "photographer"),
        supabase.from("profiles").select("user_id, full_name, avatar_url, cpf_cnpj"),
        supabase.from("events").select("id, organizer_id, plan_type"),
        supabase.from("orders").select("event_id, amount, status").in("status", ["pago", "enviado"]),
        supabase.from("event_photos").select("id, event_id"),
        supabase.from("photographer_sites").select("user_id"),
      ]);

      if (roles && profiles) {
        const data: PhotographerData[] = roles.map(r => {
          const profile = profiles.find(p => p.user_id === r.user_id);
          const userEvents = events?.filter(e => e.organizer_id === r.user_id) || [];
          const eventIds = userEvents.map(e => e.id);
          const revenue = orders?.filter(o => eventIds.includes(o.event_id)).reduce((s, o) => s + Number(o.amount), 0) || 0;
          const photoCount = photos?.filter(p => eventIds.includes(p.event_id)).length || 0;
          const hasPro = userEvents.some(e => e.plan_type === "profissional");
          return {
            user_id: r.user_id,
            full_name: profile?.full_name || "Sem nome",
            avatar_url: profile?.avatar_url ?? null,
            plan_type: hasPro ? "Profissional" : "Início",
            asaas_configured: !!profile?.cpf_cnpj,
            total_events: userEvents.length,
            total_revenue: revenue,
            total_photos: photoCount,
          };
        }).sort((a, b) => b.total_revenue - a.total_revenue);
        setPhotographers(data);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = photographers.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()));
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Fotógrafos</h1>
        <p className="text-sm text-muted-foreground">{photographers.length} fotógrafos ativos</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <Camera className="w-5 h-5 text-primary mb-2" />
          <p className="text-xl font-bold">{photographers.length}</p>
          <p className="text-xs text-muted-foreground">Total Fotógrafos</p>
        </div>
        <div className="glass-card p-4">
          <DollarSign className="w-5 h-5 text-primary mb-2" />
          <p className="text-xl font-bold">{fmt(photographers.reduce((s, p) => s + p.total_revenue, 0))}</p>
          <p className="text-xs text-muted-foreground">Receita Total</p>
        </div>
        <div className="glass-card p-4">
          <CheckCircle className="w-5 h-5 text-lime mb-2" />
          <p className="text-xl font-bold">{photographers.filter(p => p.asaas_configured).length}</p>
          <p className="text-xs text-muted-foreground">Recebimento OK</p>
        </div>
        <div className="glass-card p-4">
          <XCircle className="w-5 h-5 text-destructive mb-2" />
          <p className="text-xl font-bold">{photographers.filter(p => !p.asaas_configured).length}</p>
          <p className="text-xs text-muted-foreground">Sem Recebimento</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fotógrafo..." className="bg-transparent text-sm outline-none w-full" />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-4 font-medium">Fotógrafo</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Plano</th>
                <th className="text-center p-4 font-medium hidden md:table-cell">Recebimento</th>
                <th className="text-right p-4 font-medium">Eventos</th>
                <th className="text-right p-4 font-medium hidden lg:table-cell">Fotos</th>
                <th className="text-right p-4 font-medium">Receita</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.user_id}
                  onClick={() => navigate(`/admin/fotografos/${p.user_id}`)}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name} />}
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                          {p.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.plan_type === "Profissional" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {p.plan_type}
                    </span>
                  </td>
                  <td className="p-4 hidden md:table-cell text-center">
                    {p.asaas_configured ? <CheckCircle className="w-4 h-4 text-lime inline" /> : <XCircle className="w-4 h-4 text-destructive inline" />}
                  </td>
                  <td className="p-4 text-right">{p.total_events}</td>
                  <td className="p-4 text-right hidden lg:table-cell">{p.total_photos}</td>
                  <td className="p-4 text-right font-semibold text-primary">{fmt(p.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card p-8 text-center text-muted-foreground"><p className="text-sm">Nenhum fotógrafo encontrado</p></div>
      )}
    </div>
  );
};

export default AdminPhotographers;
