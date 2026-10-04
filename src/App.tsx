import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Navigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import EventPage from "./pages/EventPage";
import Dashboard from "./pages/Dashboard";
import Financeiro from "./pages/Financeiro";
import CriarEvento from "./pages/CriarEvento";
import VIUPass from "./pages/VIUPass";
import Pedidos from "./pages/Pedidos";
import Clientes from "./pages/Clientes";
import Configuracoes from "./pages/Configuracoes";
import Oportunidades from "./pages/Oportunidades";
import MeuColetivo from "./pages/MeuColetivo";
import Propostas from "./pages/Propostas";
import EventDashboard from "./pages/EventDashboard";
import Login from "./pages/Login";
import LoginRole from "./pages/LoginRole";
import Cadastro from "./pages/Cadastro";
import CadastroFotografo from "./pages/CadastroFotografo";
import CadastroOrganizador from "./pages/CadastroOrganizador";
import RecuperarSenha from "./pages/RecuperarSenha";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import FotoPage from "./pages/FotoPage";
import PhotographerPage from "./pages/PhotographerPage";
import PhotographerPortfolioPage from "./pages/PhotographerPortfolioPage";
import ColetivoPublicPage from "./pages/ColetivoPublicPage";
import MeusPedidos from "./pages/MeusPedidos";
import BuscarEventos from "./pages/BuscarEventos";
import Favoritos from "./pages/Favoritos";
import VirarFotografo from "./pages/VirarFotografo";
import ParaOrganizadores from "./pages/ParaOrganizadores";
import TermosDeUso from "./pages/TermosDeUso";
import Ajuda from "./pages/Ajuda";
import Chamados from "./pages/Chamados";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BlogAdm from "./pages/admin/BlogAdm";
import TermsGate from "./components/TermsGate";
import AdminLayout from "./components/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminPhotographers from "./pages/admin/AdminPhotographers";
import AdminPhotographerDetail from "./pages/admin/AdminPhotographerDetail";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminModeration from "./pages/admin/AdminModeration";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSearchAnalytics from "./pages/admin/AdminSearchAnalytics";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminStorage from "./pages/admin/AdminStorage";
import AdminInscricoes from "./pages/admin/AdminInscricoes";
import AdminInscricaoDetail from "./pages/admin/AdminInscricaoDetail";
import AdminHero from "./pages/admin/AdminHero";
import AdminPhotos from "./pages/admin/AdminPhotos";
import AdminHealth from "./pages/admin/AdminHealth";
import AdminInfraMonitor from "./pages/admin/AdminInfraMonitor";
import AdminPhotoDiagnostics from "./pages/admin/AdminPhotoDiagnostics";
import InscricoesList from "./pages/inscricoes/InscricoesList";
import InscricaoForm from "./pages/inscricoes/InscricaoForm";
import InscricaoDetail from "./pages/inscricoes/InscricaoDetail";
import InscricaoPublic from "./pages/inscricoes/InscricaoPublic";
import Embaixador from "./pages/Embaixador";
import ReferralCapture from "./pages/ReferralCapture";
import MeuNivel from "./pages/MeuNivel";
import DashboardSidebar from "./components/DashboardSidebar";
import BottomNav from "./components/BottomNav";
import AdminLevels from "./pages/admin/AdminLevels";
import AdminEmbaixador from "./pages/admin/AdminEmbaixador";
import AdminParceiros from "./pages/admin/AdminParceiros";
import AdminAntifraude from "./pages/admin/AdminAntifraude";
import Sobre from "./pages/Sobre";
import Marketing from "./pages/Marketing";
import SubdomainSite from "./components/SubdomainSite";
import { getTenantSlugFromHostname } from "@/lib/siteSlug";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const tenantSlug = getTenantSlugFromHostname();
  if (tenantSlug) return <SubdomainSite slug={tenantSlug} />;
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/:role" element={<LoginRole />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/cadastro/fotografo" element={<CadastroFotografo />} />
      <Route path="/cadastro/organizador" element={<CadastroOrganizador />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/evento/:id" element={<EventPage />} />
      <Route path="/foto/:photoId" element={<FotoPage />} />
      <Route path="/fotografo/:slug" element={<PhotographerPage />} />
      <Route path="/fotografo/:slug/portfolio" element={<PhotographerPortfolioPage />} />
      <Route path="/coletivo/:slug" element={<ColetivoPublicPage />} />
      <Route path="/meus-pedidos" element={<MeusPedidos />} />
      <Route path="/favoritos" element={<Favoritos />} />
      <Route path="/buscar" element={<BuscarEventos />} />
      <Route path="/viu-pass" element={<VIUPass />} />
      <Route path="/virar-fotografo" element={<VirarFotografo />} />
      <Route path="/para-organizadores" element={<ParaOrganizadores />} />
      <Route path="/sobre" element={<Sobre />} />
      <Route path="/termos-de-uso" element={<TermosDeUso />} />
      <Route path="/ajuda" element={<Ajuda />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/blogadm" element={<Navigate to="/admin/blog" replace />} />
      <Route path="/inscricao/:slug" element={<InscricaoPublic />} />
      <Route path="/r/:code" element={<ReferralCapture />} />
      <Route path="/dashboard" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard/financeiro" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Financeiro /></ProtectedRoute>} />
      <Route path="/dashboard/marketing" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Marketing /></ProtectedRoute>} />
      <Route path="/dashboard/criar-evento" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><CriarEvento /></ProtectedRoute>} />
      <Route path="/dashboard/pedidos" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Pedidos /></ProtectedRoute>} />
      <Route path="/dashboard/clientes" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Clientes /></ProtectedRoute>} />
      <Route path="/dashboard/oportunidades" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Oportunidades /></ProtectedRoute>} />
      <Route path="/dashboard/propostas" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Propostas /></ProtectedRoute>} />
      <Route path="/dashboard/configuracoes" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Configuracoes /></ProtectedRoute>} />
      <Route path="/dashboard/embaixador" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Embaixador /></ProtectedRoute>} />
      <Route path="/dashboard/coletivo" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><MeuColetivo /></ProtectedRoute>} />
      <Route path="/dashboard/nivel" element={
        <ProtectedRoute requiredRoles={["photographer", "organizer"]}>
          <div className="flex min-h-screen bg-background">
            <DashboardSidebar />
            <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-8 overflow-auto">
              <MeuNivel />
            </main>
          </div>
        </ProtectedRoute>
      } />
      <Route path="/dashboard/chamados" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><Chamados /></ProtectedRoute>} />
      <Route path="/dashboard/evento/:id" element={<ProtectedRoute requiredRoles={["photographer", "organizer"]}><EventDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/inscricoes" element={<ProtectedRoute requiredRoles={["organizer"]}><InscricoesList /></ProtectedRoute>} />
      <Route path="/dashboard/inscricoes/novo" element={<ProtectedRoute requiredRoles={["organizer"]}><InscricaoForm /></ProtectedRoute>} />
      <Route path="/dashboard/inscricoes/:id" element={<ProtectedRoute requiredRoles={["organizer"]}><InscricaoDetail /></ProtectedRoute>} />
      <Route path="/dashboard/inscricoes/:id/editar" element={<ProtectedRoute requiredRoles={["organizer"]}><InscricaoForm /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requiredRoles={["super_admin"]} redirectTo="/"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Overview />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="fotografos" element={<AdminPhotographers />} />
        <Route path="fotografos/:id" element={<AdminPhotographerDetail />} />
        <Route path="eventos" element={<AdminEvents />} />
        <Route path="financeiro" element={<AdminFinance />} />
        <Route path="pagamentos" element={<AdminPayments />} />
        <Route path="moderacao" element={<AdminModeration />} />
        <Route path="storage" element={<AdminStorage />} />
        <Route path="inscricoes" element={<AdminInscricoes />} />
        <Route path="inscricoes/:id" element={<AdminInscricaoDetail />} />
        <Route path="suporte" element={<AdminSupport />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="funil-busca" element={<AdminSearchAnalytics />} />
        <Route path="configuracoes" element={<AdminSettings />} />
        <Route path="hero" element={<AdminHero />} />
        <Route path="fotos" element={<AdminPhotos />} />
        <Route path="saude" element={<AdminHealth />} />
        <Route path="infra" element={<AdminInfraMonitor />} />
        <Route path="foto/:photoId" element={<AdminPhotoDiagnostics />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="blog" element={<BlogAdm />} />
        <Route path="niveis" element={<AdminLevels />} />
        <Route path="embaixador" element={<AdminEmbaixador />} />
        <Route path="parceiros" element={<AdminParceiros />} />
        <Route path="antifraude" element={<AdminAntifraude />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const isTenant = !!getTenantSlugFromHostname();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Sonner />
            <TermsGate />
            <PageTransition>
            <AppRoutes />
            </PageTransition>
            {!isTenant && <BottomNav />}
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
