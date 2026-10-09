import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type EventUpdate = Database["public"]["Tables"]["events"]["Update"];

export function useEvent(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!eventId,
  });

  const updateEvent = useMutation({
    mutationFn: async (updates: EventUpdate) => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("events").update(updates).eq("id", eventId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["public-event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-discount", eventId] });
      queryClient.invalidateQueries({ queryKey: ["checkout-discount", eventId] });
      toast.success("Evento atualizado!");
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Evento excluído!"),
    onError: (e) => toast.error("Erro ao excluir: " + e.message),
  });

  return { event: eventQuery.data, isLoading: eventQuery.isLoading, error: eventQuery.error, updateEvent, deleteEvent, refetch: eventQuery.refetch };
}

export function useEventPhotos(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const photosQuery = useQuery({
    queryKey: ["event-photos", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("event_photos").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase.from("event_photos").delete().eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-photos", eventId] });
      toast.success("Foto removida!");
    },
  });

  return { photos: photosQuery.data || [], isLoading: photosQuery.isLoading, deletePhoto };
}

export function useEventVideos(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const videosQuery = useQuery({
    queryKey: ["event-videos", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("event_videos").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const deleteVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase.from("event_videos").delete().eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-videos", eventId] });
      toast.success("Vídeo removido!");
    },
  });

  const updateVideoStatus = useMutation({
    mutationFn: async ({ ids, visibility }: { ids: string[], visibility: "public" | "hidden" }) => {
      const { error } = await supabase
        .from("event_videos")
        .update({ visibility })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-videos", eventId] });
    },
    onError: (e) => toast.error("Erro ao atualizar vídeos: " + e.message),
  });

  return { 
    videos: videosQuery.data || [], 
    isLoading: videosQuery.isLoading, 
    deleteVideo,
    updateVideoStatus
  };
}

export function useEventOrders(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-orders", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("orders").select("*, order_items(id)").eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}

export function useEventCoupons(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const couponsQuery = useQuery({
    queryKey: ["event-coupons", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("event_coupons").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const createCoupon = useMutation({
    mutationFn: async (coupon: { code: string; discount_type: "percentual" | "valor_fixo"; discount_value: number; max_uses: number }) => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("event_coupons").insert({ ...coupon, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-coupons", eventId] });
      toast.success("Cupom criado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const toggleCoupon = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("event_coupons").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-coupons", eventId] }),
  });

  return { coupons: couponsQuery.data || [], isLoading: couponsQuery.isLoading, createCoupon, toggleCoupon };
}

export function useEventPriceGrid(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const gridQuery = useQuery({
    queryKey: ["price-grid", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("price_grids").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const savePriceGrid = useMutation({
    mutationFn: async (grid: { name: string; photo_high_price: number; photo_low_price: number; video_price: number; id?: string }) => {
      if (!eventId) throw new Error("No event ID");
      if (grid.id) {
        const { error } = await supabase.from("price_grids").update(grid).eq("id", grid.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("price_grids").insert({ ...grid, event_id: eventId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-grid", eventId] });
      toast.success("Grade de preço salva!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deletePriceGrid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_grids").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-grid", eventId] });
      toast.success("Grade removida");
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  return { grids: gridQuery.data || [], isLoading: gridQuery.isLoading, savePriceGrid, deletePriceGrid };
}

export function useDiscountPackages(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const packagesQuery = useQuery({
    queryKey: ["discount-packages", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase.from("discount_packages").select("*").eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const savePackage = useMutation({
    mutationFn: async (pkg: {
      min_photos: number;
      discount_pct: number;
      all_photos_price?: number;
      min_photo_price?: number;
      package_type?: "closed" | "per_photo";
      display_mode?: "from" | "always";
      active?: boolean;
      base_photo_price?: number;
      id?: string;
    }) => {
      if (!eventId) throw new Error("No event ID");
      if (pkg.id) {
        const { error } = await supabase.from("discount_packages").update(pkg).eq("id", pkg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discount_packages").insert({ ...pkg, event_id: eventId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-packages", eventId] });
      toast.success("Pacote salvo!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-packages", eventId] });
      toast.success("Pacote removido!");
    },
  });

  return { packages: packagesQuery.data || [], isLoading: packagesQuery.isLoading, savePackage, deletePackage };
}

export function useEventFinancials(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-financials", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      
      // Fetch orders with items
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          items:order_items(
            *,
            event_photos(id),
            event_videos(id)
          )
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch event coupons usage
      const { data: coupons, error: couponsError } = await supabase
        .from("event_coupons")
        .select("*")
        .eq("event_id", eventId);

      if (couponsError) throw couponsError;

      return { orders, coupons };
    },
    enabled: !!eventId,
  });
}
