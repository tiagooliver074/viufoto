import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  User, Globe, Image, Wallet, Star, MessageSquare, Smartphone,
  Save, Eye, EyeOff, Plus, Trash2, QrCode, Share2, Shield, LogOut, Copy, Check,
  Upload, ChevronRight, Lock, Bell, Mail, Phone, Loader2
} from "lucide-react";
import TabMarcaDagua from "@/components/settings/TabMarcaDagua";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, PageSubtitle, SectionTitle, CardTitle } from "@/components/ui/Typography";

const settingsTabs = [
  { id: "conta", label: "Minha conta", short: "Conta", desc: "Dados pessoais e acesso", icon: User },
  { id: "site", label: "Meu site", short: "Site", desc: "Perfil público e portfólio", icon: Globe },
  { id: "marca", label: "Marca d'água", short: "Marca", desc: "Proteção das suas mídias", icon: Shield },
  { id: "carteira", label: "Carteira", short: "Carteira", desc: "Recebimentos e saques", icon: Wallet },
  { id: "dispositivos", label: "Dispositivos", short: "Sessões", desc: "Sessões ativas da conta", icon: Smartphone },
];

// Mock data for other tabs

const mockDevices = [
  { id: 1, name: "Chrome — Windows 11", ip: "189.44.120.33", location: "São Paulo, BR", lastActive: "Agora (sessão atual)", current: true },
  { id: 2, name: "Safari — iPhone 15", ip: "189.44.120.35", location: "São Paulo, BR", lastActive: "Há 2 horas", current: false },
  { id: 3, name: "Firefox — macOS", ip: "201.12.55.90", location: "Rio de Janeiro, BR", lastActive: "Há 3 dias", current: false },
];

