import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useEventOrders, useEvent } from "@/hooks/useEvent";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardTitle, PageTitle, PageSubtitle, SectionTitle, Caption } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Search, Download, FileText, ChevronDown, 
  Filter, MoreVertical, CreditCard, 
  ShoppingBag, Eye, RefreshCw, 
  Send, ExternalLink, Trash2, Calendar, X
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderDetailsModal } from "./OrderDetailsModal";

interface OrdersModuleProps {
  onClose?: () => void;
}

export const OrdersModule = ({ onClose }: OrdersModuleProps) => {
  const { id } = useParams();
  const { event } = useEvent(id);
  const { data: orders = [], isLoading } = useEventOrders(id);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch = 
        o.client_name.toLowerCase().includes(search.toLowerCase()) ||
        o.client_email.toLowerCase().includes(search.toLowerCase()) ||
        o.id.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "todos" || o.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter(o => o.status === "pago" || o.status === "enviado").length;
    const pending = orders.filter(o => o.status === "aguardando_pagamento").length;
    const cancelled = orders.filter(o => o.status === "cancelado").length;
    const paidList = orders.filter(o => o.status === "pago" || o.status === "enviado");
    const gross = paidList.reduce((acc, o) => acc + Number(o.amount), 0);
    // Assumed Platform fee is 10% from project context eligibility_rules
    const net = paidList.reduce((acc, o: any) => acc + (o.photographer_net != null ? Number(o.photographer_net) : Number(o.amount) * 0.9), 0);
    const avg = paid > 0 ? gross / paid : 0;

    return [
      { label: "Total de pedidos", value: total, icon: ShoppingBag, color: "text-blue-500" },
      { label: "Pedidos pagos", value: paid, icon: CreditCard, color: "text-emerald-500" },
      { label: "Pendentes", value: pending, icon: RefreshCw, color: "text-amber-500" },
      { label: "Valor bruto", value: `R$ ${gross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: FileText, color: "text-primary" },
    ];
  }, [orders]);

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando pedidos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <PageTitle className="text-2xl">Centro de Pedidos</PageTitle>
          <PageSubtitle>Gestão de vendas para {event?.name}</PageSubtitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <FileText className="w-4 h-4" /> PDF
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-4 bg-card border border-border/60 rounded-2xl shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Nome, e-mail, telefone ou ID..." 
            className="pl-9 h-10 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 rounded-xl whitespace-nowrap">
                <Filter className="w-4 h-4" /> 
                {statusFilter === "todos" ? "Status" : statusFilter.replace("_", " ")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("todos")}>Todos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("pago")}>Pago</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("aguardando_pagamento")}>Pendente</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("cancelado")}>Cancelado</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Nenhum pedido encontrado</h3>
          <p className="text-muted-foreground">Ainda não há vendas para este evento ou o filtro não retornou resultados.</p>
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Código / Comprador</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Data</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Valor</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Pagamento</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                          {order.client_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{order.client_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{format(new Date(order.created_at), 'dd/MM/yyyy')}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(order.created_at), 'HH:mm')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-sm text-foreground">
                      R$ {Number(order.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {order.payment_method === 'pix' ? (
                        <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
                           <span className="text-[8px] font-bold text-emerald-700">PIX</span>
                        </div>
                      ) : (
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-xs capitalize">{order.payment_method || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`
                        text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md
                        ${order.status === 'pago' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          order.status === 'aguardando_pagamento' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                          'bg-red-50 text-red-700 border-red-200'}
                      `}
                    >
                      {order.status === 'aguardando_pagamento' ? 'Pendente' : order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Ações do Pedido</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setSelectedOrder(order.id)}>
                          <Eye className="w-4 h-4 mr-2" /> Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`mailto:${order.client_email}`)}>
                          <Send className="w-4 h-4 mr-2" /> Enviar E-mail
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal 
          orderId={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}
    </div>
  );
};