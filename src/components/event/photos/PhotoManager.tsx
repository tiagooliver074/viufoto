import { useState, useMemo } from "react";
import { 
  X, Search, Trash2, Eye, Download, Info, Star, 
  MoreVertical, FileText, CheckCircle2, AlertCircle, 
  Loader2, ChevronLeft, ChevronRight, ChevronsLeft, 
  ChevronsRight, Filter, SortAsc, SortDesc, Image as ImageIcon,
  EyeOff, Globe
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getSignedReadUrls } from "@/hooks/useS3Upload";
import { IS_LAMBDA_PIPELINE_ACTIVE, getThumbCdnUrl, toThumbPath, isStoragePath } from "@/lib/cdnConfig";
import { PageTitle, Caption, PageSubtitle } from "@/components/ui/Typography";

interface Photo {
  id: string;
  file_url: string;
  file_name: string | null;
  identified: boolean;
  album: string | null;
  created_at: string;
  status?: string;
  identified_count?: number;
  sales_count?: number;
  downloads_count?: number;
  price?: number;
  visibility?: "public" | "hidden";
}

interface PhotoManagerProps {
  open: boolean;
  onClose: () => void;
  photos: Photo[];
  onDelete: (id: string) => void;
  onUpdateStatus?: (ids: string[], status: "public" | "hidden") => void;
  eventId: string;
}

