import { Search, ScanFace, Users } from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import heroRunners from "@/assets/hero-runners.jpg";
import { supabase } from "@/integrations/supabase/client";
import { cdnUrl } from "@/lib/cdnConfig";
import { getSignedReadUrls } from "@/hooks/useS3Upload";

type SlideMedia = {
  url: string;
  type: "image" | "video";
  poster?: string;
};

interface HeroSettings {
  title: string;
  highlight: string;
  title_color: string;
  highlight_color: string;
  transition_type: string;
  transition_duration_ms: number;
  interval_seconds: number;
  autoplay: boolean;
}

const DEFAULT_SETTINGS: HeroSettings = {
  title: "Sua superação imortalizada",
  highlight: "em alta definição.",
  title_color: "#111827",
  highlight_color: "#673DE6",
  transition_type: "fade",
  transition_duration_ms: 1000,
  interval_seconds: 6,
  autoplay: true,
};

// Pequeno texto de contexto acima do título — reaproveita a frase padrão do
// sistema (DEFAULT_SETTINGS.title) como "kicker", em vez de inventar um texto novo.
const EYEBROW_TEXT = DEFAULT_SETTINGS.title;

const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"text" | "face">("text");
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_SETTINGS);
  const [slides, setSlides] = useState<SlideMedia[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Load hero settings + slides
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [s, sl] = await Promise.all([
          supabase.from("hero_settings").select("*").limit(1).maybeSingle(),
          supabase
            .from("hero_slides")
            .select("image_path, media_type, poster_path")
            .eq("active", true)
            .order("sort_order", { ascending: true }),
        ]);
        if (cancelled) return;
        if (s.data) setSettings(s.data as any);
        if (sl.data) {
          const rows = sl.data as any[];
          const allPaths: string[] = [];
          rows.forEach((r) => {
            if (r.image_path) allPaths.push(r.image_path);
            if (r.poster_path) allPaths.push(r.poster_path);
          });
          const cdnMap: Record<string, string | null> = {};
          allPaths.forEach((p) => (cdnMap[p] = cdnUrl(p)));
          const needsSigning = allPaths.filter((p) => !cdnMap[p]);
          let signedMap: Record<string, string> = {};
          if (needsSigning.length > 0) {
            try {
              signedMap = await getSignedReadUrls(needsSigning);
            } catch (e) {
              console.warn("[Hero] Falha ao assinar URLs dos slides:", e);
            }
          }
          const resolve = (p?: string | null) =>
            p ? cdnMap[p] || signedMap[p] || null : null;
          const media: SlideMedia[] = rows
            .map((r): SlideMedia | null => {
              const url = resolve(r.image_path);
              if (!url) return null;
              const poster = resolve(r.poster_path);
              return {
                url,
                type: r.media_type === "video" ? "video" : "image",
                ...(poster ? { poster } : {}),
              };
            })
            .filter((m): m is SlideMedia => m !== null);
          setSlides(media);
        }
      } catch (err) {
        console.error("Hero load error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Autoplay rotation
  useEffect(() => {
    if (!settings.autoplay || slides.length <= 1) return;
    const id = setInterval(() => {
      setCurrentSlide((c) => (c + 1) % slides.length);
    }, Math.max(2, settings.interval_seconds) * 1000);
    return () => clearInterval(id);
  }, [settings.autoplay, settings.interval_seconds, slides.length]);

  const handleSearch = (e?: FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
  };

  const transitionMs = settings.transition_duration_ms;
  const slidesToRender: SlideMedia[] =
    slides.length > 0 ? slides : [{ url: heroRunners, type: "image" }];

  const renderMedia = (m: SlideMedia, i: number, isActive: boolean, opts?: { eager?: boolean }) => {
    if (m.type === "video") {
      return (
        <video
          key={m.url + i}
          src={m.url}
          poster={m.poster}
          autoPlay
          muted
          loop={slidesToRender.length === 1}
          playsInline
          preload="metadata"
          onEnded={() => {
            if (slidesToRender.length > 1) {
              setCurrentSlide((c) => (c + 1) % slidesToRender.length);
            }
          }}
          className="absolute inset-0 w-full h-full object-cover transition-opacity ease-out"
          style={{ transitionDuration: `${transitionMs}ms`, opacity: isActive ? 1 : 0 }}
        />
      );
    }
    return (
      <img
        key={m.url + i}
        src={m.url}
        alt="Atletas em corrida"
        loading={opts?.eager ? "eager" : "lazy"}
        fetchPriority={opts?.eager ? "high" : "low"}
        className="absolute inset-0 w-full h-full object-cover transition-opacity ease-out"
        style={{ transitionDuration: `${transitionMs}ms`, opacity: isActive ? 1 : 0 }}
        width={1920}
        height={1080}
      />
    );
  };

  return (
    <section className="relative bg-background overflow-hidden min-h-[560px] sm:min-h-[640px] lg:min-h-[760px]">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-end bg-background">
          <div className="container mx-auto px-4 pb-32 sm:pb-40">
            <div className="max-w-xl space-y-5">
              <div className="h-5 w-40 bg-muted animate-pulse rounded-full" />
              <div className="h-14 w-full bg-muted animate-pulse rounded-2xl" />
              <div className="h-14 w-3/4 bg-muted animate-pulse rounded-2xl" />
              <div className="h-16 w-full bg-muted animate-pulse rounded-2xl mt-4" />
            </div>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={!isLoading ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
        className="relative w-full h-full"
      >
        {/* Fotografia ocupa o Hero inteiro — protagonista, sem camada escura por cima */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-0 overflow-hidden"
        >
          {/* Camada com leve "Ken Burns": zoom e deslocamento bem sutis e contínuos,
              para a foto não ficar estática. */}
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.03, x: 0 }}
            animate={{ scale: [1.03, 1.09, 1.03], x: [0, -16, 0] }}
            transition={{ duration: 26, ease: "easeInOut", repeat: Infinity }}
          >
            {slidesToRender.map((m, i) => {
              const isActive = i === currentSlide % slidesToRender.length;
              return renderMedia(m, i, isActive, { eager: i === 0 });
            })}
          </motion.div>

          {/* Efeito sutil de "leitura"/reconhecimento facial — puramente decorativo,
              sugere a busca por reconhecimento facial do app. Oculto em telas pequenas. */}
          <div
            aria-hidden
            className="hidden sm:block absolute z-[2] pointer-events-none"
            style={{ right: "16%", top: "20%", width: "170px", height: "220px" }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={mounted ? { opacity: 0.4 } : {}}
              transition={{ duration: 1.4, delay: 1.1 }}
              className="absolute inset-0"
            >
              {[
                "top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
                "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
                "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
                "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md",
              ].map((cls, i) => (
                <span
                  key={i}
                  className={`absolute w-4 h-4 ${cls}`}
                  style={{ borderColor: "rgba(166,255,214,0.8)" }}
                />
              ))}
            </motion.div>

            <motion.div
              initial={{ top: "0%", opacity: 0 }}
              animate={
                mounted
                  ? { top: ["0%", "96%", "0%"], opacity: [0, 0.75, 0.75, 0] }
                  : {}
              }
              transition={{
                duration: 3.8,
                repeat: Infinity,
                repeatDelay: 1.8,
                ease: "easeInOut",
                delay: 1.6,
              }}
              className="absolute left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(166,255,214,0.9), transparent)",
                boxShadow: "0 0 8px rgba(166,255,214,0.6)",
              }}
            />

            {[
              { left: "26%", top: "32%" },
              { left: "66%", top: "32%" },
              { left: "46%", top: "66%" },
            ].map((pos, i) => (
              <motion.span
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  ...pos,
                  background: "rgba(214,255,235,0.95)",
                  boxShadow: "0 0 6px rgba(166,255,214,0.8)",
                }}
                initial={{ opacity: 0.2, scale: 0.8 }}
                animate={
                  mounted ? { opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] } : {}
                }
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: 1.8 + i * 0.3,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Legibilidade localizada: um degradê suave e curto, só atrás do texto
              (canto superior-esquerdo), nada de camada escura sobre a foto inteira. */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(118deg, rgba(8,8,14,0.72) 0%, rgba(8,8,14,0.5) 22%, rgba(8,8,14,0.2) 42%, transparent 58%)",
            }}
          />
          {/* Transição bem sutil na base, só para a faixa de benefícios "flutuar" por cima */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(8,8,14,0.4) 0%, transparent 100%)",
            }}
          />
        </motion.div>

        {/* Selo de prova social flutuando sobre a foto */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
          className="hidden sm:flex absolute bottom-28 sm:bottom-36 right-6 lg:right-10 z-10 items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-md border border-white/20"
          style={{ background: "hsla(256, 76%, 57%, 0.55)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="text-white leading-tight">
            <div className="font-black text-sm sm:text-base">+2 milhões</div>
            <div className="text-[11px] sm:text-xs text-white/85">
              de fotos entregues
              <br />
              em todo o Brasil
            </div>
          </div>
        </motion.div>

        {/* Conteúdo: texto + busca, sobre a área naturalmente mais escura da foto */}
        <div className="relative z-10 container mx-auto px-4 pt-28 sm:pt-32 lg:pt-36 pb-32 sm:pb-44">
          <div className="max-w-xl">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="caption font-bold uppercase tracking-[0.18em] text-white/80 mb-3"
              style={{ textShadow: "0 1px 12px rgba(0,0,0,0.45)" }}
            >
              {EYEBROW_TEXT}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
              className="display-title mb-5 text-white"
              style={{ textShadow: "0 4px 28px rgba(0,0,0,0.5)" }}
            >
              {(() => {
                const words = (settings.title || "").split(/\s+/).filter(Boolean);
                return words.map((w, i) => (
                  <span key={i}>
                    {w}
                    {i < words.length - 1 ? (
                      <>
                        {i === 2 ? <br className="sm:hidden" aria-hidden /> : null}
                        {" "}
                      </>
                    ) : null}
                  </span>
                ));
              })()}
              <br className="sm:hidden" aria-hidden />
              <span className="hidden sm:inline"> </span>
              <span style={{ color: settings.highlight_color }}>{settings.highlight}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
              className="body-base text-white/90 max-w-md mb-8"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.45)" }}
            >
              Mostre seu rosto ou digite seu número de peito. Nossa inteligência
              artificial encontra todas as suas fotos automaticamente e entrega em alta resolução.
            </motion.p>

            <motion.form
              onSubmit={handleSearch}
              initial={{ opacity: 0, y: 18 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.24 }}
              className="max-w-xl"
            >
              <div className="bg-card border border-border rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.45)] p-1.5 sm:p-2 flex items-center gap-1 sm:gap-2">
                <div className="flex items-center gap-0.5 sm:gap-1 pl-1 sm:pl-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSearchMode("text")}
                    aria-label="Buscar por texto"
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      searchMode === "text"
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    }`}
                  >
                    <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode("face")}
                    aria-label="Buscar por reconhecimento facial"
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      searchMode === "face"
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    }`}
                  >
                    <ScanFace className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={
                    searchMode === "text"
                      ? "Digite o nome do evento..."
                      : "Envie sua selfie..."
                  }
                  className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none body-base py-2.5 sm:py-3 px-2"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-cta text-cta-foreground font-bold text-sm min-h-[44px] shrink-0 hover:bg-cta-dark hover:text-cta-foreground transition-colors shadow-[0_8px_20px_-6px_hsl(var(--cta)/0.55)]"
                >
                  Buscar
                </button>
              </div>
              <p
                className="caption text-white/80 mt-3 ml-1 whitespace-pre-line"
                style={{ textShadow: "0 1px 10px rgba(0,0,0,0.4)" }}
              >
                Grátis para buscar e visualizar - você só paga o que quiser baixar.{"\n"}
                Não sabe o nome do evento?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/buscar")}
                  className="text-white font-semibold underline underline-offset-2 hover:text-white/80"
                >
                  Clique aqui
                </button>
              </p>
            </motion.form>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
