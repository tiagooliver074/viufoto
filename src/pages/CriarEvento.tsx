import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Check, ChevronRight, ScanFace, Image, Eye, Camera, MapPin, AlertCircle, Info, Wallet, Users, Split, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const steps = ["Monetização", "Informações", "Busca", "Visibilidade", "Resumo"];

const COMMISSION_RATE = 0.10; // 10% fixos
const DEFAULT_SIM_PRICE = 15;
const MIN_PHOTO_PRICE = 3;
const DEFAULT_VIDEO_PRICE = 15;

const categories = [
  "Corrida", "Ciclismo", "Triathlon", "Natação", "Futebol", "Futsal", "Vôlei", "Basquete",
  "Handball", "Tênis", "CrossFit", "Jiu-Jitsu", "Muay Thai", "Boxe", "Surf", "Skate",
  "Montanhismo", "Trail Run", "Caminhada", "Yoga", "Dança", "Evento Social", "Formatura",
  "Casamento", "Aniversário", "Corporativo", "Outro",
];

interface CidadeSugestao {
  id: number;
  nome: string;
  uf: string;
  nome_completo: string;
}

interface EnderecoSugestao {
  id: number;
  cidade_id: number;
  nome_completo: string;
  localidade: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
}

const searchTypes = [
  { key: "facial", label: "Reconhecimento Facial", icon: ScanFace, desc: "IA identifica rostos automaticamente" },
  { key: "album", label: "Álbum", icon: Image, desc: "Organize por pastas e jogos" },
  { key: "numero", label: "Número de Peito", icon: Eye, desc: "OCR lê números dos atletas" },
  { key: "sem", label: "Sem busca", icon: Camera, desc: "Galeria simples sem filtro" },
];