export function PhotoManager({ open, onClose, photos, onDelete, onUpdateStatus, eventId }: PhotoManagerProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name_asc" | "name_desc" | "sales">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [detailPhoto, setDetailPhoto] = useState<Photo | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const itemsPerPage = 24;

  // Stats
  const stats = useMemo(() => {
    return {
      total: photos.length,
      sold: photos.reduce((acc, p) => acc + (p.sales_count || 0), 0),
      public: photos.filter(p => p.visibility !== "hidden").length,
      hidden: photos.filter(p => p.visibility === "hidden").length,
      processing: photos.filter(p => p.status === "processing").length
    };
  }, [photos]);

  // Filtering & Sorting
  const filteredPhotos = useMemo(() => {
    let result = [...photos];
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => 
        p.id.toLowerCase().includes(s) || 
        (p.file_name || "").toLowerCase().includes(s)
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
  }, [photos, search, sortBy]);

  const paginatedPhotos = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredPhotos.slice(start, start + itemsPerPage);
  }, [filteredPhotos, page]);

  const totalPages = Math.ceil(filteredPhotos.length / itemsPerPage);

  // Selection Logic
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === paginatedPhotos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedPhotos.map(p => p.id)));
  };

  // Actions
  const handleBulkDelete = () => {
    if (window.confirm(`Excluir ${selectedIds.size} fotos permanentemente?`)) {
      Array.from(selectedIds).forEach(id => onDelete(id));
      setSelectedIds(new Set());
      toast.success("Fotos excluídas com sucesso.");
    }
  };

  const handleBulkVisibility = (status: "public" | "hidden") => {
    onUpdateStatus?.(Array.from(selectedIds), status);
    setSelectedIds(new Set());
    toast.success(`Fotos marcadas como ${status === "public" ? "públicas" : "ocultas"}.`);
  };

  const handleDownloadOriginals = async () => {
    toast.info("Iniciando download dos originais...");
    const ids = Array.from(selectedIds);
    const selectedPhotos = photos.filter(p => ids.includes(p.id));
    const paths = selectedPhotos.map(p => p.file_url);
    
    try {
      const urls = await getSignedReadUrls(paths);
      ids.forEach(id => {
        const photo = selectedPhotos.find(p => p.id === id);
        if (photo && urls[photo.file_url]) {
          window.open(urls[photo.file_url], "_blank");
        }
      });
    } catch (err) {
      toast.error("Erro ao gerar links de download.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* Top Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <PageSubtitle className="text-primary font-bold">GERENCIADOR DE FOTOS</PageSubtitle>
              <Caption className="text-muted-foreground">Produtividade e organização para o seu acervo</Caption>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Total de fotos", value: stats.total, icon: ImageIcon },
              { label: "Fotos vendidas", value: stats.sold, icon: CheckCircle2 },
              { label: "Fotos públicas", value: stats.public, icon: Globe },
              { label: "Fotos ocultas", value: stats.hidden, icon: EyeOff },
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
                <option value="sales">Mais vendidas</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={selectAll}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-secondary transition-colors"
              >
                {selectedIds.size === paginatedPhotos.length ? "Desmarcar todos" : "Selecionar página"}
              </button>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-xs font-bold text-primary mr-2">{selectedIds.size} selecionadas</span>
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
              {paginatedPhotos.map(photo => {
                const isSelected = selectedIds.has(photo.id);
                const isHidden = photo.visibility === "hidden";
                const thumbUrl = IS_LAMBDA_PIPELINE_ACTIVE 
                  ? getThumbCdnUrl(photo.file_url) 
                  : signedUrls[photo.file_url] || "";

                return (
                  <div 
                    key={photo.id}
                    onClick={() => setDetailPhoto(photo)}
                    className={`relative group rounded-xl border aspect-[3/4] overflow-hidden cursor-pointer transition-all ${
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                    } ${isHidden ? "opacity-70" : ""}`}
                  >
                    <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    {thumbUrl && (
                      <img 
                        src={thumbUrl} 
                        alt={photo.file_name || ""} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}

                    {/* Status Tags */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {isHidden && (
                        <span className="px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold uppercase backdrop-blur-sm flex items-center gap-1">
                          <EyeOff className="w-2.5 h-2.5" /> Oculta
                        </span>
                      )}
                      {photo.sales_count && photo.sales_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-success text-white text-[9px] font-bold uppercase backdrop-blur-sm flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> {photo.sales_count} vendas
                        </span>
                      )}
                    </div>

                    {/* Selection Checkbox */}
                    <div 
                      className={`absolute bottom-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected ? "bg-primary border-primary" : "bg-black/20 border-white/50 opacity-0 group-hover:opacity-100"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(photo.id);
                      }}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>

                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                      <p className="text-[10px] text-white/90 font-medium truncate">#{photo.id.slice(0,8)}</p>
                      <p className="text-[9px] text-white/60 truncate">{photo.file_name}</p>
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
          {detailPhoto && (
            <div className="w-80 border-l border-border bg-card p-6 overflow-auto scrollbar-none animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between mb-6">
                <PageSubtitle className="text-sm font-bold">DETALHES DA FOTO</PageSubtitle>
                <button onClick={() => setDetailPhoto(null)} className="p-1 hover:bg-secondary rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl overflow-hidden border border-border aspect-square bg-secondary mb-6 relative">
                <img 
                  src={IS_LAMBDA_PIPELINE_ACTIVE ? getThumbCdnUrl(detailPhoto.file_url) : signedUrls[detailPhoto.file_url]} 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-4 mb-8">
                {[
                  { label: "Código da foto", value: detailPhoto.id, copy: true },
                  { label: "Nome do arquivo", value: detailPhoto.file_name, copy: true },
                  { label: "Preço", value: detailPhoto.price ? `R$ ${detailPhoto.price.toFixed(2)}` : "Não definido" },
                  { label: "Status", value: detailPhoto.visibility === 'hidden' ? "Oculta" : "Pública" },
                  { label: "Data do upload", value: new Date(detailPhoto.created_at).toLocaleDateString("pt-BR") },
                  { label: "Vendas", value: detailPhoto.sales_count || 0 },
                  { label: "Downloads", value: detailPhoto.downloads_count || 0 }
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

              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => onUpdateStatus?.([detailPhoto.id], detailPhoto.visibility === 'hidden' ? 'public' : 'hidden')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  {detailPhoto.visibility === 'hidden' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {detailPhoto.visibility === 'hidden' ? "Publicar" : "Ocultar"}
                </button>
                <button 
                  onClick={() => {
                    getSignedReadUrls([detailPhoto.file_url]).then(urls => {
                      if (urls[detailPhoto.file_url]) window.open(urls[detailPhoto.file_url], "_blank");
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <Download className="w-4 h-4" /> Download original
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Excluir esta foto permanentemente?")) {
                      onDelete(detailPhoto.id);
                      setDetailPhoto(null);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-destructive/20 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Excluir permanentemente
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
