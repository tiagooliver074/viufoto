import { useEffect, useMemo, useState } from "react";
import { X, Info, Plus, Trash2, Copy, ShieldCheck, Sparkles } from "lucide-react";
import { computeBreakdown, describeStrategy, formatBRL } from "@/lib/commissionMath";

interface PriceGrid {
  id?: string;
  name: string;
  photo_high_price: number;
  photo_low_price: number;
  video_price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (grid: PriceGrid) => void;
  onDelete?: (id: string) => void;
  isSaving: boolean;
  grids?: PriceGrid[];
  photographerShare?: number;
  clientShare?: number;
}

const MIN_PHOTO_PRICE = 5; // piso do Asaas para PIX e cartão
const MIN_VIDEO_PRICE = 10;
const DEFAULT_PHOTO_PRICE = 15;
const DEFAULT_VIDEO_PRICE = 15;
const EMPTY: PriceGrid = {
  name: "",
  photo_high_price: DEFAULT_PHOTO_PRICE,
  photo_low_price: DEFAULT_PHOTO_PRICE,
  video_price: DEFAULT_VIDEO_PRICE,
};

export default function PriceGridModal({
  open,
  onClose,
  onSave,
  onDelete,
  isSaving,
  grids = [],
  photographerShare = 10,
  clientShare = 0,
}: Props) {
  const [grid, setGrid] = useState<PriceGrid>(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (grids.length > 0) setGrid({ ...grids[0] });
    else setGrid({ ...EMPTY, name: "Padrão" });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const strategy = useMemo(
    () => describeStrategy(photographerShare, clientShare),
    [photographerShare, clientShare],
  );

  if (!open) return null;

  const selectGrid = (g: PriceGrid) => setGrid({ ...g });
  const newPreset = () =>
    setGrid({ ...EMPTY, name: `Preset ${grids.length + 1}` });
  const duplicate = () =>
    setGrid({ ...grid, id: undefined, name: `${grid.name} (cópia)` });

  const canSave =
    grid.name.trim().length > 0 &&
    grid.photo_high_price >= MIN_PHOTO_PRICE &&
    grid.video_price >= MIN_VIDEO_PRICE;

  const handleHighChange = (v: number) => {
    setGrid((g) => ({
      ...g,
      photo_high_price: v,
      photo_low_price: v, // mirror para compat com dados antigos
    }));
  };

  const handleVideoChange = (v: number) => {
    setGrid((g) => ({ ...g, video_price: v }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-bold text-foreground text-lg">Cadastro de preços</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie presets reutilizáveis para diferentes tipos de evento.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Presets list */}
        {grids.length > 0 && (
          <div className="px-6 pt-4 pb-3 border-b border-border bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Presets salvos
              </span>
              <button
                onClick={newPreset}
                className="text-primary flex items-center gap-1 text-xs font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Nova grade
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {grids.map((g) => {
                const active = g.id === grid.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => selectGrid(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {g.name || "Sem nome"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Strategy banner */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">{strategy}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cálculo abaixo baseado na sua configuração de Monetização do Evento
                ({photographerShare}% absorvido · {clientShare}% repassado).
              </p>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-foreground">Nome da grade</label>
            <input
              value={grid.name}
              onChange={(e) => setGrid({ ...grid, name: e.target.value })}
              placeholder='Ex.: "Corrida Padrão", "MTB Premium"…'
              className="w-full mt-1.5 px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:border-primary outline-none"
            />
          </div>

          {/* Foto Original */}
          <PriceField
            label="Foto Original (Alta resolução)"
            description={`Arquivo sem marca d'água  -  Valor mínimo: R$ ${MIN_PHOTO_PRICE.toFixed(2).replace(".", ",")}.\u00A0Sugerido: R$ 10,00.`}
            value={grid.photo_high_price}
            onChange={handleHighChange}
            min={MIN_PHOTO_PRICE}
            photographerShare={photographerShare}
            clientShare={clientShare}
          />

          {/* Vídeo */}
          <PriceField
            label="Download do vídeo"
            description={`Arquivo de vídeo entregue na resolução original. Valor mínimo: R$ ${MIN_VIDEO_PRICE.toFixed(2).replace(".", ",")}. Sugerido: R$ ${DEFAULT_VIDEO_PRICE.toFixed(2).replace(".", ",")}.`}
            value={grid.video_price}
            onChange={handleVideoChange}
            min={MIN_VIDEO_PRICE}
            photographerShare={photographerShare}
            clientShare={clientShare}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-card">
          <div className="flex items-center gap-1">
            {grid.id && (
              <>
                <button
                  onClick={duplicate}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicar
                </button>
                {onDelete && grids.length > 1 && (
                  <button
                    onClick={() => {
                      if (confirm(`Remover preset "${grid.name}"?`)) {
                        onDelete(grid.id!);
                        setGrid({ ...EMPTY, name: "Padrão" });
                      }
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(grid)}
              disabled={isSaving || !canSave}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 min-w-[140px]"
            >
              {isSaving ? "Salvando..." : grid.id ? "Atualizar grade" : "Salvar nova grade"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PriceFieldProps {
  label: string;
  description: string;
  badge?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  photographerShare: number;
  clientShare: number;
}

function PriceField({ label, description, badge, value, onChange, min = 0, photographerShare, clientShare }: PriceFieldProps) {
  const b = computeBreakdown(value || 0, photographerShare, clientShare);
  const belowMin = value < min;
  return (
    <div className="rounded-xl border border-border p-4 bg-background">
      <div className="flex items-start justify-between gap-2 mb-1">
        <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
          {label}
          <span title={description}>
            <Info className="w-3 h-3 text-muted-foreground/70" />
          </span>
        </label>
        {badge && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
            <ShieldCheck className="w-3 h-3" /> {badge}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-2.5">{description}</p>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">R$</span>
        <input
          type="number"
          step="0.01"
          min={min}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className={`flex-1 px-3 py-2 rounded-lg bg-card border text-foreground text-sm focus:border-primary outline-none ${belowMin ? "border-destructive" : "border-border"}`}
        />
      </div>
      {belowMin && (
        <p className="text-[11px] text-destructive mt-1.5">
          Valor mínimo: R$ {min.toFixed(2).replace(".", ",")}.
        </p>
      )}

      {/* Preview da divisão */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <PreviewCell label="Cliente paga" value={formatBRL(b.clientPrice)} />
        <PreviewCell label="Você recebe líquido" value={formatBRL(b.photographerNet)} highlight />
        <PreviewCell label="Sua margem" value={`${b.marginPct}%`} />
      </div>
      <p className="text-[10px] text-muted-foreground/80 mt-1.5">
        Já considera 10% de comissão da plataforma + taxa do gateway.
      </p>
    </div>
  );
}

function PreviewCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg px-2 py-1.5 border ${
        highlight ? "bg-primary/5 border-primary/30" : "bg-secondary/40 border-border"
      }`}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
