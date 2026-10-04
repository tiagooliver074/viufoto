import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Search, Trash2, UserPlus, Info, X, Users, Handshake, Percent } from "lucide-react";

type Tab = "comissao" | "fotografos" | "parceiros";

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  ownerCommissionPct: number;
  collabNote: string | null;
}

const PLATFORM_FEE = 10; // ViuFoto

export default function CollaborationModal({ open, onClose, eventId, ownerCommissionPct, collabNote }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("comissao");
  const [pct, setPct] = useState<number>(ownerCommissionPct || 0);
  const [note, setNote] = useState<string>(collabNote || "");

  useEffect(() => { setPct(ownerCommissionPct || 0); setNote(collabNote || ""); }, [ownerCommissionPct, collabNote, open]);

  // ---------- Fotógrafos ----------
  const photographersQ = useQuery({
    queryKey: ["event-photographers", eventId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("event_photographers")
        .select("id, photographer_id, commission_pct, status, note, invited_at")
        .eq("event_id", eventId);
      if (error) throw error;
      const ids = (rows || []).map(r => r.photographer_id);
      let profiles: any[] = [];
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("user_id, full_name, avatar_url, cpf_cnpj").in("user_id", ids);
        profiles = ps || [];
      }
      return (rows || []).map(r => ({ ...r, profile: profiles.find(p => p.user_id === r.photographer_id) }));
    },
    enabled: open,
  });

  // ---------- Parceiros ----------
  const partnersQ = useQuery({
    queryKey: ["event-partners", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_partners")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // ---------- Save commission + note ----------
  const saveCommission = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").update({ owner_commission_pct: pct, collab_note: note || null }).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Comissão atualizada!"); qc.invalidateQueries({ queryKey: ["event", eventId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // ---------- Photographer search ----------
  const [searchTerm, setSearchTerm] = useState("");
  const [photographerNote, setPhotographerNote] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);

  const searchQ = useQuery({
    queryKey: ["photographer-search", searchTerm],
    queryFn: async () => {
      if (searchTerm.trim().length < 2) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "photographer");
      const ids = (roles || []).map(r => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles")
        .select("user_id, full_name, avatar_url, cpf_cnpj")
        .in("user_id", ids)
        .ilike("full_name", `%${searchTerm}%`)
        .limit(8);
      return data || [];
    },
    enabled: open && tab === "fotografos" && searchTerm.trim().length >= 2,
  });

  const inviteMut = useMutation({
    mutationFn: async (photographerId: string) => {
      const { error } = await supabase.from("event_photographers").insert({
        event_id: eventId,
        photographer_id: photographerId,
        commission_pct: 0,
        status: "pendente",
        note: photographerNote || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fotógrafo convidado!");
      setSearchTerm(""); setPhotographerNote(""); setShowNoteField(false);
      qc.invalidateQueries({ queryKey: ["event-photographers", eventId] });
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Fotógrafo já convidado" : e.message),
  });

  const removePhotographerMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_photographers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-photographers", eventId] }); toast.success("Removido"); },
  });

  // ---------- Partner add ----------
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerPct, setPartnerPct] = useState<number>(0);
  const [partnerPerms, setPartnerPerms] = useState({ view_orders: true, view_financial: false, manage_photos: false });

  const addPartnerMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("event_partners").insert({
        event_id: eventId,
        partner_name: partnerName,
        partner_email: partnerEmail || null,
        commission_pct: partnerPct,
        permissions: partnerPerms as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parceiro adicionado!");
      setPartnerName(""); setPartnerEmail(""); setPartnerPct(0);
      qc.invalidateQueries({ queryKey: ["event-partners", eventId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removePartnerMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-partners", eventId] }); toast.success("Removido"); },
  });

  // ---------- Pie chart ----------
  const partnersTotal = (partnersQ.data || []).reduce((s, p) => s + Number(p.commission_pct || 0), 0);
  const photographersShare = Math.max(0, 100 - PLATFORM_FEE - pct - partnersTotal);
  const pieData = [
    { name: "ViuFoto", value: PLATFORM_FEE, color: "hsl(var(--primary))" },
    { name: "Você (organizador)", value: pct, color: "#3B82F6" },
    ...(partnersQ.data || []).map((p, i) => ({ name: p.partner_name, value: Number(p.commission_pct), color: ["#F59E0B", "#8B5CF6"][i] || "#94A3B8" })),
    { name: "Fotógrafos", value: photographersShare, color: "#84CC16" },
  ].filter(d => d.value > 0);

  const overflow = pct + partnersTotal + PLATFORM_FEE > 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Colaboração
          </DialogTitle>
          <DialogDescription>
            Adicione e convide fotógrafos para participar da galeria do evento. Os fotógrafos convidados poderão enviar fotos após o horário de término.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-b border-border flex gap-6 mb-4">
          {([
            { k: "comissao", label: "Sua comissão" },
            { k: "fotografos", label: "Fotógrafos" },
            { k: "parceiros", label: "Parceiros" },
          ] as { k: Tab; label: string }[]).map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label} {t.k === "parceiros" && <span className="text-xs ml-1 text-muted-foreground">{(partnersQ.data || []).length}/2</span>}
            </button>
          ))}
        </div>

        {/* ---------- COMISSÃO ---------- */}
        {tab === "comissao" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1">
                  Sua comissão sobre vendas dos colaboradores <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Percentual que você recebe das vendas feitas por fotógrafos convidados (descontada a taxa ViuFoto de {PLATFORM_FEE}%).
                </p>
                <div className="flex">
                  <Input
                    type="number" min={0} max={100 - PLATFORM_FEE} step={1}
                    value={pct}
                    onChange={(e) => setPct(Math.max(0, Math.min(100 - PLATFORM_FEE, Number(e.target.value))))}
                    className="rounded-r-none"
                  />
                  <div className="px-4 flex items-center border border-l-0 border-input rounded-r-md bg-muted text-sm text-muted-foreground">%</div>
                </div>
                {overflow && <p className="text-xs text-destructive mt-1">A soma dos percentuais excede 100%.</p>}
              </div>
              <div>
                <Label className="text-sm font-semibold">Mensagem ao colaborador (opcional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex.: Envie suas fotos identificadas até 24h após o evento."
                  rows={3}
                  className="mt-2"
                  maxLength={500}
                />
              </div>
              <Button onClick={() => saveCommission.mutate()} disabled={saveCommission.isPending || overflow} className="w-full">
                {saveCommission.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 flex flex-col items-center">
              <p className="text-xs font-medium text-muted-foreground mb-2">Distribuição de receita</p>
              <div className="w-full h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ---------- FOTÓGRAFOS ---------- */}
        {tab === "fotografos" && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1">
                Adicionar fotógrafos <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Apenas fotógrafos cadastrados na ViuFoto. Eles serão notificados sobre a colaboração.
              </p>
              <div className="flex gap-2 mt-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o nome do fotógrafo"
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" type="button" onClick={() => setShowNoteField(s => !s)}>
                  <UserPlus className="w-4 h-4 mr-1" /> Nota
                </Button>
              </div>
              {showNoteField && (
                <Textarea
                  value={photographerNote}
                  onChange={(e) => setPhotographerNote(e.target.value)}
                  placeholder="Mensagem privada para o fotógrafo (opcional)"
                  className="mt-2"
                  rows={2}
                />
              )}
              <p className="text-[11px] text-muted-foreground mt-1">O fotógrafo convidado deve ter sua conta de pagamento configurada.</p>

              {/* Search results */}
              {searchTerm.length >= 2 && (
                <div className="mt-3 border border-border rounded-lg max-h-56 overflow-y-auto">
                  {searchQ.isLoading && <p className="text-center text-xs text-muted-foreground p-4">Buscando...</p>}
                  {!searchQ.isLoading && (searchQ.data || []).length === 0 && (
                    <p className="text-center text-xs text-muted-foreground p-4">Nenhum fotógrafo encontrado</p>
                  )}
                  {(searchQ.data || []).map(p => {
                    const ready = !!p.cpf_cnpj;
                    return (
                      <div key={p.user_id} className="flex items-center justify-between p-3 hover:bg-muted/40 border-b last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {(p.full_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.full_name || "Sem nome"}</p>
                            <p className={`text-[10px] ${ready ? "text-lime-600" : "text-amber-600"}`}>
                              {ready ? "Conta de pagamento ✓" : "Conta de pagamento pendente"}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" disabled={!ready || inviteMut.isPending} onClick={() => inviteMut.mutate(p.user_id)}>
                          Convidar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lista convidados */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2">
                <span className="col-span-6">Fotógrafo</span>
                <span className="col-span-3">Status</span>
                <span className="col-span-2">Convidado</span>
                <span className="col-span-1 text-right">Ações</span>
              </div>
              {(photographersQ.data || []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum fotógrafo adicionado</p>
              ) : (
                (photographersQ.data || []).map(r => (
                  <div key={r.id} className="grid grid-cols-12 gap-2 items-center px-4 py-3 border-t border-border text-sm">
                    <div className="col-span-6 flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(r.profile?.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{r.profile?.full_name || r.photographer_id.slice(0, 8)}</span>
                    </div>
                    <span className={`col-span-3 text-xs px-2 py-0.5 rounded-full inline-block w-fit ${
                      r.status === "aceito" ? "bg-lime-100 text-lime-700" :
                      r.status === "recusado" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{r.status}</span>
                    <span className="col-span-2 text-xs text-muted-foreground">
                      {new Date(r.invited_at).toLocaleDateString("pt-BR")}
                    </span>
                    <button onClick={() => removePhotographerMut.mutate(r.id)} className="col-span-1 text-destructive hover:bg-destructive/10 rounded p-1 justify-self-end">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------- PARCEIROS ---------- */}
        {tab === "parceiros" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Parceiros (assessoria, marketing, equipe técnica) recebem um percentual sobre as vendas e podem ter acesso parcial ao evento. Limite de 2 parceiros.
            </p>
            {(partnersQ.data || []).length < 2 && (
              <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome do parceiro *</Label>
                    <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Ex.: Agência X" />
                  </div>
                  <div>
                    <Label className="text-xs">E-mail (opcional)</Label>
                    <Input value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} type="email" placeholder="contato@parceiro.com" />
                  </div>
                  <div>
                    <Label className="text-xs">Comissão (%)</Label>
                    <div className="flex">
                      <Input type="number" min={0} max={50} value={partnerPct}
                        onChange={(e) => setPartnerPct(Math.max(0, Math.min(50, Number(e.target.value))))}
                        className="rounded-r-none" />
                      <div className="px-3 flex items-center border border-l-0 border-input rounded-r-md bg-muted text-sm text-muted-foreground"><Percent className="w-3 h-3" /></div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs font-semibold">Permissões</p>
                  {([
                    { k: "view_orders" as const, label: "Visualizar pedidos" },
                    { k: "view_financial" as const, label: "Visualizar financeiro" },
                    { k: "manage_photos" as const, label: "Gerenciar fotos" },
                  ]).map(p => (
                    <div key={p.k} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{p.label}</span>
                      <Switch checked={partnerPerms[p.k]} onCheckedChange={(v) => setPartnerPerms(s => ({ ...s, [p.k]: v }))} />
                    </div>
                  ))}
                </div>
                <Button onClick={() => addPartnerMut.mutate()} disabled={!partnerName.trim() || addPartnerMut.isPending} className="w-full">
                  <Handshake className="w-4 h-4 mr-2" /> Adicionar parceiro
                </Button>
              </div>
            )}

            {/* Lista */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2">
                <span className="col-span-5">Parceiro</span>
                <span className="col-span-2">%</span>
                <span className="col-span-4">Permissões</span>
                <span className="col-span-1 text-right">Ações</span>
              </div>
              {(partnersQ.data || []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum parceiro adicionado</p>
              ) : (
                (partnersQ.data || []).map((p: any) => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-center px-4 py-3 border-t border-border text-sm">
                    <div className="col-span-5 min-w-0">
                      <p className="truncate font-medium">{p.partner_name}</p>
                      {p.partner_email && <p className="text-[11px] text-muted-foreground truncate">{p.partner_email}</p>}
                    </div>
                    <span className="col-span-2 font-semibold">{p.commission_pct}%</span>
                    <div className="col-span-4 flex flex-wrap gap-1">
                      {p.permissions?.view_orders && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Pedidos</span>}
                      {p.permissions?.view_financial && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Financeiro</span>}
                      {p.permissions?.manage_photos && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Fotos</span>}
                    </div>
                    <button onClick={() => removePartnerMut.mutate(p.id)} className="col-span-1 text-destructive hover:bg-destructive/10 rounded p-1 justify-self-end">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}