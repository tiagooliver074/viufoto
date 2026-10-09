import { ShoppingCart, X, Trash2, CreditCard, PartyPopper, Film } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import CheckoutModal from "@/components/checkout/CheckoutModal";
import { toast } from "sonner";
import { getPhotoCode } from "@/lib/photoCode";
import { pickDiscount, normalizeRules } from "@/lib/progressiveDiscount";

const CartDrawer = () => {
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { items, removeItem, clearCart, total, count } = useCart();

  const eventId = items.length > 0 ? items[0].eventId || "" : "";

  const { data: eventDiscount } = useQuery({
    queryKey: ["event-discount", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from("events")
        .select("progressive_discount_enabled, progressive_discount_rules")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const photoCount = items.filter(i => i.photoId).length;
  const rules = eventDiscount?.progressive_discount_enabled
    ? normalizeRules(eventDiscount?.progressive_discount_rules)
    : [];
  const { pct: discountPct, rule: activeRule, next: nextRule } = pickDiscount(rules, photoCount);
  const discountValue = +(total * (discountPct / 100)).toFixed(2);
  const finalTotal = +(total - discountValue).toFixed(2);

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }
    if (!eventId) {
      toast.error("Erro: evento não identificado");
      return;
    }
    // Compra sem conta: o modal de pagamento já coleta nome, e-mail e CPF, e o
    // download logo após pagar funciona com o número do pedido + e-mail.
    setOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <>
      <button
        data-cart-trigger
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors"
      >
        <ShoppingCart className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-card border-l border-border h-full overflow-y-auto animate-in slide-in-from-right"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Carrinho ({count})
              </h2>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Seu carrinho está vazio</p>
              </div>
            ) : (
              <>
                <div className="p-4 space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <div className="relative w-16 h-16 flex-shrink-0">
                        <img
                          src={item.photoUrl}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        {item.videoId && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                            <Film className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.eventName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.videoId ? "Vídeo original" : "Alta resolução"}
                        </p>
                        {item.photoId && (
                          <p className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
                            ID: {getPhotoCode(item.photoId)}
                          </p>
                        )}
                        <p className="text-sm font-bold text-primary mt-1">
                          R$ {item.price.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 hover:bg-destructive/20 rounded-lg text-muted-foreground hover:text-destructive transition-colors self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-6 border-t border-border space-y-4">
                  {discountPct > 0 && activeRule && (
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 flex items-start gap-2">
                      <PartyPopper className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-snug">
                        <strong>Parabéns!</strong> Você ganhou <strong className="text-primary">{discountPct}% de desconto</strong> por levar mais de {activeRule.min_photos} fotos.
                      </p>
                    </div>
                  )}
                  {discountPct === 0 && nextRule && photoCount > 0 && (
                    <div className="rounded-xl bg-secondary/40 border border-border p-3">
                      <p className="text-xs text-muted-foreground leading-snug">
                        Adicione mais <strong className="text-foreground">{nextRule.min_photos - photoCount} foto(s)</strong> para ganhar <strong className="text-primary">{nextRule.discount_pct}% de desconto</strong>.
                      </p>
                    </div>
                  )}
                  {discountPct > 0 && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>R$ {total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-primary font-semibold">
                        <span>Desconto ({discountPct}%)</span>
                        <span>- R$ {discountValue.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-xl font-bold text-primary">R$ {finalTotal.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all min-h-[48px]"
                  >
                    <CreditCard className="w-5 h-5" /> Finalizar compra
                  </button>
                  <button
                    onClick={clearCart}
                    className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:border-destructive hover:text-destructive transition-all"
                  >
                    Limpar carrinho
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        eventId={eventId}
      />
    </>
  );
};

export default CartDrawer;