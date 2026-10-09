import { useState } from "react";
import { toast } from "sonner";
import { getThumbCdnUrl } from "@/lib/cdnConfig";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { PageTitle, SectionTitle, Caption } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingBag, Calendar, Mail, Hash, 
  CreditCard, ExternalLink, Image as ImageIcon,
  Video, User, Clock, ArrowRight, Download, Copy, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderDetailsModalProps {
  orderId: string;
  onClose: () => void;
}

export const OrderDetailsModal = ({ orderId, onClose }: OrderDetailsModalProps) => {
  const { data: order, isLoading, isError } = useOrderDetails(orderId);
  const [files, setFiles] = useState<{ id: string; name: string | null; type: string; url: string | null }[] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const isPaid = order?.status === "pago" || order?.status === "enviado";

  // Gera os links ORIGINAIS (sem marca d'água, 24h) só quando o fotógrafo pede —
  // a função marca o pedido como "enviado", então não rodamos ao abrir a tela.
  const fetchFiles = async () => {
    if (files) return files;
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.functions.invoke("order-download", {
        body: { action: "photographer_resend", order_id: orderId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFiles(data?.files || []);
      return (data?.files || []) as NonNullable<typeof files>;
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar os links");
      return null;
    } finally {
      setLoadingFiles(false);
    }
  };

  const triggerDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadOne = async (fileId: string | null) => {
    const f = await fetchFiles();
    const file = f?.find((x) => x.id === fileId);
    if (!file?.url) { toast.error("Arquivo indisponível"); return; }
    triggerDownload(file.url);
  };

  const downloadAll = async () => {
    const f = await fetchFiles();
    if (!f) return;
    f.filter((x) => x.url).forEach((x, i) => setTimeout(() => triggerDownload(x.url!), i * 400));
    toast.success(`Baixando ${f.filter((x) => x.url).length} arquivo(s)...`);
  };

  const copyLinks = async (onlyId?: string | null) => {
    const f = await fetchFiles();
    if (!f) return;
    const list = f.filter((x) => x.url && (!onlyId || x.id === onlyId));
    const text = list.length === 1 ? list[0].url! : list.map((x, i) => `${i + 1}. ${x.name || x.type}\n${x.url}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado! Cole no WhatsApp do cliente (vale por 24h).");
    } catch {
      toast.error("Não foi possível copiar. Use o botão Baixar.");
    }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Pedido <span className="text-primary">#{orderId.slice(0, 8).toUpperCase()}</span>
              </DialogTitle>
              {order?.created_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Realizado em {format(new Date(order.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
            {order?.status && (
              <Badge 
                variant="outline" 
                className={`
                  text-[10px] font-bold uppercase tracking-widest px-2.5 py-1
                  ${order.status === 'pago' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                    order.status === 'enviado' ? 'bg-emerald-600 text-white border-emerald-600' : 
                    order.status === 'aguardando_pagamento' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                    'bg-red-50 text-red-700 border-red-200'}
                `}
              >
                {order.status === 'aguardando_pagamento' ? 'Pendente' : order.status === 'enviado' ? 'Entregue' : order.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8">
          {isLoading ? (
            <div className="py-20 text-center animate-pulse text-muted-foreground">
              Carregando detalhes do pedido...
            </div>
          ) : !order ? (
            <div className="py-20 text-center text-muted-foreground">
              {isError ? "Não foi possível carregar este pedido. Tente novamente." : "Pedido não encontrado."}
            </div>
          ) : (
            <>
              {/* Client & Payment Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <User className="w-4 h-4" />
                    <SectionTitle className="text-sm font-bold uppercase tracking-widest m-0">Comprador</SectionTitle>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-bold">{order.client_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      {order.client_email}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <CreditCard className="w-4 h-4" />
                    <SectionTitle className="text-sm font-bold uppercase tracking-widest m-0">Pagamento</SectionTitle>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Método</span>
                      <span className="font-bold capitalize">{order.payment_method || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Valor Total</span>
                      <span className="font-bold text-primary">
                        R$ {Number(order.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <ShoppingBag className="w-4 h-4" />
                  <SectionTitle className="text-sm font-bold uppercase tracking-widest m-0">Itens do Pedido ({order.items?.length || 0})</SectionTitle>
                </div>
                
                <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className={`p-4 flex items-center gap-4 ${idx !== 0 ? 'border-t border-border/40' : ''}`}>
                      <div className="w-12 h-12 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.photo_id && (item as any).event_photos?.file_url && getThumbCdnUrl((item as any).event_photos.file_url) ? (
                          <img
                            src={getThumbCdnUrl((item as any).event_photos.file_url)!}
                            alt={(item as any).event_photos?.file_name || "Foto"}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : item.photo_id ? (
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Video className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate">
                            {(item as any).event_photos?.file_name || (item as any).event_videos?.file_name || (item.photo_id ? 'Fotografia' : 'Vídeo')}
                          </p>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter px-1.5 h-4">
                            {item.photo_id ? 'Alta Resolução' : 'Vídeo Original'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          ID: {item.photo_id || item.video_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          R$ {Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {isPaid && (
                          <div className="flex gap-1 justify-end mt-1">
                            <button type="button" disabled={loadingFiles} onClick={() => downloadOne(item.photo_id || item.video_id)} className="p-1.5 rounded-md hover:bg-secondary text-primary disabled:opacity-50" title="Baixar original">
                              <Download className="w-4 h-4" />
                            </button>
                            <button type="button" disabled={loadingFiles} onClick={() => copyLinks(item.photo_id || item.video_id)} className="p-1.5 rounded-md hover:bg-secondary text-primary disabled:opacity-50" title="Copiar link">
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isPaid ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold">Cliente não conseguiu baixar?</p>
                  <p className="text-xs text-muted-foreground">Baixe as fotos originais (sem marca d'água) ou copie os links e envie pelo WhatsApp. Os links valem 24 horas.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" disabled={loadingFiles} onClick={downloadAll} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                      {loadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar originais
                    </button>
                    <button type="button" disabled={loadingFiles} onClick={() => copyLinks()} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border font-medium text-sm hover:bg-secondary disabled:opacity-50">
                      <Copy className="w-4 h-4" /> Copiar links
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center">Pedido ainda não pago — os arquivos só ficam disponíveis após a confirmação do pagamento.</p>
              )}

              {/* Financial Summary */}
              <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle className="text-sm font-bold uppercase tracking-widest m-0">Resumo Financeiro</SectionTitle>
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Venda Bruta</span>
                    <span className="font-semibold text-foreground">
                      R$ {Number(order.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Taxa ViuFoto (10%)</span>
                    <span className="font-semibold text-destructive">
                      - R$ {(order.platform_fee != null ? Number(order.platform_fee) : Number(order.amount) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <Separator className="bg-primary/10" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Líquido a receber</span>
                    <span className="text-xl font-black text-primary">
                      R$ {(order.photographer_net != null ? Number(order.photographer_net) : Number(order.amount) * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