const InputField = ({ label, value, type = "text", disabled = false, onChange }: {
  label: string; value: string; type?: string; disabled?: boolean; onChange?: (v: string) => void;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-center gap-2 py-3 border-b border-border/50 last:border-0">
    <label className="text-sm text-muted-foreground font-medium">{label}</label>
    <input
      type={type}
      defaultValue={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full bg-secondary/50 rounded-lg px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors disabled:opacity-50"
    />
  </div>
);

const SelectField = ({ label, value, options }: { label: string; value: string; options: string[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-center gap-2 py-3 border-b border-border/50 last:border-0">
    <label className="text-sm text-muted-foreground font-medium">{label}</label>
    <select defaultValue={value} className="w-full bg-secondary/50 rounded-lg px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors appearance-none">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ─── Tab: Minha Conta ───
const TabConta = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [hasWallet, setHasWallet] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fullNameUpdatedAt, setFullNameUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, cpf_cnpj, avatar_url, full_name_updated_at")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setCpf(data.cpf_cnpj || "");
        // CPF/data de nascimento travam assim que o recebimento é configurado
        // (cpf_cnpj preenchido), já que o saldo interno/saque usam esse CPF
        // para conferência de titularidade.
        setHasWallet(!!data.cpf_cnpj);
        setAvatarUrl(data.avatar_url || null);
        setFullNameUpdatedAt((data as any).full_name_updated_at || null);
      }
      // Try to get birth date from user metadata
      const meta = user.user_metadata;
      if (meta?.birth_date) setBirthDate(meta.birth_date);
      setLoading(false);
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      if (cleanCpf && cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        toast.error("CPF ou CNPJ inválido.");
        setSaving(false);
        return;
      }
      // Atualiza nome/telefone/CPF no perfil. CPF e data de nascimento só são
      // enviados quando a carteira ainda não foi ativada (hasWallet=false);
      // uma vez ativada, ambos ficam travados na UI e não chegam aqui.
      const profileUpdate: Record<string, unknown> = { full_name: fullName, phone };
      if (!hasWallet) profileUpdate.cpf_cnpj = cleanCpf || null;
      const { error } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", user.id);
      if (error) throw error;

      // Data de nascimento não tem coluna própria em "profiles" — fica em
      // user_metadata (auth.users), por isso precisa de uma chamada separada.
      if (!hasWallet && birthDate) {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { birth_date: birthDate },
        });
        if (metaError) throw metaError;
      }

      toast.success("Seus dados foram atualizados com sucesso.");
      // Recarrega timestamp (cooldown do nome) e o estado de "carteira ativada",
      // já que salvar o CPF aqui também destrava/trava os mesmos campos.
      const { data: fresh } = await supabase
        .from("profiles")
        .select("full_name_updated_at, cpf_cnpj")
        .eq("user_id", user.id)
        .single();
      if (fresh) {
        setFullNameUpdatedAt((fresh as any).full_name_updated_at || null);
        setHasWallet(!!(fresh as any).cpf_cnpj);
      }
    } catch (err: any) {
      toast.error(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo de 5MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("photographer-assets")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("photographer-assets").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);
      if (updErr) throw updErr;
      setAvatarUrl(publicUrl);
      await refreshProfile();
      toast.success("Foto de perfil atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível enviar a foto.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", user.id);
      if (error) throw error;
      setAvatarUrl(null);
      await refreshProfile();
      toast.success("Foto removida.");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível remover a foto.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Foto de perfil */}
      <div className="glass-card p-6">
        <CardTitle className="mb-4 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Foto de perfil</CardTitle>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary border border-border flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={`px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-all flex items-center gap-2 ${uploadingAvatar ? "opacity-50 pointer-events-none" : ""}`}>
              {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {avatarUrl ? "Trocar foto" : "Enviar foto"}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
            {avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary/50 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Remover
              </button>
            )}
            <p className="w-full text-xs text-muted-foreground mt-1">JPG, PNG ou WebP até 5MB. Aparecerá no menu superior e no seu perfil público.</p>
          </div>
        </div>
      </div>

      {/* Dados básicos */}
      {(() => {
        const lockedUntil = fullNameUpdatedAt
          ? new Date(new Date(fullNameUpdatedAt).getTime() + 15 * 24 * 60 * 60 * 1000)
          : null;
        const nameLocked = !!(lockedUntil && lockedUntil.getTime() > Date.now());
        const daysRemaining = nameLocked && lockedUntil
          ? Math.ceil((lockedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : 0;
        return (
          <div className="glass-card p-6 space-y-0">
            <InputField
              label="Nome completo"
              value={fullName}
              onChange={nameLocked ? undefined : setFullName}
              disabled={nameLocked}
            />
            {nameLocked && lockedUntil && (
              <p className="text-xs text-muted-foreground -mt-2 pb-3">
                Você poderá alterar o nome novamente em {daysRemaining} dia{daysRemaining === 1 ? "" : "s"} (liberado em {lockedUntil.toLocaleDateString("pt-BR")}).
              </p>
            )}
            <InputField label="E-mail" value={email} disabled />
            <InputField label="CPF" value={cpf} disabled={hasWallet} onChange={!hasWallet ? setCpf : undefined} />
            <InputField label="Data de nascimento" value={birthDate} type="date" disabled={hasWallet} onChange={!hasWallet ? setBirthDate : undefined} />
            {hasWallet && (
              <div className="pt-2 space-y-1">
                <p className="text-xs text-muted-foreground">CPF e data de nascimento não podem ser alterados após ativação do recebimento.</p>
                <Link
                  to="/chamados/novo?categoria=alteracao_dados&assunto=Alteracao%20de%20CPF"
                  className="text-xs text-primary hover:underline inline-block"
                >
                  Preciso alterar meu CPF
                </Link>
              </div>
            )}
          </div>
        );
      })()}

      {/* Contato */}
      <div className="glass-card p-6 space-y-0">
        <CardTitle className="mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Contato</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-center gap-2 py-3">
          <label className="text-sm text-muted-foreground font-medium">Celular</label>
          <div className="flex items-center gap-2">
            <span className="bg-secondary/50 rounded-lg px-3 py-2.5 text-sm border border-border">🇧🇷 +55</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="flex-1 bg-secondary/50 rounded-lg px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Segurança */}
      <div className="glass-card p-6">
        <CardTitle className="mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Segurança</CardTitle>
        <button
          onClick={() => toast.info("Funcionalidade de alteração de senha será integrada em breve.")}
          className="px-5 py-2.5 rounded-xl border-2 border-primary text-primary font-bold text-sm hover:bg-primary/10 transition-all"
        >
          ALTERAR SENHA
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] flex items-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar alterações
      </button>
    </div>
  );
};

// ─── Tab: Meu Site ───
import MeuSiteTab from "@/components/settings/MeuSiteTab";
const TabSite = MeuSiteTab;
import TabCarteira from "@/components/settings/TabCarteira";

