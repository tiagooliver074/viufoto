import { useState } from "react";
import { X, Download, Mail, Copy, Loader2, FileImage, Video, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrderLite {
  id: string;
  client_name: string;
  client_email: string;
  client_cpf: string | null;
  amount: number;
  status: string;
  payment_method: string | null;
  created_at: string;
  event_name?: string | null;
  items_count?: number;
}

interface Props {
  order: OrderLite;
  onClose: () => void;
}

interface SignedFile {
  id: string; name: string | null; type: "photo" | "video"; url: string | null;
}

export default function OrderDetailModal({ order, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<SignedFile[] | null>(null);

  const paid = order.status === "pago" || order.status === "enviado";

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("order-download", {
        body: { action: "photographer_resend", order_id: order.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFiles(data?.files || []);
      return data?.files as SignedFile[];
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar links");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    const f = files ?? await fetchFiles();
    if (!f) return;
    f.forEach((file, idx) => {
      if (!file.url) return;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = file.url!;
        a.download = file.name || `${file.type}-${file.id}`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, idx * 300);
    });
    toast.success(`Baixando ${f.length} arquivo(s)...`);
  };

  const handleCopyLinks = async () => {
    const f = files ?? await fetchFiles();
    if (!f) return;
    const text = f.filter(x => x.url).map((x, i) => `${i + 1}. ${x.name || x.type}\n${x.url}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("Links copiados! Cole no WhatsApp ou e-mail do cliente.");
  };

  const handleResendEmail = async () => {
    const f = files ?? await fetchFiles();
    if (!f) return;
    const list = f.filter(x => x.url).map((x, i) => `${i + 1}. ${x.name || x.type}: ${x.url}`).join("%0D%0A");
    const subject = encodeURIComponent(`Suas fotos do evento ${order.event_name || ""}`);
    const body = `Olá ${order.client_name},%0D%0A%0D%0ASegue o link para download das suas fotos (válido por 24h):%0D%0A%0D%0A${list}%0D%0A%0D%0AObrigado!`;
    window.location.href = `mailto:${order.client_email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">Pedido #{order.id.slice(0, 8).toUpperCase()}</h3>
            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("pt-BR")}</p>
          </div>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="text-foreground font-medium">{order.client_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">E-mail</span><span className="text-foreground truncate ml-2">{order.client_email}</span></div>
          {order.client_cpf && <div className="flex justify-between"><span className="text-muted-foreground">CPF</span><span className="text-foreground">{order.client_cpf}</span></div>}
          {order.event_name && <div className="flex justify-between"><span className="text-muted-foreground">Evento</span><span className="text-foreground truncate ml-2">{order.event_name}</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span className="text-foreground">{order.items_count ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span className="text-foreground capitalize">{order.payment_method || "-"}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              order.status === "enviado" ? "bg-lime/10 text-lime" :
              order.status === "pago" ? "bg-accent/10 text-accent" :
              order.status === "cancelado" ? "bg-destructive/10 text-destructive" :
              "bg-primary/10 text-primary"
            }`}>{order.status}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-muted-foreground font-medium">Valor total</span>
            <span className="text-foreground font-bold text-lg">R$ {Number(order.amount).toFixed(2).replace(".", ",")}</span>
          </div>
        </div>

        {paid ? (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              O cliente não recebeu? Reenvie manualmente os arquivos:
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleDownloadAll}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Baixar fotos/vídeos
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleResendEmail}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-secondary disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" /> E-mail
                </button>
                <button
                  onClick={handleCopyLinks}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-secondary disabled:opacity-50"
                >
                  <Copy className="w-4 h-4" /> Copiar links
                </button>
              </div>
            </div>

            {files && files.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 p-2 text-xs">
                    {f.type === "photo" ? <FileImage className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <Video className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <span className="flex-1 truncate text-foreground">{f.name || f.id}</span>
                    {f.url ? <CheckCircle2 className="w-3.5 h-3.5 text-lime" /> : <span className="text-destructive text-[10px]">erro</span>}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              Links válidos por 24 horas. O status do pedido muda para "enviado" após o reenvio.
            </p>
          </div>
        ) : (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center py-2">
              Pedido ainda não foi pago. Reenvio disponível apenas para pedidos pagos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}