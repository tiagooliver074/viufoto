import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Loader2, ShoppingCart, Camera, Flag, User } from "lucide-react";
import { toast } from "sonner";
import AnimatedLogo from "@/components/AnimatedLogo";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

function isValidCpfCnpj(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length === 14) return true;
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(d.slice(0, 9), 10) === parseInt(d[9]) && calc(d.slice(0, 10), 11) === parseInt(d[10]);
}

export default function Cadastro() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromCheckout = (location.state as any)?.fromCheckout === true;
  const redirectTo = (location.state as any)?.from || "/login";
  const preselectedRole = (location.state as any)?.role || "";

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    cpfCnpj: "",
    password: "",
    confirmPassword: "",
    experienceLevel: "",
    interest: preselectedRole, // "fotografo", "organizador", "ambos", or ""
    state: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const isPhotographer = form.interest === "fotografo" || form.interest === "ambos";

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.fullName.trim()) missing.push("nome completo");
    if (!form.email.trim()) missing.push("e-mail");
    if (!form.cpfCnpj.trim()) missing.push("CPF/CNPJ");
    if (!form.phone.trim()) missing.push("celular");
    if (!form.password) missing.push("senha");
    if (form.password && !form.confirmPassword) missing.push("confirmação da senha");
    if (missing.length > 0) {
      toast.error(`Falta preencher: ${missing.join(", ")}.`);
      return;
    }
    if (!isValidCpfCnpj(form.cpfCnpj)) {
      toast.error("CPF ou CNPJ inválido. Confira os números.");
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Celular inválido. Informe DDD + número.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    if (!agreed) {
      toast.error("Aceite os termos de uso para continuar");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          phone: form.phone,
          cpf_cnpj: form.cpfCnpj,
          experience_level: form.experienceLevel,
          interest: form.interest,
        },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Verifique seu email para confirmar o cadastro.");
    navigate("/login", { state: { from: redirectTo, fromCheckout } });
  };

  const roleOptions = [
    { value: "fotografo", label: "Sou Fotógrafo", icon: Camera, desc: "Quero vender minhas fotos" },
    { value: "organizador", label: "Sou Organizador", icon: Flag, desc: "Quero gerenciar eventos" },
    { value: "ambos", label: "Fotógrafo + Organizador", icon: Camera, desc: "Quero fazer os dois" },
    { value: "", label: "Quero comprar fotos", icon: User, desc: "Sou atleta/cliente" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-border px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <AnimatedLogo />
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {fromCheckout && (
            <div className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm text-foreground">
                Crie sua conta para finalizar a compra. Seus itens do carrinho estão salvos!
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-8">
            <h1 className="h3 text-foreground mb-1">Crie sua conta</h1>
            <p className="body-small text-muted-foreground mb-6">
              Já é cadastrado?{" "}
              <Link to="/login" state={{ from: redirectTo, fromCheckout }} className="text-primary font-semibold hover:underline">Efetuar login</Link>
            </p>

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Role selection */}
              <div>
                <p className="body-small font-medium text-foreground mb-2">Como você quer usar o ViuFoto?</p>
                <div className="grid grid-cols-2 gap-2">
                  {roleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("interest", opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        form.interest === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <opt.icon className={`w-4 h-4 mb-1 ${form.interest === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="caption font-semibold text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Input placeholder="Nome completo *" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="h-12" />
              <Input type="email" placeholder="E-mail *" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-12" />
              <Input placeholder="CPF ou CNPJ *" value={form.cpfCnpj} onChange={(e) => update("cpfCnpj", e.target.value)} className="h-12" />
              <Input placeholder="Celular *" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="h-12" />

              {isPhotographer && (
                <>
                  <Select value={form.state} onValueChange={(v) => update("state", v)}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Estado *" /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.experienceLevel} onValueChange={(v) => update("experienceLevel", v)}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Nível de experiência" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profissional">Profissional</SelectItem>
                      <SelectItem value="semiprofissional">Semiprofissional</SelectItem>
                      <SelectItem value="amador">Amador</SelectItem>
                      <SelectItem value="entusiasta">Entusiasta</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Crie sua senha *"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="h-12 pr-12"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirme sua senha *"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  className="h-12 pr-12"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <label className="flex items-start gap-2 body-small text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 accent-primary" />
                <span>Ao criar uma conta, você concorda com os <span className="text-primary font-medium">Termos e Condições de uso</span></span>
              </label>

              <Button type="submit" className="w-full h-12 text-base font-bold btn-height" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar conta"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