// ─── Tab: Portfólio ───
const TabPortfolio = () => {
  const categories = ["Corrida", "Ciclismo", "Triathlon", "Trail Run"];
  const [selectedCat, setSelectedCat] = useState("Corrida");
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Meu portfólio</SectionTitle>
        <p className="body-small text-muted-foreground">Selecione suas melhores fotos para exibir publicamente</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCat(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCat === cat ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
            {cat}
          </button>
        ))}
        <button className="px-4 py-2 rounded-full text-sm font-medium bg-secondary/50 text-muted-foreground hover:bg-secondary flex items-center gap-1">
          <Plus className="w-3 h-3" /> Nova categoria
        </button>
      </div>
      <div className="glass-card p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="aspect-square rounded-xl bg-secondary/50 border border-border overflow-hidden relative group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <div className="flex gap-2">
                  <button className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30"><Star className="w-3.5 h-3.5 text-white" /></button>
                  <button className="p-1.5 rounded-lg bg-white/20 hover:bg-red-500/60"><Trash2 className="w-3.5 h-3.5 text-white" /></button>
                </div>
              </div>
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Image className="w-8 h-8" />
              </div>
            </div>
          ))}
          <div className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary flex items-center justify-center cursor-pointer transition-colors group">
            <div className="text-center">
              <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Adicionar</p>
            </div>
          </div>
        </div>
      </div>
      <button onClick={() => toast.success("Portfólio salvo!")} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] flex items-center gap-2">
        <Save className="w-4 h-4" /> Salvar portfólio
      </button>
    </div>
  );
};

// TabBanco removed — replaced by TabCarteira

// ─── Tab: Exclusividade ───
const TabExclusividade = () => {
  const [exclusive, setExclusive] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Exclusividade</SectionTitle>
        <p className="body-small text-muted-foreground">Defina se você atua exclusivamente com a VIUFOTO</p>
      </div>
      <div className="glass-card p-6">
        <div className="flex items-start gap-4">
          <button onClick={() => setExclusive(!exclusive)}
            className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 mt-1 ${exclusive ? "bg-primary" : "bg-secondary"}`}>
            <div className={`w-6 h-6 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${exclusive ? "left-7" : "left-0.5"}`} />
          </button>
          <div>
            <CardTitle>{exclusive ? "Exclusividade ativada" : "Sem exclusividade"}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {exclusive
                ? "Você é um fotógrafo exclusivo VIUFOTO. Benefícios especiais estão ativos."
                : "Ative a exclusividade para desbloquear benefícios especiais."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[
            { label: "Comissão reduzida", desc: "Até 10% menor", active: exclusive },
            { label: "Destaque em eventos", desc: "Prioridade na seleção", active: exclusive },
            { label: "Selo exclusivo", desc: "Badge no perfil público", active: exclusive },
          ].map(b => (
            <div key={b.label} className={`p-4 rounded-xl border transition-all ${b.active ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/20 opacity-50"}`}>
              <p className="font-semibold text-sm">{b.label}</p>
              <p className="text-xs text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Tab: SmartCard ───
const TabSmartCard = () => (
  <div className="space-y-6">
    <div>
      <SectionTitle>SmartCard</SectionTitle>
      <p className="text-sm text-muted-foreground">Seu cartão digital profissional</p>
    </div>
    <div className="glass-card p-6">
      <div className="max-w-sm mx-auto">
        <div className="aspect-[1.6/1] rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] p-6 text-white flex flex-col justify-between shadow-xl">
          <div>
            <p className="text-xs opacity-70">VIUFOTO PRO</p>
            <CardTitle className="mt-1">Tiago Oliver</CardTitle>
            <p className="text-xs opacity-80">Fotógrafo Esportivo</p>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs opacity-70">Desde 2023</p>
              <p className="text-xs opacity-70">156 eventos · 12.450 fotos</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <QrCode className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-center">
          <button onClick={() => { navigator.clipboard.writeText("https://viufoto.com/tiagooliverfotografias"); toast.success("Link copiado!"); }}
            className="px-5 py-2.5 rounded-xl bg-secondary/50 text-sm font-medium flex items-center gap-2 hover:bg-secondary transition-colors">
            <Copy className="w-4 h-4" /> Copiar link
          </button>
          <button className="px-5 py-2.5 rounded-xl bg-secondary/50 text-sm font-medium flex items-center gap-2 hover:bg-secondary transition-colors">
            <Share2 className="w-4 h-4" /> Compartilhar
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Tab: Comunicação ───
const TabComunicacao = () => {
  const [prefs, setPrefs] = useState({
    emailVendas: true, emailPedidos: true, emailEventos: false,
    whatsVendas: true, whatsPedidos: false, whatsEventos: true,
    pushVendas: false, pushPedidos: false, pushEventos: false,
  });
  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange} className={`w-11 h-6 rounded-full transition-all relative ${checked ? "bg-primary" : "bg-secondary"}`}>
      <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${checked ? "left-5" : "left-0.5"}`} />
    </button>
  );
  const channels = [
    { key: "Vendas", icon: <Bell className="w-4 h-4" />, desc: "Notificação quando uma foto ou vídeo for vendido" },
    { key: "Pedidos", icon: <Bell className="w-4 h-4" />, desc: "Alertas sobre novos pedidos recebidos" },
    { key: "Eventos", icon: <Bell className="w-4 h-4" />, desc: "Oportunidades de eventos disponíveis na sua região" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Comunicação</SectionTitle>
        <p className="text-sm text-muted-foreground">Configure como deseja receber notificações</p>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Alerta</th>
              <th className="px-5 py-3 text-center font-semibold text-muted-foreground"><Mail className="w-4 h-4 mx-auto" /></th>
              <th className="px-5 py-3 text-center font-semibold text-muted-foreground"><Phone className="w-4 h-4 mx-auto" /></th>
              <th className="px-5 py-3 text-center font-semibold text-muted-foreground"><Bell className="w-4 h-4 mx-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {channels.map(ch => (
              <tr key={ch.key} className="border-b border-border/30">
                <td className="px-5 py-4">
                  <p className="font-medium">{ch.key}</p>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex justify-center">
                    <Toggle checked={(prefs as any)[`email${ch.key}`]} onChange={() => setPrefs(p => ({ ...p, [`email${ch.key}`]: !(p as any)[`email${ch.key}`] }))} />
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex justify-center">
                    <Toggle checked={(prefs as any)[`whats${ch.key}`]} onChange={() => setPrefs(p => ({ ...p, [`whats${ch.key}`]: !(p as any)[`whats${ch.key}`] }))} />
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex justify-center">
                    <Toggle checked={(prefs as any)[`push${ch.key}`]} onChange={() => setPrefs(p => ({ ...p, [`push${ch.key}`]: !(p as any)[`push${ch.key}`] }))} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => toast.success("Preferências salvas!")} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] flex items-center gap-2">
        <Save className="w-4 h-4" /> Salvar preferências
      </button>
    </div>
  );
};

// ─── Tab: Dispositivos ───
const TabDispositivos = () => (
  <div className="space-y-6">
    <div className="space-y-3">
      {mockDevices.map(d => (
        <div key={d.id} className={`glass-card p-5 flex items-center justify-between ${d.current ? "border border-primary/30" : ""}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.current ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                {d.name}
                {d.current && <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">Atual</span>}
              </p>
              <p className="text-xs text-muted-foreground">{d.ip} · {d.location}</p>
              <p className="text-xs text-muted-foreground">{d.lastActive}</p>
            </div>
          </div>
          {!d.current && (
            <button onClick={() => toast.success("Sessão encerrada!")} className="px-4 py-2 rounded-lg text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Encerrar
            </button>
          )}
        </div>
      ))}
    </div>
    <button onClick={() => toast.success("Todas as outras sessões foram encerradas!")}
      className="px-5 py-2.5 rounded-xl border border-destructive text-destructive font-bold text-sm hover:bg-destructive/10 transition-all flex items-center gap-2">
      <LogOut className="w-4 h-4" /> Encerrar todas as outras sessões
    </button>
  </div>
);

