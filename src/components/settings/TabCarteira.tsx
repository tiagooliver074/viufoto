import { useState, useEffect, useRef } from "react";
import {
  Wallet, CheckCircle2, AlertTriangle, Loader2, Save, Shield, ArrowRight,
  Eye, EyeOff, Info, Clock, Ban, CheckCircle, CreditCard, Plus, Trash2,
  Lock, Bell, Mail, RefreshCw, User as UserIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountUp } from "@/components/financeiro/useCountUp";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const InputField = ({ label, value, onChange, placeholder, required = false, disabled = false, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; disabled?: boolean; type?: string;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-center gap-2 py-3 border-b border-border/50 last:border-0">
    <label className="text-sm text-muted-foreground font-medium">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-secondary/50 rounded-lg px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors disabled:opacity-50"
    />
  </div>
);

type WithdrawalAccount = {
  id: string;
  account_type: string;
  pix_key: string | null;
  pix_key_type: string | null;
  bank_name: string | null;
  agency: string | null;
  account_number: string | null;
  label: string | null;
  status: string;
  activated_at: string;
  created_at: string;
  cpf_cnpj: string;
};

type WithdrawalLog = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  withdrawal_accounts: { label: string | null; pix_key: string | null; pix_key_type: string | null; account_type: string } | null;
};