const CriarEvento = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // Monetização — quanto da comissão de 10% o CLIENTE absorve (0 a 10)
  const [clientShare, setClientShare] = useState<number>(0);
  const [simPrice, setSimPrice] = useState<number>(DEFAULT_SIM_PRICE);

  // Form fields
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [selectedCidadeId, setSelectedCidadeId] = useState<number | null>(null);
  const [streetAddress, setStreetAddress] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);
  const [streetSuggestionsList, setStreetSuggestionsList] = useState<EnderecoSugestao[]>([]);
  const [eventCategory, setEventCategory] = useState("");
  const [selectedSearchTypes, setSelectedSearchTypes] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<boolean | null>(null);
  const [coletivoId, setColetivoId] = useState<string | null>(null);
  const [priorityDate, setPriorityDate] = useState("");
  const [priorityTime, setPriorityTime] = useState("");
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestionsList, setLocationSuggestionsList] = useState<CidadeSugestao[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const { data: meusColetivos = [] } = useQuery({
    queryKey: ["my-coletivos-eligible"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // Um fotógrafo pode vincular evento a um coletivo se for DONO ou MEMBRO ATIVO
      const { data: asOwner } = await supabase.from("coletivos").select("id, name").eq("owner_id", user.id);
      const { data: asMember } = await supabase
        .from("coletivo_members")
        .select("coletivo:coletivos(id, name)")
        .eq("user_id", user.id)
        .eq("status", "ativo");
      
      const ownerList = asOwner || [];
      const memberList = (asMember || []).map((m: any) => m.coletivo).filter(Boolean);
      
      // Deduplicar e formatar
      const combined = [...ownerList, ...memberList];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
      
      return unique;
    }
  });

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Busca cidades brasileiras via RPC (base própria do ViuFoto, sem Google Maps
  // e sem custo por consulta), com debounce para evitar excesso de chamadas.
  useEffect(() => {
    const termo = eventLocation.trim();
    if (termo.length < 2) {
      setLocationSuggestionsList([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const { data, error } = await supabase.rpc("buscar_cidades", { termo, limite: 8 });
      if (error) {
        console.error("Erro ao buscar cidades:", error);
        return;
      }
      setLocationSuggestionsList((data as CidadeSugestao[]) || []);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [eventLocation]);

  // Busca ruas/logradouros (Fase 2 — dados IBGE CNEFE) escopada pela cidade já escolhida.
  useEffect(() => {
    if (!selectedCidadeId) {
      setStreetSuggestionsList([]);
      return;
    }
    const termo = streetAddress.trim();
    if (termo.length < 2) {
      setStreetSuggestionsList([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const { data, error } = await supabase.rpc("buscar_enderecos", {
        cidade_id_param: selectedCidadeId,
        termo,
        limite: 8,
      });
      if (error) {
        console.error("Erro ao buscar endereços:", error);
        return;
      }
      setStreetSuggestionsList((data as EnderecoSugestao[]) || []);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [streetAddress, selectedCidadeId]);

  const filteredCategories = categories.filter((c) =>
    c.toLowerCase().includes((categorySearch || eventCategory).toLowerCase())
  );

  const toggleSearchType = (key: string) => {
    setSelectedSearchTypes((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (key === "sem") return ["sem"];
      const without = prev.filter((k) => k !== "sem");
      if (without.length >= 2) return without;
      return [...without, key];
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (clientShare < 0 || clientShare > 10) {
        toast.error("Divisão da comissão inválida");
        return false;
      }
    }

    if (step === 1) {
      if (!eventName.trim()) newErrors.eventName = "Nome do evento é obrigatório";
      if (!eventDate) newErrors.eventDate = "Data é obrigatória";
      if (!eventTime) newErrors.eventTime = "Horário é obrigatório";
      if (!eventLocation.trim()) newErrors.eventLocation = "Local é obrigatório";
      if (!eventCategory) newErrors.eventCategory = "Categoria é obrigatória";
    }

    if (step === 2 && selectedSearchTypes.length === 0) {
      toast.error("Selecione pelo menos um tipo de busca");
      return false;
    }

    if (step === 3 && visibility === null) {
      toast.error("Defina a visibilidade do evento");
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateEvent = async () => {
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para criar um evento");
        setIsCreating(false);
        return;
      }

      const priorityUntil = priorityDate && priorityTime ? `${priorityDate}T${priorityTime}:00` : null;
      const { data, error } = await supabase.from("events").insert({
        organizer_id: user.id,
        name: eventName,
        event_date: eventDate,
        event_time: eventTime || null,
        location: eventLocation,
        street_address: streetAddress.trim() || null,
        reference_point: referencePoint.trim() || null,
        category: eventCategory,
        search_type: selectedSearchTypes,
        visibility: visibility ?? true,
        plan_type: "profissional",
        commission_photographer_share: 10 - clientShare,
        commission_client_share: clientShare,
        coletivo_id: coletivoId,
        coletivo_priority_until: priorityUntil,
      } as any).select().single();

      if (error) throw error;

      // Grade padrão: foto = simPrice (mín R$ 3,00); vídeo = R$ 15,00 (sugerido fixo, editável na grade)
      const highPrice = Math.max(MIN_PHOTO_PRICE, Number(simPrice) || DEFAULT_SIM_PRICE);
      const videoPrice = DEFAULT_VIDEO_PRICE;
      await supabase.from("price_grids").insert({
        event_id: data.id,
        name: "Padrão",
        photo_high_price: highPrice,
        photo_low_price: highPrice, // compat: mesmo valor da foto original
        video_price: videoPrice,
      });

      toast.success("Evento criado com sucesso! 🎉");
      navigate(`/dashboard/evento/${data.id}`);
    } catch (err: any) {
      toast.error("Erro ao criar evento: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-8 overflow-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Criar novo evento</h1>
        <p className="text-sm text-muted-foreground mb-6 sm:mb-8">Insira abaixo as informações para criar seu evento.</p>

        {/* Progress */}
        <div className="flex items-center gap-1 sm:gap-2 mb-8 sm:mb-10 overflow-x-auto pb-2 scrollbar-hide">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div
                onClick={() => i < currentStep && setCurrentStep(i)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < currentStep ? "bg-primary text-primary-foreground cursor-pointer" :
                  i === currentStep ? "bg-primary text-primary-foreground animate-glow-pulse" :
                  "bg-secondary text-muted-foreground"
                }`}
              >
                {i < currentStep ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${i === currentStep ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 0: Monetização */}
        {currentStep === 0 && (() => {
          const photographerShare = 10 - clientShare;
          const commissionValue = simPrice * COMMISSION_RATE;
          const photographerAbsorbs = commissionValue * (photographerShare / 10);
          const clientAbsorbs = commissionValue * (clientShare / 10);
          const buyerPays = simPrice + clientAbsorbs;
          const photographerReceives = simPrice - photographerAbsorbs;
          const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

          const feedback =
            clientShare === 0
              ? "Você está absorvendo toda a comissão. Isso torna o preço mais competitivo para seus clientes."
              : clientShare === 10
              ? "Você está repassando toda a comissão ao comprador. Você preserva integralmente sua margem."
              : "Divisão equilibrada — você mantém parte da margem e oferece preço competitivo.";

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
              {/* Coluna esquerda — configuração */}
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">Monetização do Evento</h2>
                  <p className="text-sm text-muted-foreground">
                    A ViuFoto possui uma comissão fixa de <span className="font-semibold text-foreground">10%</span> sobre cada venda. Defina como ela será dividida entre você e o comprador.
                  </p>
                </div>

                {/* Atalhos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Eu absorvo tudo", icon: Wallet, val: 0 },
                    { label: "Dividir igualmente", icon: Split, val: 5 },
                    { label: "Repassar ao cliente", icon: Users, val: 10 },
                  ].map((opt) => {
                    const active = clientShare === opt.val;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setClientShare(opt.val)}
                        className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-xs sm:text-sm font-medium transition-all min-h-[48px] ${
                          active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Slider */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Quanto o cliente absorve da comissão</label>
                    <span className="text-base font-bold text-primary">{clientShare.toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={clientShare}
                    onChange={(e) => setClientShare(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>10%</span>
                  </div>
                </div>

                {/* Cards de divisão */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Você absorve</p>
                    <p className="text-2xl font-bold text-foreground">{photographerShare.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Cliente absorve</p>
                    <p className="text-2xl font-bold text-foreground">{clientShare.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Feedback */}
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
                  <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-foreground">{feedback}</p>
                </div>
              </div>

              {/* Coluna direita — Simulação */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Simulação financeira</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Este valor será usado como preço da foto na grade padrão do evento. Mínimo R$ 3,00.{" "}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Preço da foto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <input
                        type="number"
                        min={MIN_PHOTO_PRICE}
                        step={0.5}
                        value={simPrice}
                        onChange={(e) => setSimPrice(parseFloat(e.target.value) || 0)}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          if (v < MIN_PHOTO_PRICE) {
                            toast.error(`Preço mínimo da foto é R$ ${MIN_PHOTO_PRICE.toFixed(2).replace(".", ",")}.`);
                            setSimPrice(MIN_PHOTO_PRICE);
                          }
                        }}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    {simPrice < MIN_PHOTO_PRICE && (
                      <p className="text-[11px] text-destructive mt-1">Valor mínimo: R$ {MIN_PHOTO_PRICE.toFixed(2).replace(".", ",")}.</p>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Preço da foto</span><span className="font-medium text-foreground">{fmt(simPrice)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Preço do vídeo (sugerido)</span><span className="font-medium text-foreground">{fmt(DEFAULT_VIDEO_PRICE)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Comissão ViuFoto (10%)</span><span className="font-medium text-foreground">{fmt(commissionValue)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Você absorve</span><span className="font-medium text-foreground">{fmt(photographerAbsorbs)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Repasse ao cliente</span><span className="font-medium text-foreground">{fmt(clientAbsorbs)}</span></div>
                  </div>

                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Comprador paga</span>
                      <span className="text-sm font-bold text-foreground">{fmt(buyerPays)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Você recebe</span>
                      <span className="text-base font-bold text-primary">{fmt(photographerReceives)}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                    Já considera 10% de comissão da plataforma + taxa do gateway.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Step 1: Info */}
        {currentStep === 1 && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-4">Informações básicas</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nome do evento *</label>
              <input
                type="text"
                placeholder="Ex: VERÃO RUN 2026"
                value={eventName}
                onChange={(e) => { setEventName(e.target.value); setErrors((p) => ({ ...p, eventName: "" })); }}
                className={`w-full px-4 py-3 rounded-lg bg-secondary border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm min-h-[48px] ${errors.eventName ? "border-red-500" : "border-border"}`}
              />
              {errors.eventName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.eventName}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Data do evento *</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => { setEventDate(e.target.value); setErrors((p) => ({ ...p, eventDate: "" })); }}
                  className={`w-full px-4 py-3 rounded-lg bg-secondary border text-foreground outline-none focus:border-primary transition-colors text-sm min-h-[48px] ${errors.eventDate ? "border-red-500" : "border-border"}`}
                />
                {errors.eventDate && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.eventDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Horário *</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => { setEventTime(e.target.value); setErrors((p) => ({ ...p, eventTime: "" })); }}
                  className={`w-full px-4 py-3 rounded-lg bg-secondary border text-foreground outline-none focus:border-primary transition-colors text-sm min-h-[48px] ${errors.eventTime ? "border-red-500" : "border-border"}`}
                />
                {errors.eventTime && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.eventTime}</p>}
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-1.5">Local do evento *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Digite a cidade do evento"
                  value={eventLocation}
                  onChange={(e) => {
                    setEventLocation(e.target.value);
                    setShowLocationSuggestions(true);
                    setErrors((p) => ({ ...p, eventLocation: "" }));
                    // Cidade mudou manualmente: a rua selecionada antes não vale mais para a nova cidade.
                    setSelectedCidadeId(null);
                    setStreetAddress("");
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg bg-secondary border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm min-h-[48px] ${errors.eventLocation ? "border-red-500" : "border-border"}`}
                />
              </div>
              {showLocationSuggestions && locationSuggestionsList.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-lg bg-secondary border border-border shadow-xl overflow-hidden">
                  {locationSuggestionsList.map((cidade) => (
                    <button
                      key={cidade.id}
                      onMouseDown={() => {
                        setEventLocation(cidade.nome_completo);
                        setSelectedCidadeId(cidade.id);
                        setStreetAddress("");
                        setShowLocationSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-2"
                    >
                      <MapPin className="w-3 h-3 text-primary" />
                      {cidade.nome_completo}
                    </button>
                  ))}
                </div>
              )}
              {errors.eventLocation && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.eventLocation}</p>}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Rua / endereço <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={selectedCidadeId ? "Digite o nome da rua" : "Selecione a cidade acima primeiro"}
                  value={streetAddress}
                  disabled={!selectedCidadeId}
                  onChange={(e) => { setStreetAddress(e.target.value); setShowStreetSuggestions(true); }}
                  onFocus={() => setShowStreetSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowStreetSuggestions(false), 200)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              {showStreetSuggestions && streetSuggestionsList.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-lg bg-secondary border border-border shadow-xl overflow-hidden">
                  {streetSuggestionsList.map((rua) => (
                    <button
                      key={rua.id}
                      onMouseDown={() => { setStreetAddress(rua.nome_completo); setShowStreetSuggestions(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-2"
                    >
                      <MapPin className="w-3 h-3 text-primary" />
                      <span>
                        {rua.nome_completo}
                        {rua.localidade && <span className="text-muted-foreground"> — {rua.localidade}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Ponto de referência <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Ginásio de Esportes, Praça Central, Clube X..."
                value={referencePoint}
                onChange={(e) => setReferencePoint(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm min-h-[48px]"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-1.5">Categoria *</label>
              <input
                type="text"
                placeholder="Selecione ou digite a categoria"
                value={eventCategory}
                onChange={(e) => { setEventCategory(e.target.value); setCategorySearch(e.target.value); setShowCategoryDropdown(true); setErrors((p) => ({ ...p, eventCategory: "" })); }}
                onFocus={() => setShowCategoryDropdown(true)}
                onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                className={`w-full px-4 py-3 rounded-lg bg-secondary border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm min-h-[48px] ${errors.eventCategory ? "border-red-500" : "border-border"}`}
              />
              {showCategoryDropdown && filteredCategories.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-lg bg-secondary border border-border shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat}
                      onMouseDown={() => { setEventCategory(cat); setCategorySearch(""); setShowCategoryDropdown(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-primary/10 transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              {errors.eventCategory && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.eventCategory}</p>}
            </div>
          </div>
        )}

        {/* Step 2: Search Types */}
        {currentStep === 2 && (
          <div className="max-w-2xl">
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-2">Tipos de busca no evento</h2>
            <p className="text-sm text-muted-foreground mb-6">Selecione até 2 tipos de busca para os participantes encontrarem suas fotos.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {searchTypes.map((opt) => {
                const selected = selectedSearchTypes.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleSearchType(opt.key)}
                    className={`glass-card p-4 sm:p-6 flex flex-col items-center gap-2 sm:gap-3 transition-all text-center min-h-[100px] ${
                      selected ? "border-primary neon-border" : "hover:border-primary/30"
                    }`}
                  >
                    <opt.icon className={`w-6 h-6 sm:w-8 sm:h-8 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-[11px] sm:text-xs font-medium text-foreground leading-tight">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">{opt.desc}</span>
                    {selected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Visibility */}
        {currentStep === 3 && (
          <div className="max-w-2xl">
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-4">Visibilidade</h2>
            <div className="glass-card p-5 sm:p-6">
              <p className="text-sm text-muted-foreground mb-4">Deseja que seu evento seja visualizado no marketplace da VIUFOTO?</p>
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  onClick={() => setVisibility(true)}
                  className={`px-6 py-3 rounded-lg font-bold text-sm min-h-[48px] min-w-[80px] transition-all ${
                    visibility === true ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sim
                </button>
                <button
                  onClick={() => setVisibility(false)}
                  className={`px-6 py-3 rounded-lg font-bold text-sm min-h-[48px] min-w-[80px] transition-all ${
                    visibility === false ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Não
                </button>
              </div>
              {visibility !== null && (
                <p className="text-xs text-muted-foreground mt-3">
                  {visibility
                    ? "✅ Seu evento será exibido na Home e no Marketplace para todos os visitantes."
                    : "🔒 Seu evento ficará oculto. Somente pessoas com o link direto poderão acessá-lo."}
                </p>
              )}
            </div>

            {/* Coletivo Priority (opcional) */}
            <div className="glass-card p-5 sm:p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground text-sm sm:text-base">Coletivo (Opcional)</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Vincular a um coletivo</label>
                  <select 
                    value={coletivoId || ""} 
                    onChange={(e) => setColetivoId(e.target.value || null)}
                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground outline-none focus:border-primary text-sm min-h-[48px]"
                  >
                    <option value="">Nenhum coletivo</option>
                    {meusColetivos.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {coletivoId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Prioridade até (Data)</label>
                      <input 
                        type="date" 
                        value={priorityDate} 
                        onChange={(e) => setPriorityDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-sm min-h-[48px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Prioridade até (Hora)</label>
                      <input 
                        type="time" 
                        value={priorityTime} 
                        onChange={(e) => setPriorityTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-sm min-h-[48px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {currentStep === 4 && (
          <div className="max-w-2xl">
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-4">Resumo do evento</h2>
            <p className="text-sm text-muted-foreground mb-6">Confira as informações antes de criar seu evento.</p>
            <div className="glass-card p-5 sm:p-6 space-y-4">
              {[
                { label: "Plano", value: "ViuFoto Profissional (10%)" },
                { label: "Comissão", value: `Você absorve ${(10 - clientShare).toFixed(1)}% · Cliente absorve ${clientShare.toFixed(1)}%` },
                { label: "Nome", value: eventName },
                { label: "Data", value: eventDate ? new Date(eventDate + "T12:00:00").toLocaleDateString("pt-BR") : "" },
                { label: "Horário", value: eventTime },
                { label: "Local", value: eventLocation },
                ...(streetAddress ? [{ label: "Rua", value: streetAddress }] : []),
                ...(referencePoint ? [{ label: "Ponto de referência", value: referencePoint }] : []),
                { label: "Categoria", value: eventCategory },
                { label: "Busca", value: selectedSearchTypes.map((k) => searchTypes.find((s) => s.key === k)?.label).join(", ") },
                { label: "Visibilidade", value: visibility ? "Público (marketplace)" : "Privado (apenas link)" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium text-foreground text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 sm:mt-10 pt-6 border-t border-border gap-3">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            className={`px-4 sm:px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-all min-h-[44px] ${currentStep === 0 ? "opacity-50 pointer-events-none" : ""}`}
          >
            Voltar
          </button>
          <button
            onClick={currentStep === steps.length - 1 ? handleCreateEvent : handleNext}
            disabled={isCreating}
            className="px-4 sm:px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all min-h-[44px] disabled:opacity-50"
          >
            {isCreating ? "Criando..." : currentStep === steps.length - 1 ? "🚀 Criar Evento" : "Próximo"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default CriarEvento;