// ─── Main Component ───
const tabComponents: Record<string, React.FC> = {
  conta: TabConta,
  site: TabSite,
  marca: TabMarcaDagua,
  carteira: TabCarteira,
  dispositivos: TabDispositivos,
};

const Configuracoes = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && tabComponents[tab] ? tab : "conta";
  });
  const ActiveComponent = tabComponents[activeTab];
  const current = settingsTabs.find(t => t.id === activeTab) ?? settingsTabs[0];

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-4 pt-24 lg:pt-10 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho da página — padrão VIU FOTO */}
          <header className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <current.icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <PageSubtitle className="font-semibold uppercase tracking-wide">Configurações</PageSubtitle>
                <PageTitle className="truncate">{current.label}</PageTitle>
              </div>
            </div>
            <p className="body-small text-muted-foreground mt-2">{current.desc}</p>
          </header>

          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Navegação — pílulas no mobile, lista no desktop */}
            <nav className="lg:w-64 flex-shrink-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              <div className="lg:sticky lg:top-8 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible scrollbar-hide pb-1 lg:pb-0">
                {settingsTabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium whitespace-nowrap transition-all min-h-[44px] border lg:w-full text-left ${
                        isActive
                          ? "bg-card border-primary/30 text-foreground shadow-[0_4px_16px_-8px_hsl(var(--primary)/0.5)]"
                          : "bg-card/60 border-transparent text-muted-foreground hover:bg-card hover:border-border hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                      </span>
                      <span className="hidden lg:flex flex-col min-w-0">
                        <span className={`truncate ${isActive ? "font-semibold text-primary" : ""}`}>{tab.label}</span>
                        <span className="text-xs text-muted-foreground font-normal truncate">{tab.desc}</span>
                      </span>
                      <span className="lg:hidden">{tab.short}</span>
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto hidden lg:block text-primary" />}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <ActiveComponent />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Configuracoes;
