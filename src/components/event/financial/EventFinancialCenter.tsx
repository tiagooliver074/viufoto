import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useEvent, useEventFinancials } from "@/hooks/useEvent";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area 
} from "recharts";
import { 
  DollarSign, TrendingUp, ShoppingBag, Image as ImageIcon, 
  Video, Download, FileText, ArrowUpRight, 
  Percent, Tag, Search, X, Info, Filter
} from "lucide-react";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle, PageSubtitle, SectionTitle, Caption } from "@/components/ui/Typography";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface EventFinancialCenterProps {
  open?: boolean;
  onClose?: () => void;
  eventId?: string;
}

export const EventFinancialCenter = ({ open, onClose, eventId: propEventId }: EventFinancialCenterProps) => {
  const { id: urlEventId } = useParams();
  const eventId = propEventId || urlEventId;
  const { event } = useEvent(eventId);
  const { data, isLoading } = useEventFinancials(eventId);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("30d");
  const [statusFilter, setStatusFilter] = useState("todos");

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    return data.orders.filter(o => {
      const matchesSearch = (o.client_name || "").toLowerCase().includes(search.toLowerCase()) || 
                           o.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "todos" || o.status === statusFilter;
      
      let matchesPeriod = true;
      const orderDate = parseISO(o.created_at);
      if (periodFilter === "7d") matchesPeriod = orderDate >= subDays(new Date(), 7);
      else if (periodFilter === "30d") matchesPeriod = orderDate >= subDays(new Date(), 30);
      else if (periodFilter === "today") matchesPeriod = orderDate >= startOfDay(new Date());

      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }, [data, search, statusFilter, periodFilter]);

  const stats = useMemo(() => {
    if (!data) return null;
    const paidOrders = filteredOrders.filter(o => o.status === "pago" || o.status === "enviado");
    
    const grossRevenue = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const platformCommission = grossRevenue * 0.10;
    const netRevenue = grossRevenue - platformCommission;
    
    const totalPhotos = paidOrders.reduce((sum, o) => {
      return sum + (o.items?.filter((i: any) => i.photo_id).length || 0);
    }, 0);
    
    const totalVideos = paidOrders.reduce((sum, o) => {
      return sum + (o.items?.filter((i: any) => i.video_id).length || 0);
    }, 0);

    const avgTicket = paidOrders.length > 0 ? grossRevenue / paidOrders.length : 0;
    const avgPhotoPrice = totalPhotos > 0 ? grossRevenue / totalPhotos : 0;

    return {
      grossRevenue,
      netRevenue,
      platformCommission,
      orderCount: paidOrders.length,
      photoCount: totalPhotos,
      videoCount: totalVideos,
      avgTicket,
      avgPhotoPrice
    };
  }, [filteredOrders, data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const paidOrders = filteredOrders.filter(o => o.status === "pago" || o.status === "enviado");
    const groups: Record<string, any> = {};
    paidOrders.forEach(o => {
      const day = format(parseISO(o.created_at), "yyyy-MM-dd");
      if (!groups[day]) {
        groups[day] = { day, date: parseISO(o.created_at), revenue: 0, orders: 0 };
      }
      groups[day].revenue += Number(o.amount);
      groups[day].orders += 1;
    });

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(g => ({
        ...g,
        formattedDate: format(g.date, "dd/MM")
      }));
  }, [filteredOrders, data]);

  const exportToCSV = () => {
    if (!filteredOrders.length) return;
    const headers = ["ID", "Data", "Cliente", "Email", "Valor Bruto", "Comissão (10%)", "Líquido", "Status", "Método"];
    const rows = filteredOrders.map(o => [
      o.id,
      format(parseISO(o.created_at), "dd/MM/yyyy HH:mm"),
      o.client_name,
      o.client_email,
      Number(o.amount).toFixed(2),
      (Number(o.amount) * 0.1).toFixed(2),
      (Number(o.amount) * 0.9).toFixed(2),
      o.status,
      o.payment_method
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `financeiro_evento_${eventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado!");
  };

  const exportToExcel = () => {
    if (!filteredOrders.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredOrders.map(o => ({
      ID: o.id,
      Data: format(parseISO(o.created_at), "dd/MM/yyyy HH:mm"),
      Cliente: o.client_name,
      "Valor Bruto": Number(o.amount),
      "Valor Líquido": Number(o.amount) * 0.9,
      Status: o.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    XLSX.writeFile(wb, `financeiro_evento_${eventId}.xlsx`);
    toast.success("Excel exportado!");
  };

  const exportToPDF = () => {
    if (!filteredOrders.length) return;
    const doc = new jsPDF();
    doc.text(`Relatório Financeiro - ${event?.name || "Evento"}`, 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [["Data", "Cliente", "Valor Bruto", "Líquido", "Status"]],
      body: filteredOrders.map(o => [
        format(parseISO(o.created_at), "dd/MM/yy"),
        o.client_name,
        `R$ ${Number(o.amount).toFixed(2)}`,
        `R$ ${(Number(o.amount) * 0.9).toFixed(2)}`,
        o.status
      ]),
    });
    doc.save(`financeiro_evento_${eventId}.pdf`);
    toast.success("PDF exportado!");
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-6 p-6 min-h-[400px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
          </div>
          <div className="h-64 bg-muted animate-pulse rounded-2xl" />
        </div>
      );
    }

    if (!data?.orders || data.orders.length === 0) {
      if (!open) return null;
      
      return (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center min-h-[400px]">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
            <DollarSign className="w-10 h-10 text-primary" />
          </div>
          <SectionTitle className="text-xl md:text-2xl">Sem movimentações financeiras</SectionTitle>
          <p className="text-muted-foreground max-w-sm mt-3 leading-relaxed">
            Este evento ainda não registrou vendas. Assim que ocorrer o primeiro pedido, os dados de faturamento e métricas aparecerão aqui.
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="mt-8 rounded-xl px-8">
              Fechar
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-8 p-6 pb-10 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <PageTitle className="text-2xl truncate">{event?.name || "Financeiro"}</PageTitle>
            <PageSubtitle>Gestão de faturamento e performance</PageSubtitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/40">
              {[
                { label: "Hoje", value: "today" },
                { label: "7D", value: "7d" },
                { label: "30D", value: "30d" },
                { label: "Tudo", value: "todos" }
              ].map(p => (
                <Button 
                  key={p.value} 
                  variant={periodFilter === p.value ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-[10px] font-bold px-3 rounded-lg"
                  onClick={() => setPeriodFilter(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl h-9">
                  <Download className="w-4 h-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF} className="gap-2">PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel} className="gap-2">Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} className="gap-2">CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-l-4 border-l-primary">
            <CardContent className="p-5">
              <Caption className="font-bold uppercase tracking-widest text-muted-foreground mb-1">Bruto</Caption>
              <p className="text-2xl font-black">R$ {stats?.grossRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-l-4 border-l-emerald-500">
            <CardContent className="p-5">
              <Caption className="font-bold uppercase tracking-widest text-muted-foreground mb-1">Líquido</Caption>
              <p className="text-2xl font-black text-emerald-600">R$ {stats?.netRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-l-4 border-l-orange-500">
            <CardContent className="p-5">
              <Caption className="font-bold uppercase tracking-widest text-muted-foreground mb-1">Comissão (10%)</Caption>
              <p className="text-2xl font-black text-orange-600">R$ {stats?.platformCommission.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-l-4 border-l-blue-500">
            <CardContent className="p-5">
              <Caption className="font-bold uppercase tracking-widest text-muted-foreground mb-1">Ticket Médio</Caption>
              <p className="text-2xl font-black text-blue-600">R$ {stats?.avgTicket.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Card className="rounded-2xl">
          <CardHeader className="p-6 border-b border-border/40">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Evolução de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <div className="border rounded-2xl overflow-hidden bg-card">
          <div className="p-4 border-b border-border/40 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar pedido ou cliente..." 
                className="pl-9 bg-background border-none h-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase">Data</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Cliente</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">Valor</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.slice(0, 10).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="text-xs">{format(parseISO(order.created_at), "dd/MM/yy HH:mm")}</TableCell>
                  <TableCell className="text-xs font-medium">{order.client_name}</TableCell>
                  <TableCell className="text-xs font-bold text-right">R$ {Number(order.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  if (open) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
        <DialogContent hideClose className="w-[calc(100%-1rem)] max-w-[95vw] h-[90vh] rounded-2xl flex flex-col p-0 overflow-hidden bg-background border-border z-[100]">
          <div className="flex-1 overflow-auto scrollbar-thin">
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};