const TabCarteira = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [visible, setVisible] = useState(true);

  // Onboarding form
  const [name, setName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");

  // Wallet data
  const [balance, setBalance] = useState(0);
  const [pending, setPending] = useState(0);
  const [accounts, setAccounts] = useState<WithdrawalAccount[]>([]);
  const [transfers, setTransfers] = useState<WithdrawalLog[]>([]);

  // Add account form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newPixKey, setNewPixKey] = useState("");
  const [newPixKeyType, setNewPixKeyType] = useState("CPF");
  const [addingAccount, setAddingAccount] = useState(false);

  // Withdrawal form
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");

  // 2FA state
  const [withdrawStep, setWithdrawStep] = useState<"form" | "2fa">("form");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [sending2FA, setSending2FA] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const animBalance = useCountUp(balance, 1000, visible);
  const animPending = useCountUp(pending, 1000, visible);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  // Cleanup resend timer
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(30);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [walletRes, balanceRes, accountsRes, transfersRes] = await Promise.all([
        supabase.functions.invoke("asaas-wallet", { body: { action: "check_wallet" } }),
        supabase.functions.invoke("asaas-wallet", { body: { action: "get_balance" } }),
        supabase.functions.invoke("asaas-wallet", { body: { action: "list_withdrawal_accounts" } }),
        supabase.functions.invoke("asaas-wallet", { body: { action: "get_transfers" } }),
      ]);

      const wallet = walletRes.data;
      if (wallet) {
        setConfigured(wallet.configured);
        if (wallet.name) setName(wallet.name);
        if (wallet.cpfCnpj) setCpfCnpj(wallet.cpfCnpj);
        if (wallet.phone) setPhone(wallet.phone);
      }

      if (balanceRes.data) {
        setBalance(balanceRes.data.balance ?? 0);
        setPending(balanceRes.data.pending ?? 0);
      }

      if (accountsRes.data?.accounts) setAccounts(accountsRes.data.accounts);
      if (transfersRes.data?.transfers) setTransfers(transfersRes.data.transfers);
    } catch (err) {
      console.error("Error loading wallet data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !cpfCnpj.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!phone.trim()) {
      toast.error("Telefone é obrigatório");
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
          cpfCnpj: cleanCpf,
          phone: phone.replace(/\D/g, ""),
        },
      });
      if (error) {
        // Try to extract message from edge function response
        const msg = typeof error === "object" && error.message ? error.message : "Erro ao salvar dados";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setConfigured(true);
      toast.success("Dados salvos! Agora cadastre uma chave PIX para receber. 🎉");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar dados");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newPixKey.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }
    setAddingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-wallet", {
        body: { action: "add_withdrawal_account", accountType: "pix", pixKey: newPixKey.trim(), pixKeyType: newPixKeyType },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Conta cadastrada!");
      setShowAddAccount(false);
      setNewPixKey("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar conta");
    } finally {
      setAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("asaas-wallet", {
        body: { action: "delete_withdrawal_account", accountId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Conta removida.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover conta");
    }
  };

  // Submit withdrawal directly (2FA bypassed temporarily)
  const handleWithdrawSubmit = async () => {
    const amount = parseFloat(withdrawAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!selectedAccountId) {
      toast.error("Selecione uma conta cadastrada");
      return;
    }
    if (!withdrawPassword) {
      toast.error("Confirme sua senha para realizar o saque");
      return;
    }

    setWithdrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-wallet", {
        body: {
          action: "request_withdrawal",
          accountId: selectedAccountId,
          amount,
          password: withdrawPassword,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Saque solicitado!");
      setShowWithdraw(false);
      setWithdrawAmount("");
      setWithdrawPassword("");
      setSelectedAccountId("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar saque");
    } finally {
      setWithdrawing(false);
    }
  };

  // Step 2: Confirm with 2FA code
  const handleWithdrawStep2 = async () => {
    if (twoFactorCode.length !== 6) {
      toast.error("Digite o código completo de 6 dígitos");
      return;
    }

    setWithdrawing(true);
    try {
      const amount = parseFloat(withdrawAmount.replace(",", "."));
      const { data, error } = await supabase.functions.invoke("asaas-wallet", {
        body: {
          action: "request_withdrawal",
          accountId: selectedAccountId,
          amount,
          password: withdrawPassword,
          twoFactorCode,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Saque solicitado!");
      setShowWithdraw(false);
      setWithdrawStep("form");
      setWithdrawAmount("");
      setWithdrawPassword("");
      setSelectedAccountId("");
      setTwoFactorCode("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar saque");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleResend2FA = async () => {
    if (resendCooldown > 0) return;
    setSending2FA(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-wallet", {
        body: { action: "send_2fa", targetAction: "withdrawal" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      startResendCooldown();
      toast.success("Novo código enviado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao reenviar código");
    } finally {
      setSending2FA(false);
    }
  };

  const accountStatusLabel = (acc: WithdrawalAccount) => {
    if (acc.status === "blocked") return { text: "Bloqueada", color: "text-destructive", bg: "bg-destructive/10" };
    const now = new Date();
    const activatedAt = new Date(acc.activated_at);
    if (activatedAt > now) {
      const hoursLeft = Math.ceil((activatedAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      return { text: `Proteção: ${hoursLeft}h`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
    }
    return { text: "Ativa", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
  };

  const logStatusLabel = (s: string) => {
    const map: Record<string, { label: string; color: string }> = {
      requested: { label: "Solicitado", color: "text-amber-500" },
      processing: { label: "Processando", color: "text-blue-500" },
      completed: { label: "Concluído", color: "text-emerald-500" },
      failed: { label: "Falhou", color: "text-destructive" },
      blocked: { label: "Bloqueado", color: "text-destructive" },
    };
    return map[s] || { label: s, color: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ─── NOT CONFIGURED: ONBOARDING ───
  if (!configured) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Carteira
          </h2>
          <p className="text-sm text-muted-foreground">Configure como você deseja receber seus pagamentos e comece a vender suas fotos.</p>
        </div>

        <div className="glass-card p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Suas vendas estão bloqueadas</p>
            <p className="text-sm text-muted-foreground">Preencha os dados abaixo para ativar seu recebimento e começar a vender.</p>
          </div>
        </div>

        {/* Dados necessários */}
        <div className="glass-card p-6 space-y-0">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
            <UserIcon className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Dados necessários</h3>
          </div>
          <InputField label="Nome completo" value={name} onChange={setName} placeholder="Seu nome completo" required />
          <InputField label="CPF ou CNPJ" value={cpfCnpj} onChange={setCpfCnpj} placeholder="000.000.000-00" required />
          <InputField label="Telefone" value={phone} onChange={setPhone} placeholder="(00) 00000-0000" required />
        </div>

        {/* Segurança */}
        <div className="glass-card p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Seus dados são usados apenas para confirmar a titularidade na hora do saque.
            Após salvar, você poderá cadastrar uma chave PIX e começar a receber — o valor de cada venda fica guardado
            no seu saldo interno e pode ser sacado via PIX a qualquer momento.
          </p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          {saving ? "Salvando..." : "Ativar recebimento"}
        </button>
      </div>
    );
  }

  // ─── CONFIGURED: WALLET VIEW ───
  const activeAccounts = accounts.filter(a => {
    const now = new Date();
    return a.status !== "blocked" && new Date(a.activated_at) <= now;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Carteira
          </h2>
          <p className="text-sm text-muted-foreground">Gerencie seus ganhos e saques</p>
        </div>
        <button onClick={() => setVisible(!visible)}
          className="text-muted-foreground hover:text-foreground transition-colors p-2">
          {visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
      </div>

      {/* Status */}
      <div className="glass-card p-4 flex items-center gap-3 border-l-4 border-l-emerald-500">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">Carteira ativa — suas vendas são processadas automaticamente.</p>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          {visible ? (
            <>
              <p className="text-sm opacity-70 mb-1">Disponível para saque</p>
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5">R$ {fmt(animBalance)}</p>

              <TooltipProvider>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/10 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs opacity-70">A receber</span>
                      <Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 opacity-50 cursor-help" /></TooltipTrigger>
                        <TooltipContent className="max-w-[200px]"><p className="text-xs">Valor de vendas confirmadas ainda no prazo de liberação.</p></TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="font-bold text-sm">R$ {fmt(animPending)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs opacity-70">Saldo total</span>
                      <Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 opacity-50 cursor-help" /></TooltipTrigger>
                        <TooltipContent className="max-w-[200px]"><p className="text-xs">Disponível + a receber.</p></TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="font-bold text-sm">R$ {fmt(animBalance + animPending)}</p>
                  </div>
                </div>
              </TooltipProvider>

              <button onClick={() => {
                if (activeAccounts.length === 0) {
                  toast.error("Cadastre uma conta de saque antes de solicitar.");
                  setShowAddAccount(true);
                  return;
                }
                setShowWithdraw(true);
                setWithdrawStep("form");
              }}
                className="w-full flex items-center justify-center gap-2 bg-white text-primary rounded-xl px-5 py-3.5 font-bold text-sm hover:bg-white/90 transition-all hover:shadow-lg min-h-[48px]">
                <Lock className="w-4 h-4" />
                <span>Sacar dinheiro</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          ) : (
            <p className="text-sm opacity-60 italic">Valores ocultos</p>
          )}
        </div>
      </div>

      {/* ─── REGISTERED ACCOUNTS (WHITELIST) ─── */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Contas cadastradas para saque
          </h3>
          <button onClick={() => setShowAddAccount(!showAddAccount)}
            className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Nova conta
          </button>
        </div>

        {/* Security notice */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 mb-4">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            🔐 Por segurança, os saques só podem ser realizados para contas de mesma titularidade do fotógrafo. Alterações de conta passam por um período de proteção de 24 horas antes de novos saques.
          </p>
        </div>

        {/* Add account form */}
        {showAddAccount && (
          <div className="p-4 rounded-xl border border-border bg-secondary/20 mb-4 space-y-3 animate-in slide-in-from-top-2">
            <h4 className="text-sm font-semibold">Cadastrar conta PIX</h4>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "CPF", label: "CPF" },
                { id: "EMAIL", label: "E-mail" },
                { id: "PHONE", label: "Celular" },
                { id: "EVP", label: "Aleatória" },
              ].map((t) => (
                <button key={t.id} onClick={() => setNewPixKeyType(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    newPixKeyType === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <InputField label="Chave PIX" value={newPixKey} onChange={setNewPixKey}
              placeholder={newPixKeyType === "CPF" ? "000.000.000-00" : newPixKeyType === "EMAIL" ? "seu@email.com" : newPixKeyType === "PHONE" ? "(00) 00000-0000" : "Chave aleatória"}
              required />
            <div className="flex gap-2">
              <button onClick={handleAddAccount} disabled={addingAccount}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1 disabled:opacity-50">
                {addingAccount ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Cadastrar
              </button>
              <button onClick={() => setShowAddAccount(false)}
                className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Accounts list */}
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhuma conta cadastrada. Adicione uma conta para poder sacar.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => {
              const st = accountStatusLabel(acc);
              return (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {acc.account_type === "pix" ? `PIX ${acc.pix_key_type}` : "Conta bancária"}
                        {acc.label ? ` — ${acc.label}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {acc.account_type === "pix" ? acc.pix_key : `${acc.bank_name} Ag ${acc.agency} Cc ${acc.account_number}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.bg} ${st.color}`}>
                      {st.text}
                    </span>
                    <button onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── WITHDRAWAL FORM ─── */}
      {showWithdraw && (
        <div className="glass-card p-6 space-y-4 animate-in slide-in-from-top-2 border-2 border-primary/20">
              <h3 className="font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Solicitar saque seguro
              </h3>

              {/* Account selection */}
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-start gap-2 py-3 border-b border-border/50">
                <label className="text-sm text-muted-foreground font-medium mt-2">Conta de destino <span className="text-destructive">*</span></label>
                <div className="space-y-2">
                  {activeAccounts.map((acc) => (
                    <label key={acc.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedAccountId === acc.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/30"
                      }`}>
                      <input type="radio" name="withdraw-account" value={acc.id}
                        checked={selectedAccountId === acc.id}
                        onChange={() => setSelectedAccountId(acc.id)}
                        className="accent-[hsl(var(--primary))]" />
                      <div>
                        <p className="text-sm font-medium">{acc.account_type === "pix" ? `PIX ${acc.pix_key_type}` : "Conta bancária"}</p>
                        <p className="text-xs text-muted-foreground">{acc.pix_key || `${acc.bank_name} ${acc.account_number}`}</p>
                      </div>
                    </label>
                  ))}
                  {activeAccounts.length === 0 && (
                    <p className="text-sm text-amber-600">Nenhuma conta ativa disponível. Aguarde o período de proteção de 24h.</p>
                  )}
                </div>
              </div>

              <InputField label="Valor do saque" value={withdrawAmount} onChange={setWithdrawAmount}
                placeholder={`Máximo: R$ ${fmt(balance)}`} required />

              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] items-center gap-2 py-3 border-b border-border/50">
                <label className="text-sm text-muted-foreground font-medium">
                  Confirme sua senha <span className="text-destructive">*</span>
                </label>
                <input type="password" value={withdrawPassword}
                  onChange={(e) => setWithdrawPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-secondary/50 rounded-lg px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors" />
              </div>

              <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  Por segurança, os saques só podem ser realizados para contas de mesma titularidade do fotógrafo.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={handleWithdrawSubmit} disabled={withdrawing || activeAccounts.length === 0}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50">
                  {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {withdrawing ? "Processando saque..." : "Confirmar saque"}
                </button>
                <button onClick={() => { setShowWithdraw(false); setWithdrawPassword(""); }}
                  className="px-6 py-3 rounded-xl border border-border text-muted-foreground font-medium hover:bg-secondary transition-colors">
                  Cancelar
                </button>
              </div>
        </div>
      )}

      {/* ─── TRANSFER HISTORY ─── */}
      {transfers.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Histórico de saques
          </h3>
          <div className="space-y-3">
            {transfers.map((t) => {
              const st = logStatusLabel(t.status);
              return (
                <div key={t.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${st.color.replace("text-", "bg-")}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {t.withdrawal_accounts?.account_type === "pix"
                          ? `PIX ${t.withdrawal_accounts.pix_key_type || ""}`
                          : "Transferência"}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
                      {t.error_message && <p className="text-xs text-destructive">{t.error_message}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">R$ {fmt(t.amount)}</p>
                    <p className={`text-xs ${st.color}`}>{st.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Security Note */}
      <div className="glass-card p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Seus pagamentos são processados com segurança por uma instituição financeira parceira.
          Todas as operações são registradas e auditáveis. Saques só são permitidos para contas de mesma titularidade.
        </p>
      </div>
    </div>
  );
};

export default TabCarteira;
