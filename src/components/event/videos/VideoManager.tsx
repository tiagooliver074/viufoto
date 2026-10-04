import { useState, useMemo, useEffect } from "react";
import { 
  X, Search, Trash2, Eye, Download, Info, FileText, 
  CheckCircle2, AlertCircle, Loader2, ChevronLeft, 
  ChevronRight, ChevronsLeft, ChevronsRight, Film,
  EyeOff, Globe, Play, Copy, ExternalLink, Edit, MoreVertical
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getSignedReadUrls } from "@/hooks/useS3Upload";
import { IS_LAMBDA_PIPELINE_ACTIVE, getVideoDerivativeCdnUrl, isStoragePath } from "@/lib/cdnConfig";
import { PageSubtitle, Caption } from "@/components/ui/Typography";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface EventVideo {
  id: string;
  file_url: string;
  file_name: string | null;
  created_at: string;
  status?: "pending" | "processing" | "ready" | "failed" | null;
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  codec?: string | null;
  file_size_bytes?: number | null;
  thumbnail_url?: string | null;
  poster_url?: string | null;
  preview_url?: string | null;
  processing_error?: string | null;
  sales_count?: number;
  downloads_count?: number;
  price?: number;
  visibility?: "public" | "hidden";
}

interface VideoManagerProps {
  open: boolean;
  onClose: () => void;
  videos: EventVideo[];
  onDelete: (id: string) => void;
  onUpdateStatus?: (ids: string[], status: "public" | "hidden") => void;
  eventId: string;
}

