import { useEffect, useState } from "react";
import {
  Search, Loader2, Shield, CheckCircle, ChevronDown, Ban, Eye,
  Calendar, ShoppingBag, Clock, AlertTriangle, Filter, History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

type AppRole = "user" | "photographer" | "organizer" | "super_admin";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  interest: string | null;
  avatar_url: string | null;
  created_at: string;
  blocked: boolean;
  last_sign_in_at: string | null;
  cpf_cnpj: string | null;
  roles: AppRole[];
  // Computed
  totalSales: number;
  salesCount: number;
  lastSale: string | null;
  eventsByPlan: Record<string, number>;
}

interface AuditLog {
  id: string;
  action: string;
  target_user_id: string;
  details: any;
  performed_by: string;
  created_at: string;
}

const roleBadge: Record<string, string> = {
  user: "bg-secondary text-muted-foreground",
  photographer: "bg-primary/15 text-primary",
  organizer: "bg-accent/15 text-accent",
  super_admin: "bg-destructive/15 text-destructive",
};

const roleLabel: Record<string, string> = {
  user: "Usuário",
  photographer: "Fotógrafo",
  organizer: "Organizador",
  super_admin: "Super Admin",
};

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [asaasFilter, setAsaasFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    userId: string;
    userName: string;
    role?: AppRole;
    hasIt?: boolean;
  } | null>(null);

  const fetchUsers = async () => {
    const [{ data: profiles }, { data: roles }, { data: orders }, { data: events }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, full_name, phone, interest, avatar_url, created_at, blocked, last_sign_in_at, cpf_cnpj"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("orders").select("event_id, amount, created_at, status, events!inner(organizer_id)").eq("status", "pago"),
      supabase.from("events").select("id, organizer_id, plan_type"),
    ]);

    if (profiles) {
      const mapped: UserProfile[] = profiles.map(p => {
        const userRoles = (roles?.filter(r => r.user_id === p.user_id).map(r => r.role as AppRole)) || [];
        
        // Sales data for photographers/organizers
        const userOrders = orders?.filter((o: any) => o.events?.organizer_id === p.user_id) || [];
        const totalSales = userOrders.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
        const lastSale = userOrders.length > 0
          ? userOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : null;

        // Events by plan
        const userEvents = events?.filter(e => e.organizer_id === p.user_id) || [];
        const eventsByPlan: Record<string, number> = {};
        userEvents.forEach(e => {
          eventsByPlan[e.plan_type] = (eventsByPlan[e.plan_type] || 0) + 1;
        });

        return {
          ...p,
          blocked: p.blocked ?? false,
          roles: userRoles,
          totalSales,
          salesCount: userOrders.length,
          lastSale,
          eventsByPlan,
        };
      });
      setUsers(mapped);
    }
    setLoading(false);
  };

  const fetchAuditLogs = async () => {
    const { data } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setAuditLogs(data as AuditLog[]);
  };

  useEffect(() => { fetchUsers(); }, []);

  const logAction = async (action: string, targetUserId: string, details: any) => {
    if (!currentUser) return;
    await supabase.from("admin_audit_log").insert({
      action,
      target_user_id: targetUserId,
      details,
      performed_by: currentUser.id,
    });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { type, userId, role, hasIt } = confirmAction;

    if (type === "toggle_role" && role) {
      if (hasIt) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) { toast.error("Erro ao remover role"); return; }
        await logAction("role_removed", userId, { role });
        toast.success(`Role "${roleLabel[role]}" removida`);
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) { toast.error("Erro ao adicionar role"); return; }
        await logAction("role_added", userId, { role });
        toast.success(`Role "${roleLabel[role]}" adicionada`);
      }
    } else if (type === "toggle_block") {
      const user = users.find(u => u.user_id === userId);
      const newBlocked = !user?.blocked;
      const { error } = await supabase.from("profiles").update({ blocked: newBlocked }).eq("user_id", userId);
      if (error) { toast.error("Erro ao alterar status"); return; }
      await logAction(newBlocked ? "user_blocked" : "user_unblocked", userId, {});
      toast.success(newBlocked ? "Usuário bloqueado" : "Usuário desbloqueado");
    }

    setConfirmAction(null);
    fetchUsers();
  };

  const handleToggleRole = (userId: string, userName: string, role: AppRole, hasIt: boolean) => {
    if (role === "user") return;
    // Prevent removing own super_admin
    if (role === "super_admin" && hasIt && userId === currentUser?.id) {
      toast.error("Você não pode remover seu próprio acesso de Super Admin");
      return;
    }
    setConfirmAction({ type: "toggle_role", userId, userName, role, hasIt });
  };

  const handleToggleBlock = (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      toast.error("Você não pode bloquear a si mesmo");
      return;
    }
    setConfirmAction({ type: "toggle_block", userId, userName });
  };

  const getAsaasStatus = (user: UserProfile) => {
    if (!user.roles.includes("photographer") && !user.roles.includes("organizer")) return null;
    if (user.cpf_cnpj) return "configured";
    return "not_configured";
  };

  const filtered = users.filter((u) => {
    const matchSearch = (u.full_name || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.roles.includes(roleFilter as AppRole);
    const matchStatus = statusFilter === "all"
      || (statusFilter === "active" && !u.blocked)
      || (statusFilter === "blocked" && u.blocked);
    const asaasStatus = getAsaasStatus(u);
    const matchAsaas = asaasFilter === "all"
      || (asaasFilter === "configured" && asaasStatus === "configured")
      || (asaasFilter === "not_configured" && asaasStatus === "not_configured");
    const matchActivity = activityFilter === "all"
      || (activityFilter === "with_sales" && u.salesCount > 0)
      || (activityFilter === "no_sales" && u.salesCount === 0 && (u.roles.includes("photographer") || u.roles.includes("organizer")));
    return matchSearch && matchRole && matchStatus && matchAsaas && matchActivity;
  });

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "Nunca";
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const planIcons: Record<string, string> = { profissional: "🔥", inicio: "🟢", premium: "⭐" };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} cadastrados • {users.filter(u => u.blocked).length} bloqueados • {users.filter(u => u.roles.includes("photographer")).length} fotógrafos
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowFilters(!showFilters); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 transition-colors">
            <Filter className="w-3.5 h-3.5" /> Filtros
          </button>
          <button onClick={() => { setShowLogs(!showLogs); fetchAuditLogs(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 transition-colors">
            <History className="w-3.5 h-3.5" /> Log
          </button>
        </div>
      </div>

      {/* Role Filters */}
      <div className="flex flex-wrap gap-2">
        {[{ key: "all", label: "Todos" }, { key: "user", label: "Usuários" }, { key: "photographer", label: "Fotógrafos" }, { key: "organizer", label: "Organizadores" }, { key: "super_admin", label: "Admins" }].map(t => (
          <button key={t.key} onClick={() => setRoleFilter(t.key)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${roleFilter === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none">
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Recebimento (Asaas)</label>
            <select value={asaasFilter} onChange={e => setAsaasFilter(e.target.value)} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none">
              <option value="all">Todos</option>
              <option value="configured">Configurado</option>
              <option value="not_configured">Não configurado</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Atividade</label>
            <select value={activityFilter} onChange={e => setActivityFilter(e.target.value)} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none">
              <option value="all">Todos</option>
              <option value="with_sales">Com vendas</option>
              <option value="no_sales">Sem vendas</option>
            </select>
          </div>
        </div>
      )}

      {/* Audit Logs Panel */}
      {showLogs && (
        <div className="glass-card p-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Log de Alterações</h3>
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map(log => {
                const targetUser = users.find(u => u.user_id === log.target_user_id);
                const actionLabels: Record<string, string> = {
                  role_added: "Role adicionada",
                  role_removed: "Role removida",
                  user_blocked: "Usuário bloqueado",
                  user_unblocked: "Usuário desbloqueado",
                };
                return (
                  <div key={log.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                    <div>
                      <span className="font-medium">{actionLabels[log.action] || log.action}</span>
                      <span className="text-muted-foreground"> → {targetUser?.full_name || "Desconhecido"}</span>
                      {log.details?.role && <span className="ml-1 text-primary">({roleLabel[log.details.role] || log.details.role})</span>}
                    </div>
                    <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum registro encontrado</p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome..." className="bg-transparent text-sm outline-none w-full" />
        </div>
      </div>

      {/* Users list */}
      <div className="text-xs text-muted-foreground">{filtered.length} resultado(s)</div>
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((user) => {
            const asaasStatus = getAsaasStatus(user);
            return (
              <div key={user.id} className={`glass-card overflow-hidden ${user.blocked ? "border-destructive/30 border" : ""}`}>
                <button
                  onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={user.avatar_url ?? undefined} alt={user.full_name || "Usuário"} />
                      <AvatarFallback className={`text-xs font-bold ${user.blocked ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                        {(user.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{user.full_name || "Sem nome"}</p>
                        {user.blocked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">Bloqueado</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {user.phone || "Sem telefone"} • {formatDate(user.created_at)}
                        {user.last_sign_in_at && <span className="ml-1">• Último acesso: {formatDateTime(user.last_sign_in_at)}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Sales badge for photographers */}
                    {user.salesCount > 0 && (
                      <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 font-semibold">
                        {formatCurrency(user.totalSales)}
                      </span>
                    )}
                    {/* Asaas status */}
                    {asaasStatus && (
                      <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-semibold ${asaasStatus === "configured" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                        {asaasStatus === "configured" ? "Asaas ✓" : "Asaas ✗"}
                      </span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map(r => (
                        <span key={r} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadge[r]}`}>
                          {roleLabel[r]}
                        </span>
                      ))}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedUser === user.id ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {expandedUser === user.id && (
                  <div className="border-t border-border p-4 bg-secondary/20 space-y-4">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <p className="text-[10px] text-muted-foreground">Vendas</p>
                        <p className="text-sm font-bold">{user.salesCount}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <p className="text-[10px] text-muted-foreground">Total Vendido</p>
                        <p className="text-sm font-bold">{formatCurrency(user.totalSales)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <p className="text-[10px] text-muted-foreground">Última Venda</p>
                        <p className="text-sm font-bold">{formatDate(user.lastSale)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <p className="text-[10px] text-muted-foreground">Último Acesso</p>
                        <p className="text-sm font-bold">{user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Nunca"}</p>
                      </div>
                    </div>

                    {/* User behavior - events by plan */}
                    {Object.keys(user.eventsByPlan).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Comportamento do Usuário:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(user.eventsByPlan).map(([plan, count]) => (
                            <span key={plan} className="text-xs px-2.5 py-1 rounded-lg bg-background/50 font-medium">
                              {planIcons[plan] || "📋"} {count} evento(s) no {plan.charAt(0).toUpperCase() + plan.slice(1)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Asaas Status */}
                    {asaasStatus && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Recebimento:</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${asaasStatus === "configured" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                          {asaasStatus === "configured" ? "✓ Configurado" : "⚠ Não configurado"}
                        </span>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                      <a href={`/fotografo/${user.user_id}`} target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Ver perfil
                      </a>
                      <a href={`/admin/eventos?organizer=${user.user_id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors">
                        <Calendar className="w-3.5 h-3.5" /> Ver eventos
                      </a>
                      <a href={`/admin/pagamentos?user=${user.user_id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors">
                        <ShoppingBag className="w-3.5 h-3.5" /> Ver vendas
                      </a>
                      <button
                        onClick={() => handleToggleBlock(user.user_id, user.full_name || "Sem nome")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${user.blocked ? "bg-green-500/15 text-green-600 hover:bg-green-500/25" : "bg-destructive/15 text-destructive hover:bg-destructive/25"}`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        {user.blocked ? "Desbloquear" : "Bloquear"}
                      </button>
                    </div>

                    {/* Role Management */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Gerenciar Roles:</p>
                      <div className="flex flex-wrap gap-2">
                        {(["photographer", "organizer", "super_admin"] as AppRole[]).map(role => {
                          const has = user.roles.includes(role);
                          return (
                            <button
                              key={role}
                              onClick={() => handleToggleRole(user.user_id, user.full_name || "Sem nome", role, has)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${has ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
                            >
                              {has ? <CheckCircle className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                              {roleLabel[role]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <p className="text-sm">Nenhum usuário encontrado</p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar ação
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "toggle_role" && (
                <>
                  {confirmAction.hasIt
                    ? `Remover a role "${roleLabel[confirmAction.role!]}" de ${confirmAction.userName}?`
                    : `Adicionar a role "${roleLabel[confirmAction.role!]}" para ${confirmAction.userName}?`}
                </>
              )}
              {confirmAction?.type === "toggle_block" && (
                <>
                  {users.find(u => u.user_id === confirmAction.userId)?.blocked
                    ? `Desbloquear o usuário ${confirmAction.userName}?`
                    : `Bloquear o usuário ${confirmAction.userName}? Ele não poderá acessar a plataforma.`}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmedAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
