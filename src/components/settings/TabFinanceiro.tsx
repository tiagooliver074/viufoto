import { useState, useEffect } from "react";
import { Wallet, CheckCircle2, AlertTriangle, Loader2, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const InputField = ({ label, value, onChange, placeholder, required = false, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; disabled?: boolean;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-center gap-2 py-3 border-b border-border/50 last:border-0">
    <label className="text-sm text-muted-foreground font-medium">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-secondary/50 rounded-lg px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors disabled:opacity-50"
    />
  </div>
);

const TabFinanceiro = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    checkWallet();
  }, [user]);

  const checkWallet = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("asaas-wallet", {
        body: { action: "check_wallet" },
      });
      if (error) throw error;
      setConfigured(data.configured);
      setWalletId(data.walletId);
      if (data.name) setName(data.name);
      if (data.cpfCnpj) setCpfCnpj(data.cpfCnpj);
      if (data.phone) setPhone(data.phone);
      setEmail(user?.email || "");
    } catch (err) {
      console.error("Error checking wallet:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!name.trim()) missing.push("nome completo");
    if (!cpfCnpj.trim()) missing.push("CPF/CNPJ");
    if (!email.trim()) missing.push("e-mail");
    if (missing.length > 0) {
      toast.error(`Falta preencher: ${missing.join(", ")}. Complete os dados para ativar o recebimento.`);
      return;
    }

    const cleanCpf = cpfCnpj.replace(/\D/g, "");
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      toast.error("CPF ou CNPJ inválido");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-wallet", {
        body: {
          action: "create_wallet",
          name: name.trim(),
          email: email.trim(),
          cpfCnpj: cpfCnpj.trim(),
          phone: phone.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setConfigured(true);
      setWalletId(data.walletId);
      toast.success("Recebimento configurado com sucesso! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Erro ao configurar recebimento");
    } finally {
      setSaving(false);
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
      <div>
        <h2 className="text-xl font-bold">Financeiro</h2>
        <p className="text-sm text-muted-foreground">Configure seu recebimento para começar a vender</p>
      </div>

      {/* Status Card */}
      <div className={`glass-card p-5 flex items-center gap-4 border-l-4 ${
        configured ? "border-l-emerald-500" : "border-l-amber-500"
      }`}>
        {configured ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Recebimento ativo</p>
              <p className="text-sm text-muted-foreground">
                Suas vendas serão processadas automaticamente. Wallet: <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{walletId}</code>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Recebimento não configurado</p>
              <p className="text-sm text-muted-foreground">
                Preencha os dados abaixo para ativar o recebimento e começar a vender suas fotos.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Form */}
      <div className="glass-card p-6 space-y-0">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
          <Wallet className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Dados para recebimento</h3>
        </div>
        <InputField
          label="Nome completo / Razão social"
          value={name}
          onChange={setName}
          placeholder="Seu nome completo ou razão social"
          required
          disabled={configured}
        />
        <InputField
          label="E-mail"
          value={email}
          onChange={setEmail}
          placeholder="seu@email.com"
          required
          disabled={configured}
        />
        <InputField
          label="CPF ou CNPJ"
          value={cpfCnpj}
          onChange={setCpfCnpj}
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          required
          disabled={configured}
        />
        <InputField
          label="Telefone"
          value={phone}
          onChange={setPhone}
          placeholder="(00) 00000-0000"
          disabled={configured}
        />
      </div>

      {/* Security note */}
      <div className="glass-card p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Seus dados financeiros são protegidos por criptografia. A ViuFoto retém uma pequena porcentagem sobre cada venda realizada.
          O restante do valor é repassado automaticamente para você.
        </p>
      </div>

      {!configured && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Configurando..." : "Configurar recebimento"}
        </button>
      )}
    </div>
  );
};

export default TabFinanceiro;
