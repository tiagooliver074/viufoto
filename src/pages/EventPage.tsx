import { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Calendar, MapPin, Camera, ScanFace, Search, ShoppingCart, X, Heart, Lock, Share2, RefreshCw, Loader2, ChevronLeft, ChevronRight, Folder, ArrowLeft, Film, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import LazyPhotoCard from "@/components/LazyPhotoCard";
import BlurProtectionOverlay from "@/components/BlurProtectionOverlay";
import { useBlurProtection } from "@/hooks/useBlurProtection";
import { Skeleton } from "@/components/ui/skeleton";
import PhotoTermsFooter from "@/components/PhotoTermsFooter";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "sonner";
import { getPhotoCode } from "@/lib/photoCode";
import DiscountBanner from "@/components/event/DiscountBanner";
import FaceSearchModal from "@/components/event/FaceSearchModal";
import GalleryTabs, { type GalleryTab } from "@/components/event/GalleryTabs";
import { getCoverUrl } from "@/lib/eventCover";
import { useMarketingTracker } from "@/hooks/useMarketingTracker";
import { trackFunnelEvent } from "@/lib/searchTracking";
import {
  toThumbPath as cdnToThumbPath,
  toMediumPath as cdnToMediumPath,
  getThumbCdnUrl,
  getMediumCdnUrl,
  getVideoDerivativeCdnUrl,
  IS_LAMBDA_PIPELINE_ACTIVE,
} from "@/lib/cdnConfig";
import { shareBaseUrl } from "@/lib/shareUrl";
import { getStoredAccess, verifyEventPassword, fetchProtectedGallery } from "@/lib/eventAccess";

/** Fetch signed read URLs without requiring auth */
async function getPublicSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/s3-presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
    },
    body: JSON.stringify({
      action: "sign_read_batch",
      objects: paths.map((p) => ({ path: p })),
    }),
  });

  if (!res.ok) throw new Error("Erro ao carregar imagens");
  const data = await res.json();
  const urlMap: Record<string, string> = {};
  for (const r of data.results || []) {
    if (r.url) urlMap[r.path] = r.url;
  }
  return urlMap;
}

const EventPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [searchBib, setSearchBib] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredAccess(id)?.token ?? null);
  const [verifying, setVerifying] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceMatchIds, setFaceMatchIds] = useState<Set<string> | null>(null);
  const [faceSimilarityById, setFaceSimilarityById] = useState<Map<string, number>>(new Map());
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Aba ativa (Fotos | Vídeos) — persistida por evento em localStorage.
  const tabStorageKey = id ? `viufoto_gallery_tab_${id}` : null;
  const [activeTab, setActiveTab] = useState<GalleryTab>(() => {
    if (typeof window === "undefined" || !tabStorageKey) return "photos";
    const saved = window.localStorage.getItem(tabStorageKey);
    return saved === "videos" ? "videos" : "photos";
  });
  useEffect(() => {
    if (!tabStorageKey) return;
    window.localStorage.setItem(tabStorageKey, activeTab);
  }, [activeTab, tabStorageKey]);

  // Fetch event
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["public-event", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Marketing tracker: injeta pixels do fotógrafo dono + registra eventos do funil
  const { track: mktTrack } = useMarketingTracker(event?.organizer_id, id);

  const isLocked = !!event?.has_password && !accessToken;

  // Conteúdo de eventos protegidos vem da edge function (validada por token no servidor)
  const { data: protectedGallery } = useQuery({
    queryKey: ["protected-gallery", id, accessToken],
    queryFn: async () => {
      if (!id || !accessToken) return null;
      try {
        return await fetchProtectedGallery(id, accessToken);
      } catch {
        setAccessToken(null);
        return null;
      }
    },
    enabled: !!id && !!event?.has_password && !!accessToken,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch photos
  const { data: photos } = useQuery({
    queryKey: ["public-photos", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("event_photos")
        .select("*")
        .eq("event_id", id)
        .order("created_at");
      return data || [];
    },
    enabled: !!id && !!event && !event.has_password,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Stable key: only changes when photo count or IDs actually change
  const photoIds = useMemo(() => photos?.map(p => p.id).sort().join(",") || "", [photos]);

  // Use centralized path helpers
  const toThumbPath = useCallback(cdnToThumbPath, []);
  const toMediumPath = useCallback(cdnToMediumPath, []);

  // Fetch signed URLs for THUMBNAILS (grid)
  // When CDN is active, thumb/medium are public — no signed URLs needed for them
  const { data: thumbUrls, isLoading: urlsLoading, error: urlsError, refetch: refetchUrls } = useQuery({
    queryKey: ["thumb-urls", id, photoIds],
    queryFn: async () => {
      if (!photos || photos.length === 0) return {};

      // If CDN is active, build CDN URLs directly — no edge function call needed
      if (IS_LAMBDA_PIPELINE_ACTIVE) {
        const urlMap: Record<string, string> = {};
        for (const p of photos) {
          const cdnThumb = getThumbCdnUrl(p.file_url);
          if (cdnThumb) {
            urlMap[toThumbPath(p.file_url)] = cdnThumb;
          }
        }
        return urlMap;
      }

      // Fallback: S3 signed URLs for the WATERMARKED thumb variant.
      // Originals never reach the public gallery — they're protected post-purchase.
      const thumbPaths = photos.map((p: any) => toThumbPath(p.file_url));
      const urls = await getPublicSignedUrls(thumbPaths);
      // Index by both the thumb path and the original file_url, so getPhotoUrl
      // can resolve regardless of which key it asks for.
      const indexed: Record<string, string> = { ...urls };
      for (const p of photos as any[]) {
        const tp = toThumbPath(p.file_url);
        if (urls[tp]) indexed[p.file_url] = urls[tp];
      }
      return indexed;
    },
    enabled: !!photos && photos.length > 0,
    staleTime: IS_LAMBDA_PIPELINE_ACTIVE ? 60 * 60 * 1000 : 15 * 60 * 1000, // CDN URLs can be cached longer
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  });

  // Fetch medium URL only when a photo is selected (lightbox)
  const { data: mediumUrl, isLoading: mediumLoading } = useQuery({
    queryKey: ["medium-url", selectedPhoto?.file_url],
    queryFn: async () => {
      if (!selectedPhoto) return "";

      // If CDN is active, return CDN URL directly
      if (IS_LAMBDA_PIPELINE_ACTIVE) {
        return getMediumCdnUrl(selectedPhoto.file_url) || "";
      }

      // Fallback: serve the WATERMARKED medium variant (never the clean original)
      const mediumPath = toMediumPath(selectedPhoto.file_url);
      const res = await getPublicSignedUrls([mediumPath]);
      return res[mediumPath] || "";
    },
    enabled: !!selectedPhoto,
    staleTime: IS_LAMBDA_PIPELINE_ACTIVE ? 60 * 60 * 1000 : 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch videos — só os que já terminaram de processar (status "ready") entram na
  // vitrine pública; pending/processing/failed ficam invisíveis para o comprador.
  const { data: videos } = useQuery({
    queryKey: ["public-videos", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("event_videos")
        .select("*")
        .eq("event_id", id)
        .order("created_at");
      return ((data || []) as any[]).filter((v) => v.status === "ready");
    },
    enabled: !!id && !!event && !event.has_password,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const videoList = event?.has_password ? (protectedGallery?.videos || []) : (videos || []);

  // Resolve poster (grid thumbnail) URLs for videos
  const videoIds = useMemo(() => videoList.map((v: any) => v.id).sort().join(","), [videoList]);
  const { data: videoPosterUrls } = useQuery({
    queryKey: ["video-poster-urls", id, videoIds],
    queryFn: async () => {
      if (videoList.length === 0) return {};
      if (IS_LAMBDA_PIPELINE_ACTIVE) {
        const map: Record<string, string> = {};
        for (const v of videoList) {
          const u = getVideoDerivativeCdnUrl(v.thumbnail_url);
          if (u) map[v.id] = u;
        }
        return map;
      }
      const paths = videoList.map((v: any) => v.thumbnail_url).filter(Boolean);
      if (paths.length === 0) return {};
      const urls = await getPublicSignedUrls(paths);
      const byId: Record<string, string> = {};
      for (const v of videoList) {
        if (v.thumbnail_url && urls[v.thumbnail_url]) byId[v.id] = urls[v.thumbnail_url];
      }
      return byId;
    },
    enabled: videoList.length > 0,
    staleTime: IS_LAMBDA_PIPELINE_ACTIVE ? 60 * 60 * 1000 : 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const { data: selectedVideoPreviewUrl, isLoading: videoPreviewLoading } = useQuery({
    queryKey: ["video-preview-url", selectedVideo?.id],
    queryFn: async () => {
      if (!selectedVideo?.preview_url) return "";
      if (IS_LAMBDA_PIPELINE_ACTIVE) {
        return getVideoDerivativeCdnUrl(selectedVideo.preview_url) || "";
      }
      const res = await getPublicSignedUrls([selectedVideo.preview_url]);
      return res[selectedVideo.preview_url] || "";
    },
    enabled: !!selectedVideo,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch price grid
  const { data: priceGrid } = useQuery({
    queryKey: ["public-price", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from("price_grids")
        .select("*")
        .eq("event_id", id)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Fetch photographer site for watermark
  const { data: photographerSite } = useQuery({
    queryKey: ["photographer-site-event", event?.organizer_id],
    queryFn: async () => {
      if (!event?.organizer_id) return null;
      const { data } = await supabase
        .from("photographer_sites_public" as any)
        .select("watermark_url, display_name, slug, watermark_position, watermark_opacity, watermark_size, blur_protection_enabled, blur_protection_pattern, blur_protection_devices")
        .eq("user_id", event.organizer_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!event?.organizer_id,
  });

  const highPrice: number | null =
    typeof priceGrid?.photo_high_price === "number" ? priceGrid.photo_high_price : null;
  const { blurActive, blurPattern } = useBlurProtection(photographerSite);
  const videoPrice: number | null =
    typeof priceGrid?.video_price === "number" ? priceGrid.video_price : null;
  const hasPricing = highPrice !== null && highPrice > 0;
  const hasVideoPricing = videoPrice !== null && videoPrice > 0;
  const allPhotos = event?.has_password ? (protectedGallery?.photos || []) : (photos || []);

  // --- FASE 1: Busca por número de peito ---
  const trimmedBib = searchBib.trim();
  const isValidBibQuery = /^\d{1,6}$/.test(trimmedBib);

  const { data: bibMatchIds, isFetching: bibSearching } = useQuery({
    queryKey: ["bib-search", id, trimmedBib],
    queryFn: async () => {
      if (!id || !isValidBibQuery) return null;
      const { data, error } = await supabase
        .from("photo_bib_numbers")
        .select("photo_id")
        .eq("event_id", id)
        .eq("number", trimmedBib);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.photo_id));
    },
    enabled: !!id && isValidBibQuery,
    staleTime: 60_000,
  });

  // Track bib search results (fires once per query resolution)
  useEffect(() => {
    if (!id || !isValidBibQuery || bibSearching || !bibMatchIds) return;
    trackFunnelEvent({
      event_type: "search_performed",
      search_kind: "bib",
      event_id: id,
      has_results: bibMatchIds.size > 0,
      results_count: bibMatchIds.size,
      metadata: { query: trimmedBib },
      dedupeKey: `bib:${id}:${trimmedBib}`,
    });
  }, [id, isValidBibQuery, bibSearching, bibMatchIds, trimmedBib]);

  const photoList = useMemo(() => {
    // Busca facial tem prioridade — atravessa pastas
    if (faceMatchIds && faceMatchIds.size > 0) {
      const ordered = Array.from(faceMatchIds);
      const byId = new Map<string, any>(allPhotos.map((p: any) => [p.id, p]));
      return ordered.map((pid) => byId.get(pid)).filter(Boolean);
    }
    // Active bib search ignores folder filter (busca cruza todas as pastas)
    if (trimmedBib && isValidBibQuery && bibMatchIds) {
      return allPhotos.filter((p: any) => bibMatchIds.has(p.id));
    }
    if (trimmedBib) return allPhotos;
    // No search: apply folder filter when one is selected
    if (selectedFolder !== null) {
      return allPhotos.filter((p: any) => (p.album ?? null) === selectedFolder);
    }
    return allPhotos;
  }, [allPhotos, trimmedBib, isValidBibQuery, bibMatchIds, selectedFolder, faceMatchIds]);

  // Folder list derived from albums in event_photos
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    let rootCount = 0;
    for (const p of allPhotos as any[]) {
      if (p.album) counts.set(p.album, (counts.get(p.album) || 0) + 1);
      else rootCount++;
    }
    const list = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (rootCount > 0 && counts.size > 0) {
      // "Geral" represents photos uploaded sem pasta
      list.unshift({ name: "__root__", count: rootCount });
    }
    return list;
  }, [allPhotos]);

  const showFolderHub = !trimmedBib && selectedFolder === null && folders.length > 0;

  const PHOTOS_PER_PAGE = 32;
  const totalPages = Math.max(1, Math.ceil(photoList.length / PHOTOS_PER_PAGE));
  const paginatedPhotos = photoList.slice((page - 1) * PHOTOS_PER_PAGE, page * PHOTOS_PER_PAGE);

  // Reset to page 1 when search changes or photos reload
  useEffect(() => { setPage(1); }, [searchBib, photoList.length, selectedFolder]);

  // Keep page in valid range
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  // Build a compact page list with ellipsis: 1, 2, 3, 4, 5, …, ▶
  const pageNumbers = useMemo<(number | "ellipsis")[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const arr: (number | "ellipsis")[] = [];
    const add = (n: number | "ellipsis") => arr.push(n);
    add(1);
    if (page > 4) add("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) add(i);
    if (page < totalPages - 3) add("ellipsis");
    add(totalPages);
    return arr;
  }, [page, totalPages]);

  const goToPage = (p: number) => {
    setPage(p);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const getPhotoUrl = useCallback((photo: any) => {
    const thumbPath = toThumbPath(photo.file_url);
    const thumbUrl = thumbUrls?.[thumbPath];
    const originalUrl = thumbUrls?.[photo.file_url];
    return thumbUrl || originalUrl || "";
  }, [thumbUrls, toThumbPath]);

  const selectedIndex = selectedPhoto
    ? photoList.findIndex((p: any) => p.id === selectedPhoto.id)
    : -1;
  const goPrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedPhoto(photoList[selectedIndex - 1]);
  }, [selectedIndex, photoList]);
  const goNext = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < photoList.length - 1) {
      setSelectedPhoto(photoList[selectedIndex + 1]);
    }
  }, [selectedIndex, photoList]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") setSelectedPhoto(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPhoto, goPrev, goNext]);

  // Body scroll lock while lightbox is open (preserves gallery scroll position)
  useEffect(() => {
    if (!selectedPhoto) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedPhoto]);

  // Sync selected photo with ?foto=<id> URL param (back button closes; deep links open)
  const fotoParam = searchParams.get("foto");
  useEffect(() => {
    if (!photoList.length) return;
    if (fotoParam) {
      if (!selectedPhoto || selectedPhoto.id !== fotoParam) {
        const found = photoList.find((p: any) => p.id === fotoParam);
        if (found) {
          setSelectedPhoto(found);
          trackFunnelEvent({
            event_type: "photo_viewed",
            event_id: id ?? null,
            photo_id: found.id,
            dedupeKey: `${id}:${found.id}`,
          });
        }
      }
    } else if (selectedPhoto) {
      setSelectedPhoto(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoParam, photoList.length]);

  useEffect(() => {
    const current = searchParams.get("foto");
    if (selectedPhoto && current !== selectedPhoto.id) {
      const next = new URLSearchParams(searchParams);
      next.set("foto", selectedPhoto.id);
      setSearchParams(next, { replace: false });
    } else if (!selectedPhoto && current) {
      const next = new URLSearchParams(searchParams);
      next.delete("foto");
      setSearchParams(next, { replace: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhoto?.id]);

  // Password protection (validada no servidor)
  if (isLocked) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="glass-card p-8 max-w-sm w-full text-center space-y-4">
            <Lock className="w-12 h-12 text-primary mx-auto" />
            <h2 className="h3">Evento protegido</h2>
            <p className="body-small text-muted-foreground">Digite a senha para acessar as fotos</p>
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="Senha"
              className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-sm outline-none border border-border focus:border-primary"
            />
            <button
              disabled={verifying || !passwordInput}
              onClick={async () => {
                if (!id) return;
                setVerifying(true);
                const grant = await verifyEventPassword(id, passwordInput);
                setVerifying(false);
                if (grant) {
                  setPasswordInput("");
                  setAccessToken(grant.token);
                } else {
                  toast.error("Senha incorreta");
                }
              }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
            >
              {verifying ? "Verificando..." : "Acessar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen text-center">
          <div>
            <h1 className="h3 mb-2">Evento não encontrado</h1>
            <Link to="/" className="text-primary hover:underline">Voltar</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleAddToCart = (photo: any, _res?: "high" | "low") => {
    if (!hasPricing) {
      toast.error("Preços ainda não configurados pelo fotógrafo para este evento.");
      return;
    }
    addItem({
      photoId: photo.id,
      photoUrl: getPhotoUrl(photo),
      eventId: id,
      eventName: event.name,
      resolution: "high",
      price: highPrice!,
    });
    toast.success("Foto adicionada ao carrinho!");
  };

  const handleAddVideoToCart = (video: any) => {
    if (!hasVideoPricing) {
      toast.error("Preço do vídeo ainda não configurado pelo fotógrafo.");
      return;
    }
    addItem({
      videoId: video.id,
      photoUrl: videoPosterUrls?.[video.id] || "",
      eventId: id,
      eventName: event.name,
      resolution: "high",
      price: videoPrice!,
    });
    toast.success("Vídeo adicionado ao carrinho!");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16">
        {/* Event Header */}
        <div className="relative h-32 sm:h-40 overflow-hidden">
          <img src={getCoverUrl(event.cover_url, 1600) || "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80"} alt="" decoding="async" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 container mx-auto px-4">
            {event.status === "ativo" && <span className="badge-live mb-2 sm:mb-3">AO VIVO</span>}
            <h1 className="h1 text-foreground mt-2">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-3 body-small text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(event.event_date).toLocaleDateString("pt-BR")}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
              <span className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> {photoList.length} fotos</span>
              {videoList.length > 0 && (
                <span className="flex items-center gap-1"><Film className="w-3 h-3 sm:w-4 sm:h-4" /> {videoList.length} vídeos</span>
              )}
              {photographerSite?.slug && (
                <Link to={`/fotografo/${photographerSite.slug}`} className="text-primary hover:underline">
                  # Evento por {photographerSite.display_name || "Fotógrafo"}
                </Link>
              )}
            </div>
          </div>
          {/* Cart button */}
          <div className="absolute top-4 right-4">
            <CartDrawer />
          </div>
        </div>

        <div className="container mx-auto px-4 py-4 sm:py-8">
          {/* Banner de desconto progressivo */}
          <DiscountBanner
            rules={event.progressive_discount_rules}
            enabled={!!event.progressive_discount_enabled}
          />

          {/* Abas Fotos / Vídeos — troca instantânea, contadores, persistência por evento */}
          <GalleryTabs
            active={activeTab}
            onChange={setActiveTab}
            photoCount={allPhotos.length}
            videoCount={videoList.length}
          />

          {activeTab === "photos" && (
          <>
          {/* Search */}
          <div className="glass-card p-3 sm:p-4 mb-6 sm:mb-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar por número de peito..."
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm py-2 min-w-0"
                value={searchBib}
                onChange={(e) => setSearchBib(e.target.value)}
              />
            </div>
            <button
              onClick={() => setFaceModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/80 transition-all justify-center min-h-[44px]"
            >
              <ScanFace className="w-5 h-5" />
              Reconhecimento Facial
            </button>
            {faceMatchIds && (
              <button
                onClick={() => { setFaceMatchIds(null); setFaceSimilarityById(new Map()); }}
                className="text-xs text-muted-foreground hover:text-foreground underline px-2"
              >
                Limpar busca facial
              </button>
            )}
          </div>

          {faceMatchIds && (
            <div className="mb-4 text-sm text-muted-foreground">
              {faceMatchIds.size === 0
                ? "Nenhuma foto encontrada com este rosto."
                : `${faceMatchIds.size} foto(s) encontrada(s) por reconhecimento facial.`}
            </div>
          )}

          {/* Breadcrumb folder when navegando dentro de uma pasta */}
          {selectedFolder !== null && !trimmedBib && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <button
                onClick={() => setSelectedFolder(null)}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Todas as pastas
              </button>
              <span className="text-muted-foreground">/</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Folder className="w-4 h-4 text-primary" />
                {selectedFolder === "__root__" ? "Geral" : selectedFolder}
              </span>
            </div>
          )}

          {/* Folder hub — exibido apenas quando há pastas e nenhuma busca/pasta selecionada */}
          {showFolderHub && (
            <div className="mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4">Todas as pastas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {folders.map((f) => {
                  const label = f.name === "__root__" ? "Geral" : f.name;
                  return (
                    <button
                      key={f.name}
                      onClick={() => setSelectedFolder(f.name)}
                      className="glass-card p-4 flex items-center gap-3 hover:border-primary/50 hover:shadow-md transition-all text-left min-h-[64px]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Folder className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.count} {f.count === 1 ? "foto" : "fotos"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback da busca por número de peito */}
          {trimmedBib && (
            <div className="mb-4 text-sm text-muted-foreground">
              {!isValidBibQuery ? (
                <span>Digite apenas números (1 a 6 dígitos).</span>
              ) : bibSearching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando fotos com o número {trimmedBib}…
                </span>
              ) : (
                <span>
                  {photoList.length === 0
                    ? `Nenhuma foto encontrada para o número ${trimmedBib}. As fotos podem ainda não ter sido indexadas.`
                    : `${photoList.length} foto(s) encontrada(s) para o número ${trimmedBib}.`}
                </span>
              )}
            </div>
          )}

          {/* Skeleton loading */}
          {!showFolderHub && urlsLoading && photoList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {Array.from({ length: Math.min(photoList.length, 20) }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          )}

          {/* Error state */}
          {urlsError && (
            <div className="text-center py-16">
              <Camera className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
              <p className="text-muted-foreground mb-3">Erro ao carregar imagens. Tente novamente.</p>
              <button
                onClick={() => refetchUrls()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
            </div>
          )}

          {/* Photo Grid with watermarks */}
          {!showFolderHub && !urlsLoading && !urlsError && photoList.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma foto publicada neste evento ainda.</p>
            </div>
          )}

          {!showFolderHub && !urlsLoading && !urlsError && photoList.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                {paginatedPhotos.map((photo: any, idx: number) => {
                  const resolvedUrl = getPhotoUrl(photo);
                  return (
                  <LazyPhotoCard
                    key={photo.id}
                    photoId={photo.id}
                    photoUrl={resolvedUrl}
                    isFav={isFavorite(photo.id)}
                    onToggleFavorite={toggleFavorite}
                    onClick={() => setSelectedPhoto(photo)}
                    priority={idx < 10}
                    blurProtection={blurActive ? blurPattern : null}
                  />
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {page > 1 && (
                      <button
                        onClick={() => goToPage(page - 1)}
                        aria-label="Página anterior"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary/50 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                    {pageNumbers.map((p, i) =>
                      p === "ellipsis" ? (
                        <span key={`e-${i}`} className="px-2 text-muted-foreground">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goToPage(p)}
                          className={`min-w-[44px] min-h-[44px] px-3 rounded-lg border text-sm font-medium transition-colors ${
                            p === page
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border text-foreground hover:bg-secondary/50"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    {page < totalPages && (
                      <button
                        onClick={() => goToPage(page + 1)}
                        aria-label="Próxima página"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary/50 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    Página {page} de {totalPages}
                  </p>
                </div>
              )}
            </>
          )}
          </>
          )}

          {activeTab === "videos" && (
            <div>
              {videoList.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Ainda não há vídeos disponíveis neste evento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {videoList.map((video: any) => {
                    const posterUrl = videoPosterUrls?.[video.id];
                    return (
                      <button
                        key={video.id}
                        onClick={() => setSelectedVideo(video)}
                        className="relative aspect-[3/4] rounded-lg overflow-hidden bg-secondary group text-left"
                      >
                        {posterUrl ? (
                          <img src={posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-8 h-8 text-muted-foreground opacity-40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-2">
                          {hasVideoPricing && (
                            <span className="text-[11px] font-bold text-white bg-primary/90 px-1.5 py-0.5 rounded shadow-md">
                              R$ {videoPrice!.toFixed(2)}
                            </span>
                          )}
                          {video.duration_seconds != null && (
                            <span className="text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded">
                              {Math.floor(video.duration_seconds / 60)}:{Math.round(video.duration_seconds % 60).toString().padStart(2, "0")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {selectedPhoto && createPortal(
        <div
          className="fixed inset-0 z-[100] w-screen h-[100dvh] overflow-hidden bg-background/85 backdrop-blur-md flex flex-col justify-start items-center sm:pt-[5vh] animate-in fade-in duration-150"
          onClick={() => setSelectedPhoto(null)}
        >
          {/* Close button — always visible */}
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-3 right-3 z-30 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full border border-border shadow-md transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="flex flex-col sm:flex-row sm:items-start sm:justify-center w-full h-[100dvh] sm:h-[calc(100vh-5vh)] sm:max-h-[calc(100vh-5vh)] sm:max-w-7xl sm:mx-auto sm:gap-6 sm:px-6 overflow-y-auto sm:overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Image area — shrink-wrap on mobile, no flex-1 */}
            <div
              className="relative flex items-center justify-center p-1 sm:p-2 flex-1 min-h-0"
              onTouchStart={(e) => {
                (e.currentTarget as any)._touchX = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as any)._touchX;
                if (startX == null) return;
                const dx = e.changedTouches[0].clientX - startX;
                if (Math.abs(dx) > 50) {
                  if (dx < 0) goNext();
                  else goPrev();
                }
              }}
            >
              {(() => {
                const imgSrc = mediumUrl || getPhotoUrl(selectedPhoto);
                if (mediumLoading && !imgSrc) {
                  return <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />;
                }
                if (!imgSrc) {
                  return (
                    <div className="text-muted-foreground text-center">
                      <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Não foi possível carregar a imagem</p>
                    </div>
                  );
                }
                return (
                  blurActive ? (
                    <BlurProtectionOverlay
                      pattern={blurPattern}
                      imageUrl={imgSrc}
                      className="max-w-full max-h-[55dvh] sm:max-h-[calc(100vh-10vh)] rounded-lg shadow-2xl"
                      imageClassName="max-w-full max-h-[55dvh] sm:max-h-[calc(100vh-10vh)] object-contain"
                    />
                  ) : (
                   <img
                     src={imgSrc}
                     alt=""
                     className="max-w-full max-h-[55dvh] sm:max-h-[calc(100vh-10vh)] object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                   />
                  )
                );
              })()}
              {/* Prev / Next navigation */}
              {selectedIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  aria-label="Foto anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 min-w-[44px] min-h-[44px] flex items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full border border-border shadow-md transition-all active:scale-90"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {selectedIndex >= 0 && selectedIndex < photoList.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  aria-label="Próxima foto"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 min-w-[44px] min-h-[44px] flex items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full border border-border shadow-md transition-all active:scale-90"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
              {/* Favorite & Share in lightbox */}
              <div className="absolute top-4 left-4 flex gap-2">
                {/* Photo unique code — for support / direct lookup */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(getPhotoCode(selectedPhoto.id));
                    toast.success(`Código copiado: ${getPhotoCode(selectedPhoto.id)}`);
                  }}
                  title="Clique para copiar"
                  className="px-3 h-[44px] flex items-center rounded-full bg-card/90 hover:bg-card border border-border shadow-md text-xs font-mono font-semibold text-foreground/80 cursor-pointer transition-all active:scale-95"
                >
                  ID: {getPhotoCode(selectedPhoto.id)}
                </div>
                <button
                  onClick={() => {
                    const url = `${shareBaseUrl()}/foto/${selectedPhoto.id}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado!");
                  }}
                  className="p-2.5 rounded-full bg-card/90 text-foreground hover:bg-card border border-border shadow-md transition-all active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    const fav = isFavorite(selectedPhoto.id);
                    toggleFavorite(selectedPhoto.id);
                    toast.success(fav ? "Removido dos favoritos" : "Adicionado aos favoritos ❤️");
                  }}
                  className={`p-2.5 rounded-full border shadow-md transition-all active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    isFavorite(selectedPhoto.id)
                      ? "bg-red-500 text-white border-red-500 shadow-red-500/30"
                      : "bg-card/90 text-foreground hover:bg-card border-border"
                  }`}
                >
                  <Heart className={`w-5 h-5 transition-all ${isFavorite(selectedPhoto.id) ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {/* Purchase panel — scrollable on mobile */}
            <div className="w-full sm:w-80 p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl shrink-0 max-h-[40dvh] sm:max-h-[calc(100vh-10vh)] sm:border sm:border-border sm:shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 duration-200">
              <h3 className="font-bold text-foreground text-lg">Foto digital para download</h3>

              <div className="flex items-center justify-between p-4 rounded-xl border border-primary bg-primary/5">
                <span className="text-sm font-medium">Foto original (Alta resolução)</span>
                {hasPricing ? (
                  <span className="text-primary font-bold">R$ {highPrice!.toFixed(2)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Preço não configurado</span>
                )}
              </div>

              <button
                onClick={() => handleAddToCart(selectedPhoto, "high")}
                disabled={!hasPricing}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-5 h-5" />
                + Adicionar ao carrinho
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="flex-1 py-3 rounded-xl border border-primary text-primary font-medium text-sm hover:bg-primary/10 transition-all"
                >
                  Continuar comprando
                </button>
                <button
                  onClick={() => {
                    setSelectedPhoto(null);
                    setTimeout(() => {
                      const cartBtn = document.querySelector('[data-cart-trigger]') as HTMLElement;
                      cartBtn?.click();
                    }, 100);
                  }}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
                >
                  Ir para o carrinho
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center pt-2 leading-relaxed">
                Uso exclusivamente pessoal. Comercialização e divulgação editorial requerem autorização (Lei 9.610/98).
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Video player + purchase */}
      {selectedVideo && createPortal(
        <div
          className="fixed inset-0 z-[100] w-screen h-[100dvh] overflow-hidden bg-background/85 backdrop-blur-md flex flex-col justify-start items-center sm:pt-[5vh] animate-in fade-in duration-150"
          onClick={() => setSelectedVideo(null)}
        >
          <button
            onClick={() => setSelectedVideo(null)}
            className="absolute top-3 right-3 z-30 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full border border-border shadow-md transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="flex flex-col sm:flex-row sm:items-start sm:justify-center w-full h-[100dvh] sm:h-[calc(100vh-5vh)] sm:max-h-[calc(100vh-5vh)] sm:max-w-7xl sm:mx-auto sm:gap-6 sm:px-6 overflow-y-auto sm:overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center p-1 sm:p-2 flex-1 min-h-0">
              {videoPreviewLoading || !selectedVideoPreviewUrl ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Carregando prévia...</p>
                </div>
              ) : (
                <video
                  src={selectedVideoPreviewUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-[55dvh] sm:max-h-[calc(100vh-10vh)] rounded-lg shadow-2xl bg-black animate-in fade-in zoom-in-95 duration-200"
                />
              )}
            </div>

            <div className="w-full sm:w-80 p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl shrink-0 max-h-[40dvh] sm:max-h-[calc(100vh-10vh)] sm:border sm:border-border sm:shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 duration-200">
              <h3 className="font-bold text-foreground text-lg">Vídeo digital para download</h3>
              <p className="text-xs text-muted-foreground -mt-2">
                Prévia com marca d'água. O arquivo original (sem marca d'água) é liberado após a compra.
              </p>

              <div className="flex items-center justify-between p-4 rounded-xl border border-primary bg-primary/5">
                <div className="flex items-center gap-3">
                  <Film className="w-5 h-5 text-primary" />
                  <span className="text-sm">Vídeo original</span>
                </div>
                {hasVideoPricing ? (
                  <span className="text-primary font-bold">R$ {videoPrice!.toFixed(2)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Preço não configurado</span>
                )}
              </div>

              <button
                onClick={() => handleAddVideoToCart(selectedVideo)}
                disabled={!hasVideoPricing}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-5 h-5" />
                + Adicionar ao carrinho
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="flex-1 py-3 rounded-xl border border-primary text-primary font-medium text-sm hover:bg-primary/10 transition-all"
                >
                  Continuar comprando
                </button>
                <button
                  onClick={() => {
                    setSelectedVideo(null);
                    setTimeout(() => {
                      const cartBtn = document.querySelector('[data-cart-trigger]') as HTMLElement;
                      cartBtn?.click();
                    }, 100);
                  }}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
                >
                  Ir para o carrinho
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center pt-2 leading-relaxed">
                Uso exclusivamente pessoal. Comercialização e divulgação editorial requerem autorização (Lei 9.610/98).
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Footer />
      {id && (
        <FaceSearchModal
          eventId={id}
          open={faceModalOpen}
          onClose={() => setFaceModalOpen(false)}
          onResults={(ids, matches) => {
            setFaceMatchIds(new Set(ids));
            const m = new Map<string, number>();
            matches.forEach((x) => m.set(x.photo_id, x.similarity));
            setFaceSimilarityById(m);
            setSelectedFolder(null);
            setSearchBib("");
            trackFunnelEvent({
              event_type: "search_performed",
              search_kind: "facial",
              event_id: id,
              has_results: ids.length > 0,
              results_count: ids.length,
              dedupeKey: `face:${id}:${Date.now()}`,
            });
          }}
        />
      )}
    </div>
  );
};

export default EventPage;