export function VideoManager({ open, onClose, videos, onDelete, onUpdateStatus, eventId }: VideoManagerProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name_asc" | "name_desc" | "sales">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [detailVideo, setDetailVideo] = useState<EventVideo | null>(null);
  const [playerVideo, setPlayerVideo] = useState<EventVideo | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const itemsPerPage = 24;


  // Stats
  const stats = useMemo(() => {
    return {
      total: videos.length,
      sold: videos.reduce((acc, v) => acc + (v.sales_count || 0), 0),
      public: videos.filter(v => v.visibility !== "hidden").length,
      hidden: videos.filter(v => v.visibility === "hidden").length,
      processing: videos.filter(v => v.status === "processing" || v.status === "pending").length
    };
  }, [videos]);

  // Filtering & Sorting
  const filteredVideos = useMemo(() => {
    let result = [...videos];
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(v => 
        v.id.toLowerCase().includes(s) || 
        (v.file_name || "").toLowerCase().includes(s)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name_asc": return (a.file_name || "").localeCompare(b.file_name || "");
        case "name_desc": return (b.file_name || "").localeCompare(a.file_name || "");
        case "sales": return (b.sales_count || 0) - (a.sales_count || 0);
        default: return 0;
      }
    });

    return result;
  }, [videos, search, sortBy]);

  const paginatedVideos = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredVideos.slice(start, start + itemsPerPage);
  }, [filteredVideos, page]);

  // Sign URLs for visible thumbnails
  useEffect(() => {
    if (!open) return;
    const thumbPaths = paginatedVideos
      .map(v => v.thumbnail_url)
      .filter((p): p is string => !!p && isStoragePath(p) && !signedUrls[p]);
    
    if (thumbPaths.length > 0 && !IS_LAMBDA_PIPELINE_ACTIVE) {
      getSignedReadUrls(thumbPaths).then(urls => {
        setSignedUrls(prev => ({ ...prev, ...urls }));
      });
    }
  }, [open, paginatedVideos, signedUrls]);

  const totalPages = Math.ceil(filteredVideos.length / itemsPerPage);

  // Selection Logic
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === paginatedVideos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedVideos.map(v => v.id)));
  };

  // Actions
  const handleBulkDelete = () => {
    if (window.confirm(`Excluir ${selectedIds.size} vídeos permanentemente?`)) {
      Array.from(selectedIds).forEach(id => onDelete(id));
      setSelectedIds(new Set());
      toast.success("Vídeos excluídos com sucesso.");
    }
  };

  const handleBulkVisibility = (status: "public" | "hidden") => {
    onUpdateStatus?.(Array.from(selectedIds), status);
    setSelectedIds(new Set());
    toast.success(`Vídeos marcados como ${status === "public" ? "públicos" : "ocultos"}.`);
  };

  const handleDownloadOriginals = async () => {
    toast.info("Iniciando download dos originais...");
    const ids = Array.from(selectedIds);
    const selectedVideos = videos.filter(v => ids.includes(v.id));
    const paths = selectedVideos.map(v => v.file_url);
    
    try {
      const urls = await getSignedReadUrls(paths);
      ids.forEach(id => {
        const video = selectedVideos.find(v => v.id === id);
        if (video && urls[video.file_url]) {
          window.open(urls[video.file_url], "_blank");
        }
      });
    } catch (err) {
      toast.error("Erro ao gerar links de download.");
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds && seconds !== 0) return "—";
    const s = Math.round(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* Top Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <PageSubtitle className="text-primary font-bold">GERENCIADOR DE VÍDEOS</PageSubtitle>
              <Caption className="text-muted-foreground">Gestão profissional e produtividade para seus vídeos</Caption>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Total de vídeos", value: stats.total, icon: Film },
              { label: "Vídeos vendidos", value: stats.sold, icon: CheckCircle2 },
              { label: "Vídeos públicos", value: stats.public, icon: Globe },
              { label: "Vídeos ocultos", value: stats.hidden, icon: EyeOff },
              { label: "Em processamento", value: stats.processing, icon: Loader2 }
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <s.icon className={`w-4 h-4 ${s.label === 'Em processamento' && s.value > 0 ? 'animate-spin' : ''} text-muted-foreground`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">{s.label}</p>
                  <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[300px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Pesquisar por código ou nome do arquivo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <select 
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none"
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
                <option value="name_asc">Nome (A-Z)</option>
                <option value="name_desc">Nome (Z-A)</option>
                <option value="sales">Mais vendidos</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={selectAll}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-secondary transition-colors"
              >
                {selectedIds.size === paginatedVideos.length ? "Desmarcar todos" : "Selecionar página"}
              </button>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-xs font-bold text-primary mr-2">{selectedIds.size} selecionados</span>
                  <button onClick={handleBulkDelete} className="p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleBulkVisibility("public")} className="p-1.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors" title="Publicar">
                    <Globe className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleBulkVisibility("hidden")} className="p-1.5 rounded bg-warning/10 text-warning hover:bg-warning/20 transition-colors" title="Ocultar">
                    <EyeOff className="w-4 h-4" />
                  </button>
                  <button onClick={handleDownloadOriginals} className="p-1.5 rounded bg-primary text-white hover:bg-primary/90 transition-colors" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Grid */}
          <div className="flex-1 overflow-auto p-6 scrollbar-thin">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {paginatedVideos.map(video => {
                const isSelected = selectedIds.has(video.id);
                const isHidden = video.visibility === "hidden";
                const thumbUrl = video.thumbnail_url 
                  ? (IS_LAMBDA_PIPELINE_ACTIVE ? getVideoDerivativeCdnUrl(video.thumbnail_url) : signedUrls[video.thumbnail_url]) 
                  : null;

                return (
                  <div 
                    key={video.id}
                    onClick={() => setDetailVideo(video)}
                    className={`relative group rounded-xl border aspect-[4/5] overflow-hidden cursor-pointer transition-all ${
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                    } ${isHidden ? "opacity-70" : ""}`}
                  >
                    {/* Selection Checkbox */}
                    <div 
                      className={`absolute top-2 left-2 z-40 transition-opacity ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(video.id); }}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-black/20 border-white/50 hover:border-white'}`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center">
                      <Film className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    {thumbUrl && (
                      <img 
                        src={thumbUrl} 
                        alt={video.file_name || ""} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}

                    {/* Overlay for "ready" videos to show play button on hover */}
                    {video.status === "ready" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all z-10">
                        <div 
                          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayerVideo(video);
                          }}
                        >
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Top-right menu button */}
                    <div className="absolute top-2 right-2 z-30 flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white transition-colors backdrop-blur-sm sm:opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailVideo(video); }}>
                            <Edit className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdateStatus?.([video.id], video.visibility === 'hidden' ? 'public' : 'hidden'); }}>
                            {video.visibility === 'hidden' ? <Globe className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                            {video.visibility === 'hidden' ? 'Publicar' : 'Ocultar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); getSignedReadUrls([video.file_url]).then(urls => urls[video.file_url] && window.open(urls[video.file_url], "_blank")); }}>
                            <Download className="w-4 h-4 mr-2" /> Baixar original
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/foto/${video.id}`); toast.success("Copiado!"); }}>
                            <Copy className="w-4 h-4 mr-2" /> Copiar link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/evento/${eventId}`, "_blank"); }}>
                            <ExternalLink className="w-4 h-4 mr-2" /> Visualizar no site
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); if(confirm("Excluir vídeo?")) onDelete(video.id); }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Status Tags */}
                    <div className="absolute top-8 left-2 flex flex-col gap-1 z-20">
                      {isHidden && (
                        <span className="px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold uppercase backdrop-blur-sm flex items-center gap-1">
                          <EyeOff className="w-2.5 h-2.5" /> Oculto
                        </span>
                      )}
                      {video.sales_count && video.sales_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-success text-white text-[9px] font-bold uppercase backdrop-blur-sm flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> {video.sales_count} vendas
                        </span>
                      )}
                      {video.status && video.status !== "ready" && (
                        <span className={`px-1.5 py-0.5 rounded ${video.status === 'failed' ? 'bg-destructive' : 'bg-primary'} text-white text-[9px] font-bold uppercase backdrop-blur-sm flex items-center gap-1`}>
                          {video.status === 'processing' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <AlertCircle className="w-2.5 h-2.5" />} 
                          {video.status === 'processing' ? 'Processando' : 'Falhou'}
                        </span>
                      )}
                    </div>

                    {/* Selection Checkbox */}
                    <div 
                      className={`absolute bottom-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-20 ${
                        isSelected ? "bg-primary border-primary" : "bg-black/20 border-white/50 opacity-0 group-hover:opacity-100"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(video.id);
                      }}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>

                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 z-20">
                      <p className="text-[10px] text-white/90 font-medium truncate">#{video.id.slice(0,8)}</p>
                      <p className="text-[9px] text-white/60 truncate">{video.file_name}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8 py-4 border-t border-border">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                  className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium px-4">
                  Página {page} de {totalPages}
                </span>
                <button 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button 
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                  className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right Panel - Details */}
          {detailVideo && (
            <div className="w-80 border-l border-border bg-card p-6 overflow-auto scrollbar-none animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between mb-6">
                <PageSubtitle className="text-sm font-bold">DETALHES DO VÍDEO</PageSubtitle>
                <button onClick={() => setDetailVideo(null)} className="p-1 hover:bg-secondary rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl overflow-hidden border border-border aspect-[4/5] bg-secondary mb-6 relative group">
                {detailVideo.thumbnail_url ? (
                  <img 
                    src={IS_LAMBDA_PIPELINE_ACTIVE ? getVideoDerivativeCdnUrl(detailVideo.thumbnail_url) : signedUrls[detailVideo.thumbnail_url]} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                
                {detailVideo.status === "ready" && (
                  <button 
                    onClick={() => setPlayerVideo(detailVideo)}
                    className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Play className="w-10 h-10 text-white fill-white" />
                  </button>
                )}
              </div>

              <div className="space-y-4 mb-8">
                {[
                  { label: "Código do vídeo", value: detailVideo.id, copy: true },
                  { label: "Nome do arquivo", value: detailVideo.file_name, copy: true },
                  { label: "Duração", value: formatDuration(detailVideo.duration_seconds) },
                  { label: "Resolução", value: detailVideo.width && detailVideo.height ? `${detailVideo.width}x${detailVideo.height}` : "—" },
                  { label: "Tamanho", value: formatFileSize(detailVideo.file_size_bytes) },
                  { label: "Preço", value: detailVideo.price ? `R$ ${detailVideo.price.toFixed(2)}` : "R$ 0,00" },
                  { label: "Status", value: detailVideo.visibility === 'hidden' ? "Oculto" : "Público" },
                  { label: "Data do upload", value: new Date(detailVideo.created_at).toLocaleDateString("pt-BR") },
                  { label: "Vendas", value: detailVideo.sales_count || 0 },
                  { label: "Downloads", value: detailVideo.downloads_count || 0 }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">{item.label}</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{item.value}</span>
                      {item.copy && (
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(item.value?.toString() || "");
                            toast.success("Copiado!");
                          }}
                          className="p-1 text-muted-foreground hover:text-primary"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions Menu */}
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => onUpdateStatus?.([detailVideo.id], detailVideo.visibility === 'hidden' ? 'public' : 'hidden')}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  {detailVideo.visibility === 'hidden' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {detailVideo.visibility === 'hidden' ? "Publicar" : "Ocultar"}
                </button>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/foto/${detailVideo.id}`; // Common route for shareable content
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado!");
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <Copy className="w-4 h-4" /> Copiar link
                </button>
                <button 
                  onClick={() => window.open(`/evento/${eventId}`, "_blank")}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Visualizar no site
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Excluir este vídeo permanentemente?")) {
                      onDelete(detailVideo.id);
                      setDetailVideo(null);
                      toast.success("Vídeo excluído.");
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Excluir vídeo
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Video Player Dialog */}
      <Dialog open={!!playerVideo} onOpenChange={(o) => !o && setPlayerVideo(null)}>
        <DialogContent hideClose className="max-w-4xl p-0 bg-black overflow-hidden border-none aspect-video flex items-center justify-center">
          <div className="w-full h-full relative group">
            {playerVideo && (
              <video 
                key={playerVideo.id}
                src={IS_LAMBDA_PIPELINE_ACTIVE && playerVideo.preview_url ? getVideoDerivativeCdnUrl(playerVideo.preview_url) : (signedUrls[playerVideo.file_url] || playerVideo.file_url)}
                controls
                autoPlay
                className="w-full h-full"
                onLoadStart={() => {
                  if (!IS_LAMBDA_PIPELINE_ACTIVE && !signedUrls[playerVideo.file_url] && isStoragePath(playerVideo.file_url)) {
                    getSignedReadUrls([playerVideo.file_url]).then(urls => {
                      setSignedUrls(prev => ({ ...prev, ...urls }));
                    });
                  }
                }}
              />
            )}
            <button 
              onClick={() => setPlayerVideo(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
