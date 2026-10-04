import { useState, useRef } from "react";
import { OrdersModule } from "@/components/event/orders/OrdersModule";
import { EventFinancialCenter } from "@/components/event/financial/EventFinancialCenter";
import { PhotoManager } from "@/components/event/photos/PhotoManager";
import { VideoManager } from "@/components/event/videos/VideoManager";
import { useParams, useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/DashboardSidebar";
import StatusDropdown from "@/components/event/StatusDropdown";
import UploadModal from "@/components/event/UploadModal";
import DuplicateFilesModal from "@/components/event/DuplicateFilesModal";
import PriceGridModal from "@/components/event/PriceGridModal";
import DiscountModal from "@/components/event/DiscountModal";
import CouponModal from "@/components/event/CouponModal";
import EditEventModal from "@/components/event/EditEventModal";
import PasswordModal from "@/components/event/PasswordModal";
import ScheduleModal from "@/components/event/ScheduleModal";
import PhotoGallery from "@/components/event/PhotoGallery";
import VideoGallery from "@/components/event/VideoGallery";
import PromoArtModal from "@/components/event/PromoArtModal";
import CollaborationModal from "@/components/event/CollaborationModal";
import { useEvent, useEventPhotos, useEventVideos, useEventOrders, useEventCoupons, useEventPriceGrid, useDiscountPackages } from "@/hooks/useEvent";
import { useUploadWithDupCheck } from "@/hooks/useUploadWithDupCheck";
import { usePhotographerSite } from "@/hooks/usePhotographerSite";
import { useAuth } from "@/contexts/AuthContext";
import type { UploadFileProgress } from "@/components/event/PhotoGallery";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCoverUrl } from "@/lib/eventCover";
import { setEventPassword } from "@/lib/eventAccess";
import { resizeImage } from "@/lib/imageResize";
import {
  Edit, ShoppingCart, DollarSign, Upload, Image, MoreHorizontal, Lock, Megaphone, Tag,
  Video, Eye, Check, ChevronRight, Users, BarChart3, X, Trash2, Copy, Share2,
  ExternalLink, MessageCircle, UserPlus
} from "lucide-react";
import { motion } from "framer-motion";
import { shareBaseUrl } from "@/lib/shareUrl";
import { PageTitle, PageSubtitle, SectionTitle, CardTitle, Caption } from "@/components/ui/Typography";
import { Dialog, DialogContent } from "@/components/ui/dialog";


// Mesmas ações de sempre (handleAction abaixo trata cada key exatamente como
// antes), apenas reorganizadas em grupos para a nova toolbar compacta.
// A key "gallery" (antigo botão "Galeria") abria o mesmo modal de
// "Enviar Fotos" (setShowGallery) e por isso não ganhou um item próprio
// aqui — a função continua acessível por "Enviar Fotos" e por "Ver galeria"
// no cabeçalho, nada foi removido.
type ActionItem = { label: string; icon: typeof Edit; key: string; secondary?: string };
type ActionGroup = { title: string; items: ActionItem[] };

const EventDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<UploadFileProgress[]>([]);
  const [videoUploadProgress, setVideoUploadProgress] = useState<UploadFileProgress[]>([]);

  // Data hooks
  const { event, isLoading, updateEvent, deleteEvent, refetch } = useEvent(id);
  const { photos, deletePhoto } = useEventPhotos(id);
  const { videos, deleteVideo, updateVideoStatus } = useEventVideos(id);
  const { site: photographerSite } = usePhotographerSite();
  const photosUpload = useUploadWithDupCheck({ eventId: id || "", type: "fotos", watermarkUrl: photographerSite?.watermark_url || undefined, onProgress: (files) => {
    setPhotoUploadProgress(files.map(f => ({
      fileName: f.fileName,
      progress: f.progress,
      status: f.status,
    })));
    if (files.every(f => f.status === "done" || f.status === "error")) {
      setTimeout(() => setPhotoUploadProgress([]), 5000);
    }
  }});
  const videosUpload = useUploadWithDupCheck({ eventId: id || "", type: "videos", onProgress: (files) => {
    setVideoUploadProgress(files.map(f => ({
      fileName: f.fileName,
      progress: f.progress,
      status: f.status,
    })));
    if (files.every(f => f.status === "done" || f.status === "error")) {
      setTimeout(() => setVideoUploadProgress([]), 5000);
    }
  }});
  const s3UploadPhotos = photosUpload.uploader;
  const s3UploadVideos = videosUpload.uploader;
  const ordersQuery = useEventOrders(id);
  const { coupons, createCoupon, toggleCoupon } = useEventCoupons(id);
  const { grids, savePriceGrid, deletePriceGrid } = useEventPriceGrid(id);
  const { packages, savePackage } = useDiscountPackages(id);

  // Modal states
  const [showUploadPhotos, setShowUploadPhotos] = useState(false);
  const [showUploadVideos, setShowUploadVideos] = useState(false);
  const [showPriceGrid, setShowPriceGrid] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showVideoGallery, setShowVideoGallery] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showFinancial, setShowFinancial] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [showVideoManager, setShowVideoManager] = useState(false);
  const { profile } = useAuth();

  const runUploadWithDupCheck = async (files: File[], type: "photos" | "videos", album?: string | null) => {
    if (type === "photos") {
      setShowUploadPhotos(false);
      await photosUpload.start(files, album ?? null);
    } else {
      setShowUploadVideos(false);
      await videosUpload.start(files);
    }
  };

  const orders = ordersQuery.data || [];

  // Computed stats
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.amount), 0);
  const paidOrders = orders.filter(o => o.status === "pago" || o.status === "enviado");
  const photosSold = paidOrders.length * 2; // simplified
  const avgTicket = paidOrders.length > 0 ? (totalRevenue / paidOrders.length) : 0;

  const handleAction = (key: string) => {
    switch (key) {
      case "edit": setShowEdit(true); break;
      case "orders": setShowOrders(true); break;
      case "financial": setShowFinancial(true); break;
      case "upload-photos": setShowGallery(true); break;
      case "upload-videos": setShowVideoGallery(true); break;
      case "photos": setShowPhotoManager(true); break;
      case "gallery": setShowGallery(true); break;
      case "password": setShowPassword(true); break;
      case "coupons": setShowCoupon(true); break;
      case "actions": setShowActions(true); break;
      case "promo": setShowPromo(true); break;
      case "collab": setShowCollab(true); break;
      case "import": toast.info("Importação de pedidos em breve!"); break;
      case "invite": toast.info("Convite de fotógrafos em breve!"); break;
      case "videos": setShowVideoManager(true); break;
      default: break;
    }
  };

  // Agrupamento visual da toolbar "Ações rápidas" — mesmas keys/handlers de
  // sempre (handleAction acima), só a organização em categorias é nova.
  const actionGroups: ActionGroup[] = [
    {
      title: "Gestão",
      items: [
        { label: "Pedidos", icon: ShoppingCart, key: "orders", secondary: String(orders.length) },
        { label: "Financeiro", icon: DollarSign, key: "financial", secondary: `R$ ${totalRevenue.toFixed(0)}` },
        { label: "Colaboração", icon: Users, key: "collab" },
      ],
    },
    {
      title: "Mídia",
      items: [
        { label: "Enviar Fotos", icon: Upload, key: "upload-photos" },
        { label: "Fotos", icon: Image, key: "photos", secondary: String(photos.length) },
        { label: "Enviar Vídeos", icon: Video, key: "upload-videos" },
        { label: "Vídeos", icon: Video, key: "videos", secondary: String(videos.length) },
      ],
    },
    {
      title: "Divulgação",
      items: [
        { label: "Divulgação", icon: Megaphone, key: "promo" },
        { label: "Convidar", icon: UserPlus, key: "invite" },
      ],
    },
    {
      title: "Configurações",
      items: [
        { label: "Editar", icon: Edit, key: "edit" },
        { label: "Senha", icon: Lock, key: "password" },
        { label: "Mais Ações", icon: MoreHorizontal, key: "actions" },
      ],
    },
  ];

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    try {
      // Reduz o arquivo no cliente antes de subir: WebP ~1600px, quality 82.
      // Reduz drasticamente o tamanho do objeto no bucket e melhora o TTFB
      // mesmo sem depender das image transformations do Supabase.
      let payload: Blob = file;
      let ext = file.name.split(".").pop() || "jpg";
      try {
        const resized = await resizeImage(file, 1600, 0.82);
        payload = resized;
        ext = resized.type === "image/webp" ? "webp" : "jpg";
      } catch (err) {
        console.warn("[coverUpload] resize falhou, subindo original:", err);
      }
      const fileName = `${id}/cover-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("event-covers").upload(fileName, payload, {
        contentType: payload.type || `image/${ext}`,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("event-covers").getPublicUrl(fileName);
      await updateEvent.mutateAsync({ cover_url: publicUrl });
    } catch (err: any) {
      toast.error("Erro ao enviar capa: " + err.message);
    }
  };

  const handleDuplicateEvent = async () => {
    if (!event) return;
    if (!confirm(`Duplicar o evento "${event.name}"? Um novo evento será criado com os mesmos dados.`)) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("events").insert({
        organizer_id: user.id,
        name: event.name + " (cópia)",
        event_date: event.event_date,
        event_time: event.event_time,
        location: event.location,
        category: event.category,
        search_type: event.search_type,
        visibility: event.visibility,
      });
      if (error) throw error;
      toast.success("Evento duplicado!");
      setShowActions(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    await deleteEvent.mutateAsync();
    navigate("/dashboard");
  };

  const handleShareLink = () => {
    const url = `${shareBaseUrl()}/evento/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado! ✅");
    setShowActions(false);
  };

  const handleShareWhatsApp = () => {
    const url = `${shareBaseUrl()}/evento/${id}`;
    const text = encodeURIComponent(`Confira as fotos do evento "${event?.name}":\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleOpenGallery = () => {
    window.open(`/evento/${id}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando evento...</div>
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-muted-foreground">Evento não encontrado</p>
          <button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Voltar ao Dashboard</button>
        </main>
      </div>
    );
  }

  const grid = grids[0];

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-8 overflow-auto">
        {/* Breadcrumb */}
        <div className="mb-4">
          <p className="text-[11px] text-primary font-bold tracking-wider">DASHBOARD DO EVENTO</p>
          <p className="text-xs text-muted-foreground">{event.id.slice(0, 8)} · {event.name}</p>
        </div>

        {/* Hero Card — cabeçalho compacto do evento (não é mais um banner grande) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-sm mb-5"
        >
          {/* Faixa com a capa do evento como plano de fundo */}
          <div
            onClick={() => coverInputRef.current?.click()}
            className="relative py-4 sm:py-5 px-5 cursor-pointer group bg-gradient-to-br from-primary/90 via-primary to-primary/70 overflow-hidden"
          >
            {event.cover_url && (
              <img
                src={getCoverUrl(event.cover_url, 1600) ?? undefined}
                alt="Capa"
                decoding="async"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
            <div className="relative flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-widest text-white/70">#{event.id.slice(0, 8).toUpperCase()}</p>
                <PageTitle className="text-white drop-shadow truncate">{event.name}</PageTitle>
                <p className="body-small text-white/80 mt-0.5 truncate">
                  {new Date(event.event_date).toLocaleDateString("pt-BR")} · {event.location}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <StatusDropdown
                  status={event.status}
                  publishAt={(event as any).publish_at}
                  onChange={(s) => {
                    if (s === "agendado") { setShowSchedule(true); return; }
                    updateEvent.mutate({ status: s, publish_at: null } as any);
                  }}
                  disabled={updateEvent.isPending}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-medium transition-colors"
                >
                  <Image className="w-3.5 h-3.5" /> Trocar capa
                </button>
              </div>
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
          </div>

          {/* CTA row — compacta */}
          <div className="px-5 py-2.5 flex flex-wrap gap-2 bg-card">
            <button
              onClick={handleShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow"
            >
              <Share2 className="w-3.5 h-3.5" /> Compartilhar evento
            </button>
            <button
              onClick={handleOpenGallery}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:border-primary/40 hover:text-primary transition-all"
            >
              <Eye className="w-3.5 h-3.5" /> Ver galeria
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-secondary/50 transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp
            </button>
          </div>
        </motion.div>

        {/* Ações rápidas — toolbar compacta agrupada por categoria */}
        <div className="rounded-2xl bg-card border border-border shadow-sm p-4 sm:p-5 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Ações rápidas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
            {actionGroups.map((group) => (
              <div key={group.title}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-0.5">{group.title}</p>
                <div className="rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden">
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => handleAction(item.key)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground flex-1 truncate">{item.label}</span>
                      {item.secondary && (
                        <span className="text-xs text-muted-foreground shrink-0">{item.secondary}</span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Three main cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <button
            onClick={() => setShowPriceGrid(true)}
            className="text-left rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <Caption className="font-bold uppercase tracking-widest">Grade de Preço</Caption>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Foto original</span>
                <span className="text-foreground font-semibold">R$ {grid?.photo_high_price?.toFixed(2).replace(".", ",") || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vídeo</span>
                <span className="text-foreground font-semibold">R$ {grid?.video_price?.toFixed(2).replace(".", ",") || "—"}</span>
              </div>
            </div>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDiscount(true); }}
            className="text-left rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-emerald-600" />
                </div>
                <Caption className="font-bold uppercase tracking-widest">Descontos</Caption>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pacotes ativos</span>
                <span className="text-foreground font-semibold">{packages.filter(p => p.active).length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cupons ativos</span>
                <span className="text-foreground font-semibold">{coupons.filter(c => c.active).length}</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowOrders(true)}
            className="text-left rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-orange-600" />
                </div>
                <Caption className="font-bold uppercase tracking-widest">Vendas do Evento</Caption>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total vendas</span>
                <span className="text-foreground font-semibold">R$ {totalRevenue.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pedidos pagos</span>
                <span className="text-foreground font-semibold">{paidOrders.length}</span>
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="text-left rounded-2xl bg-card border border-border p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <Caption className="font-bold uppercase tracking-widest">Tipo de Busca</Caption>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(event.search_type && event.search_type.length > 0 ? event.search_type : ["—"]).map((t) => (
                <span key={t} className="inline-flex px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold capitalize">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border/70">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Organizador</h4>
              </div>
              <p className="text-sm text-foreground font-medium">Você</p>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm font-semibold text-primary">
              <span>Editar tipo de busca</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          <div className="relative rounded-2xl p-4 shadow-lg overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">Faturamento do Evento</p>
                <DollarSign className="w-4 h-4 text-white/70" />
              </div>
              <p className="text-3xl sm:text-4xl font-black tracking-tight">
                R$ {totalRevenue.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-white/85 mt-1">
                Sua comissão: R$ {(totalRevenue * 0.9).toFixed(2).replace(".", ",")}
              </p>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Pedidos", value: String(paidOrders.length), sub: `${photosSold} fotos vendidas` },
            { label: "Ticket Médio", value: `R$ ${avgTicket.toFixed(2).replace(".", ",")}`, sub: `${paidOrders.length > 0 ? (photosSold / paidOrders.length).toFixed(2) : "0.00"} fotos/pedido` },
            { label: "Total de Fotos", value: String(photos.length), sub: `${photos.filter(p => p.identified).length} identificadas · ${photos.filter(p => !p.identified).length} sem ID` },
            { label: "Conversão", value: paidOrders.length > 0 ? "33%" : "0%", sub: "de visitantes que compraram" },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md transition-all"
            >
              <p className="caption font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{k.label}</p>
              <SectionTitle className="tracking-tight">{k.value}</SectionTitle>
              <p className="caption text-muted-foreground mt-1.5 truncate">{k.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Secondary actions row */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: "Fotos Vendidas", action: () => setShowGallery(true) },
            { label: "Vídeos Vendidos", action: () => toast.info("Em breve!") },
            { label: "Histórico Alteração Capa", action: () => toast.info("Em breve!") },
            { label: "Convidar Fotógrafos", action: () => toast.info("Em breve!") },
            { label: "Enviar Mensagem", action: () => toast.info("Em breve!") },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="px-4 py-2 rounded-full border border-border bg-card text-foreground text-xs font-medium hover:border-primary/40 hover:text-primary transition-all"
            >
              {btn.label}
            </button>
          ))}
        </div>
        

        {/* Coupons List */}
        {coupons.length > 0 && (
          <div className="glass-card p-4 mb-5">
            <Caption className="font-bold text-foreground mb-3">CUPONS ATIVOS</Caption>
            <div className="space-y-2">
              {coupons.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">{c.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.discount_type === "percentual" ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(2)}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.uses}/{c.max_uses} usos</span>
                  </div>
                  <button
                    onClick={() => toggleCoupon.mutate({ id: c.id, active: !c.active })}
                    className={`px-3 py-1 rounded text-xs font-medium ${c.active ? "bg-lime/20 text-lime" : "bg-destructive/20 text-destructive"}`}
                  >
                    {c.active ? "Ativo" : "Inativo"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Steps */}
        {(() => {
          const steps = [
            { label: "Infos do Evento", done: true },
            { label: "Enviar Fotos", done: photos.length > 0 },
            { label: "Identificar Fotos", done: photos.some(p => p.identified) },
            { label: "Ativar Evento", done: event.status === "ativo" },
            { label: "Vender", done: orders.length > 0 },
          ];
          const doneCount = steps.filter(s => s.done).length;
          const progressPct = Math.max(0, Math.min(100, ((doneCount - 1) / (steps.length - 1)) * 100));
          return (
            <div className="rounded-2xl bg-card border border-border shadow-sm p-5 mb-5">
              <div className="flex items-center justify-between mb-5">
                <SectionTitle className="text-base sm:text-lg">Progresso do Evento</SectionTitle>
                <span className="text-xs text-muted-foreground font-medium">{doneCount} de {steps.length}</span>
              </div>
              <div className="relative flex items-start justify-between">
                <div className="absolute left-4 right-4 top-4 h-0.5 bg-border -z-0" />
                <div
                  className="absolute left-4 top-4 h-0.5 bg-primary -z-0 transition-all duration-700"
                  style={{ width: `calc((100% - 2rem) * ${progressPct / 100})` }}
                />
                {steps.map((step, i) => {
                  const isCurrent = !step.done && steps.slice(0, i).every(s => s.done);
                  return (
                    <div key={step.label} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-card transition-all
                          ${step.done ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary text-primary-foreground animate-pulse" : "bg-secondary text-muted-foreground"}`}
                      >
                        {step.done ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </div>
                      <span className={`text-[10px] sm:text-[11px] font-semibold text-center leading-tight
                        ${step.done ? "text-foreground" : isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ======= MODALS ======= */}
        <UploadModal open={showUploadPhotos} onClose={() => setShowUploadPhotos(false)} onUpload={(files) => runUploadWithDupCheck(files, "photos")} isUploading={s3UploadPhotos.isPending} type="photos" />
        <UploadModal open={showUploadVideos} onClose={() => setShowUploadVideos(false)} onUpload={(files) => runUploadWithDupCheck(files, "videos")} isUploading={s3UploadVideos.isPending} type="videos" />
        <DuplicateFilesModal {...photosUpload.dupModal} />
        <DuplicateFilesModal {...videosUpload.dupModal} />
        <PriceGridModal
          open={showPriceGrid}
          onClose={() => setShowPriceGrid(false)}
          onSave={(g) => { savePriceGrid.mutate(g); setShowPriceGrid(false); }}
          onDelete={(gid) => deletePriceGrid.mutate(gid)}
          isSaving={savePriceGrid.isPending}
          grids={(grids || []).map((g: any) => ({
            id: g.id,
            name: g.name,
            photo_high_price: Number(g.photo_high_price),
            photo_low_price: Number(g.photo_low_price),
            video_price: Number(g.video_price),
          }))}
          photographerShare={Number((event as any).commission_photographer_share ?? 10)}
          clientShare={Number((event as any).commission_client_share ?? 0)}
        />
        <DiscountModal
          open={showDiscount}
          onClose={() => setShowDiscount(false)}
          onSave={(pkg) => { savePackage.mutate(pkg); setShowDiscount(false); }}
          isSaving={savePackage.isPending || updateEvent.isPending}
          basePhotoPrice={grid ? Number(grid.photo_high_price) : 20}
          initialProgressiveEnabled={!!event.progressive_discount_enabled}
          initialProgressiveRules={Array.isArray(event.progressive_discount_rules) ? (event.progressive_discount_rules as any) : []}
          onSaveProgressive={(rules, enabled) => {
            updateEvent.mutate({
              progressive_discount_enabled: enabled,
              progressive_discount_rules: rules as any,
            });
          }}
        />
        <CouponModal open={showCoupon} onClose={() => setShowCoupon(false)} onSave={(c) => { createCoupon.mutate(c); setShowCoupon(false); }} isSaving={createCoupon.isPending} />
        <EditEventModal open={showEdit} onClose={() => setShowEdit(false)} onSave={(data) => { updateEvent.mutate(data as any); setShowEdit(false); }} initial={{ name: event.name, event_date: event.event_date, event_time: event.event_time, location: event.location, category: event.category, search_type: event.search_type || [], visibility: event.visibility }} isSaving={updateEvent.isPending} />
        <PasswordModal
          open={showPassword}
          onClose={() => setShowPassword(false)}
          hasPassword={!!event.has_password}
          isSaving={savingPassword}
          onSave={async (pw) => {
            setSavingPassword(true);
            try {
              await setEventPassword(event.id, pw);
              toast.success(pw ? "Senha do evento definida!" : "Senha removida.");
              setShowPassword(false);
              refetch();
            } catch (e: any) {
              toast.error(e?.message || "Erro ao salvar a senha.");
            } finally {
              setSavingPassword(false);
            }
          }}
        />
        <PhotoGallery
          open={showGallery}
          onClose={() => setShowGallery(false)}
          photos={photos}
          onDelete={(pid) => deletePhoto.mutate(pid)}
          isDeleting={deletePhoto.isPending}
          totalPhotos={photos.length}
          onUploadFiles={(files, album) => runUploadWithDupCheck(files, "photos", album)}
          isUploading={s3UploadPhotos.isPending}
          uploadProgress={photoUploadProgress}
          coverUrl={event?.cover_url}
          onSetCover={async (photo) => {
            try {
              const { data: signed } = await supabase.functions.invoke("s3-presign", {
                body: { action: "sign_read_batch", objects: [{ path: photo.file_url }] },
              });
              const url = signed?.results?.[0]?.url || photo.file_url;
              await updateEvent.mutateAsync({ cover_url: url });
              toast.success("Foto definida como capa do evento");
            } catch (e: any) {
              toast.error("Erro ao definir capa: " + (e.message || "tente novamente"));
            }
          }}
          onBulkDelete={async (ids) => {
            const { error } = await supabase.from("event_photos").delete().in("id", ids);
            if (error) {
              toast.error("Erro ao excluir fotos");
              return;
            }
            toast.success(`${ids.length} foto(s) excluída(s)`);
            queryClient.invalidateQueries({ queryKey: ["event-photos", id] });
          }}
        />
        <VideoGallery
          open={showVideoGallery}
          onClose={() => setShowVideoGallery(false)}
          videos={videos as any}
          onDelete={(vid) => deleteVideo.mutate(vid)}
          isDeleting={deleteVideo.isPending}
          totalVideos={videos.length}
          onUploadFiles={(files) => runUploadWithDupCheck(files, "videos")}
          isUploading={s3UploadVideos.isPending}
          uploadProgress={videoUploadProgress}
          onBulkDelete={async (ids) => {
            const { error } = await supabase.from("event_videos").delete().in("id", ids);
            if (error) {
              toast.error("Erro ao excluir vídeos");
              return;
            }
            toast.success(`${ids.length} vídeo(s) excluído(s)`);
            queryClient.invalidateQueries({ queryKey: ["event-videos", id] });
          }}
        />
        <PromoArtModal
          open={showPromo}
          onClose={() => setShowPromo(false)}
          event={{
            id: event.id,
            name: event.name,
            event_date: event.event_date,
            event_time: event.event_time,
            location: event.location,
            cover_url: event.cover_url,
          }}
          photographerName={profile?.full_name || undefined}
        />
        <CollaborationModal
          open={showCollab}
          onClose={() => setShowCollab(false)}
          eventId={event.id}
          ownerCommissionPct={Number((event as any).owner_commission_pct ?? 0)}
          collabNote={(event as any).collab_note ?? null}
        />
        <ScheduleModal
          open={showSchedule}
          onClose={() => setShowSchedule(false)}
          initial={(event as any).publish_at}
          isSaving={updateEvent.isPending}
          onConfirm={(iso) => {
            updateEvent.mutate({ status: "agendado", publish_at: iso } as any);
            setShowSchedule(false);
            toast.success("Publicação agendada!");
          }}
        />
        {/* Actions dropdown */}
        {showActions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowActions(false)}>
            <div className="glass-card p-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
              <SectionTitle className="text-base sm:text-lg mb-3">Ações do Evento</SectionTitle>
              <div className="space-y-2">
                <button onClick={handleDuplicateEvent} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors text-left">
                  <Copy className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Duplicar Evento</span>
                </button>
                <button onClick={handleShareLink} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors text-left">
                  <Share2 className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Copiar Link</span>
                </button>
                <button onClick={handleDeleteEvent} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 transition-colors text-left">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">Excluir Evento</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Dialog open={showOrders} onOpenChange={setShowOrders}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0 bg-background border-border">
          <div className="p-0 overflow-y-auto flex-1 scrollbar-thin">
            <OrdersModule onClose={() => setShowOrders(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <EventFinancialCenter 
        open={showFinancial} 
        onClose={() => setShowFinancial(false)} 
        eventId={id} 
      />

      <PhotoManager
        open={showPhotoManager}
        onClose={() => setShowPhotoManager(false)}
        photos={photos.map(p => ({
          ...p,
          visibility: (p as any).visibility || "public",
          sales_count: (p as any).sales_count || 0,
          downloads_count: (p as any).downloads_count || 0,
          price: (p as any).price || 0
        }))}
        onDelete={(photoId) => deletePhoto.mutate(photoId)}
        onUpdateStatus={async (ids, status) => {
          try {
            const { error } = await supabase
              .from("event_photos")
              .update({ visibility: status } as any)
              .in("id", ids);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ["event-photos", id] });
          } catch (err: any) {
            toast.error("Erro ao atualizar status: " + err.message);
          }
        }}
        eventId={id || ""}
      />

      <VideoManager
        open={showVideoManager}
        onClose={() => setShowVideoManager(false)}
        videos={videos.map(v => ({
          ...v,
          visibility: (v as any).visibility || "public",
          sales_count: (v as any).sales_count || 0,
          downloads_count: (v as any).downloads_count || 0,
          price: (v as any).price || 0
        })) as any}
        onDelete={(videoId) => deleteVideo.mutate(videoId)}
        onUpdateStatus={(ids, status) => updateVideoStatus.mutate({ ids, visibility: status })}
        eventId={id || ""}
      />
    </div>
  );
};

export default EventDashboard;
