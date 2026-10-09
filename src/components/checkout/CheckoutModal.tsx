import { useState, useEffect } from "react";
import { X, CreditCard, QrCode, Copy, CheckCircle2, Loader2, Download } from "lucide-react";
import { useAsaasCheckout } from "@/hooks/useAsaasCheckout";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { pickDiscount, normalizeRules } from "@/lib/progressiveDiscount";
import { trackFunnelEvent } from "@/lib/searchTracking";

// Validate Brazilian CPF (11 digits with check digits) — accepts CNPJ (14 digits) loosely as well
function isValidCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) return true; // CNPJ — let Asaas validate fully
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(digits.slice(0, 9), 10);
  const d2 = calc(digits.slice(0, 10), 11);
  return d1 === parseInt(digits[9]) && d2 === parseInt(digits[10]);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
}

const CheckoutModal = ({ open, onClose, eventId }: CheckoutModalProps) => {
  const { createCheckout, loading, pixData, paymentStatus, isPaid, reset } = useAsaasCheckout();
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", emailConfirm: "", cpfCnpj: "" });
  const [step, setStep] = useState<"form" | "pix" | "success">("form");
  // Entrega logo após o pagamento (compra sem conta): o servidor libera o
  // download com o número do pedido + e-mail usado na compra.
  const [files, setFiles] = useState<{ id?: string; name?: string | null; type?: string; url?: string | null }[]>([]);
  const [filesState, setFilesState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Fetch profile to pre-fill form
  const { data: profile } = useQuery({
    queryKey: ["checkout-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, cpf_cnpj")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && open,
  });

  // Carrega desconto progressivo do evento
  const { data: eventDiscount } = useQuery({
    queryKey: ["checkout-discount", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data } = await supabase
        .from("events")
        .select("progressive_discount_enabled, progressive_discount_rules")
        .eq("id", eventId)
        .maybeSingle();
      return data;
    },
    enabled: !!eventId && open,
  });

  const photoCount = items.filter(i => i.photoId).length;
  const rules = eventDiscount?.progressive_discount_enabled
    ? normalizeRules(eventDiscount?.progressive_discount_rules)
    : [];
  const { pct: discountPct } = pickDiscount(rules, photoCount);
  const discountFactor = 1 - discountPct / 100;
  const finalTotal = +(total * discountFactor).toFixed(2);

  // Pre-fill form with user data
  useEffect(() => {
    if (open && user) {
      setForm(prev => ({
        name: profile?.full_name || prev.name,
        email: user.email || prev.email,
        emailConfirm: user.email || prev.emailConfirm,
        cpfCnpj: profile?.cpf_cnpj || prev.cpfCnpj,
      }));
    }
  }, [open, user, profile]);

  // Check if payment is confirmed
  useEffect(() => {
    if (isPaid && step === "pix") {
      trackFunnelEvent({
        event_type: "purchase_completed",
        event_id: eventId,
        order_id: pixData?.orderId ?? null,
        metadata: {
          total: finalTotal,
          items_count: items.length,
          discount_pct: discountPct,
        },
        dedupeKey: pixData?.orderId || `${eventId}:${finalTotal}`,
      });
      setStep("success");
      clearCart();
    }
  }, [isPaid, step, clearCart, eventId, pixData?.orderId, finalTotal, items.length, discountPct]);

  // Ao confirmar o pagamento, busca os arquivos para baixar na própria tela.
  // O webhook do Asaas pode levar alguns segundos para marcar o pedido como
  // pago, então tentamos algumas vezes antes de mostrar o botão de repetir.
  const orderId = pixData?.orderId;
  const buyerEmail = form.email;
  const fetchFiles = async () => {
    if (!orderId) return;
    setFilesState("loading");
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await supabase.functions.invoke("order-download", {
        body: { action: "download", order_id: orderId, email: buyerEmail.trim() },
      });
      if (!error && data?.files) {
        setFiles(data.files);
        setFilesState("ready");
        return;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    setFilesState("error");
  };

  useEffect(() => {
    if (step === "success" && filesState === "idle") fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.cpfCnpj.trim()) {
      toast.error("Preencha todos os campos para continuar.");
      return;
    }
    if (form.name.trim().length < 3) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!isValidEmail(form.email)) {
      toast.error("E-mail inválido. Verifique e tente novamente.");
      return;
    }
    if (!user && form.email.trim().toLowerCase() !== form.emailConfirm.trim().toLowerCase()) {
      toast.error("Os e-mails não conferem. Confira os dois campos: é nele que você recebe suas fotos.");
      return;
    }
    if (!isValidCpfCnpj(form.cpfCnpj)) {
      toast.error("CPF ou CNPJ inválido. Confira os números e tente novamente.");
      return;
    }
    if (!eventId) {
      toast.error("Evento não identificado. Atualize a página e tente novamente.");
      return;
    }
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio.");
      return;
    }
    if (items.some(i => !(typeof i.price === "number") || i.price <= 0)) {
      toast.error("Há itens sem preço válido. Remova-os e adicione novamente.");
      return;
    }
    if (finalTotal < 5) {
      toast.error("O valor mínimo de compra é R$ 5,00 (PIX e cartão). Adicione mais itens ao carrinho.");
      return;
    }
    try {
      await createCheckout({
        name: form.name,
        email: form.email,
        cpfCnpj: form.cpfCnpj,
        eventId,
        items: items.map(i => ({
          photoId: i.photoId,
          videoId: i.videoId,
          price: +(i.price * discountFactor).toFixed(2),
          resolution: i.resolution,
        })),
        total: finalTotal,
      });
      trackFunnelEvent({
        event_type: "checkout_started",
        event_id: eventId,
        metadata: {
          total: finalTotal,
          items_count: items.length,
          photo_count: photoCount,
          discount_pct: discountPct,
        },
        dedupeKey: `${eventId}:${finalTotal}:${items.length}`,
      });
      setStep("pix");
    } catch (err: any) {
      const msg = err?.message || "Não foi possível concluir o pagamento. Tente novamente em instantes.";
      toast.error(msg, { duration: 6000 });
    }
  };

  const handleCopyPix = () => {
    if (pixData?.pixCopyPaste) {
      navigator.clipboard.writeText(pixData.pixCopyPaste);
      toast.success("Código PIX copiado!");
    }
  };

  const handleClose = () => {
    reset();
    setStep("form");
    setFiles([]);
    setFilesState("idle");
    setForm({ name: "", email: "", emailConfirm: "", cpfCnpj: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {step === "form" && "Finalizar compra"}
            {step === "pix" && "Pagamento PIX"}
            {step === "success" && "Pagamento confirmado!"}
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-secondary rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                <p className="text-sm text-muted-foreground">{items.length} item(ns)</p>
                {discountPct > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground line-through">R$ {total.toFixed(2)}</p>
                    <p className="text-xl font-bold text-primary">
                      R$ {finalTotal.toFixed(2)}
                      <span className="ml-2 text-xs font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                        -{discountPct}%
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-primary">R$ {total.toFixed(2)}</p>
                )}
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-sm outline-none border border-border focus:border-primary"
                />
                <input
                  type="email"
                  placeholder="E-mail (é nele que você recebe as fotos)"
                  value={form.email}
                  readOnly={!!user?.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-sm outline-none border border-border focus:border-primary read-only:opacity-70"
                />
                {!user && (
                  <input
                    type="email"
                    placeholder="Confirme seu e-mail"
                    value={form.emailConfirm}
                    onChange={e => setForm(f => ({ ...f, emailConfirm: e.target.value }))}
                    onPaste={e => e.preventDefault()}
                    className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-sm outline-none border border-border focus:border-primary"
                  />
                )}
                <input
                  type="text"
                  placeholder="CPF ou CNPJ"
                  value={form.cpfCnpj}
                  onChange={e => setForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                  className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-sm outline-none border border-border focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all min-h-[48px] disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                ) : (
                  <><QrCode className="w-5 h-5" /> Gerar PIX</>
                )}
              </button>
            </form>
          )}

          {step === "pix" && pixData && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR Code ou copie o código PIX
              </p>

              {pixData.pixQrCode && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border border-border"
                  />
                </div>
              )}

              <button
                onClick={handleCopyPix}
                className="w-full py-3 rounded-xl border border-primary text-primary font-medium flex items-center justify-center gap-2 hover:bg-primary/10 transition-all"
              >
                <Copy className="w-4 h-4" /> Copiar código PIX
              </button>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Valor</p>
                <p className="text-lg font-bold text-primary">R$ {pixData.value.toFixed(2)}</p>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Aguardando pagamento...
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h3 className="text-xl font-bold">Pagamento confirmado!</h3>

              {filesState === "loading" && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparando suas fotos...
                </div>
              )}

              {filesState === "ready" && (
                <div className="space-y-2 text-left max-h-64 overflow-y-auto">
                  <p className="text-sm text-muted-foreground text-center">
                    Suas fotos estão prontas. Baixe agora:
                  </p>
                  {files.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhum arquivo encontrado.</p>
                  )}
                  {files.map((file, i) => (
                    <div key={file.id || i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <p className="text-sm font-medium truncate">{file.name || `Arquivo ${i + 1}`}</p>
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar
                        </a>
                      ) : (
                        <span className="text-xs text-red-400">Indisponível</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {filesState === "error" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Seu pagamento foi confirmado, mas as fotos ainda estão sendo liberadas.
                  </p>
                  <button
                    onClick={fetchFiles}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Para rever esta compra depois, acesse <a href="/meus-pedidos" className="text-primary underline">Meus Pedidos</a> com seu e-mail (enviamos um código de confirmação).
              </p>
              <button
                onClick={handleClose}
                className="w-full py-3 rounded-xl border border-border text-muted-foreground font-medium hover:text-foreground transition-all"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
