import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Menu, X, User, LogOut, Settings, LayoutDashboard, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedLogo from "@/components/AnimatedLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const { user, displayName: profileDisplayName, signOut, hasRole } = useAuth();
  const isPhotographer = hasRole("photographer") || hasRole("organizer");
  const { theme, toggleTheme } = useTheme();
  const isCleanTheme = theme === "clean";

  const displayName = profileDisplayName || user?.email?.split("@")[0] || "Usuário";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isHome ? "bg-background/60 backdrop-blur-xl" : "bg-background/90 backdrop-blur-xl"
      } border-b border-border`}
    >
      <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
        {/* 🔥 LOGO COM ANIMAÇÃO */}
        <Link to="/" className="flex items-center gap-2">
          <AnimatedLogo />
        </Link>

        {/* Menu Desktop */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/meus-pedidos" className="text-muted-foreground hover:text-foreground transition-colors">
            Meus Pedidos
          </Link>
          <Link to="/buscar" className="text-muted-foreground hover:text-foreground transition-colors">
            Buscar Eventos
          </Link>
          {isPhotographer ? (
            <Link to="/dashboard" className="text-primary font-bold hover:text-primary/80 transition-colors">
              Painel
            </Link>
          ) : user ? (
            <Link to="/virar-fotografo" className="text-primary font-bold hover:text-primary/80 transition-colors">
              Sou Fotógrafo
            </Link>
          ) : (
            <Link to="/viu-pass" className="text-primary font-bold hover:text-primary/80 transition-colors">
              VIU Pass
            </Link>
          )}
        </div>

        {/* Ações Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Search className="w-5 h-5" />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Alternar tema"
          >
            {isCleanTheme ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-all">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground max-w-[120px] truncate">{displayName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Meu Painel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/configuracoes")}>
                  <Settings className="w-4 h-4 mr-2" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all hover:shadow-[0_0_20px_rgba(103,61,230,0.3)]"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Menu Mobile Button */}
        <button
          className="md:hidden p-2 text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Menu Mobile */}
      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border p-4 space-y-1">
          <Link
            to="/meus-pedidos"
            className="block py-3 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg"
            onClick={() => setMobileOpen(false)}
          >
            Meus Pedidos
          </Link>
          <Link
            to="/buscar"
            className="block py-3 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg"
            onClick={() => setMobileOpen(false)}
          >
            Buscar Eventos
          </Link>
          {isPhotographer ? (
            <Link
              to="/dashboard"
              className="block py-3 px-3 text-primary font-bold hover:bg-primary/10 rounded-lg transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Painel
            </Link>
          ) : user ? (
            <Link
              to="/virar-fotografo"
              className="block py-3 px-3 text-primary font-bold hover:bg-primary/10 rounded-lg transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Sou Fotógrafo
            </Link>
          ) : (
            <Link
              to="/viu-pass"
              className="block py-3 px-3 text-primary font-bold hover:bg-primary/10 rounded-lg transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              VIU Pass
            </Link>
          )}

          <div className="pt-2 border-t border-border mt-2">
            {user ? (
              <>
                <div className="py-2 px-3 text-sm text-foreground font-medium">{displayName}</div>
                <Link
                  to="/dashboard"
                  className="block py-3 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg"
                  onClick={() => setMobileOpen(false)}
                >
                  Meu Painel
                </Link>
                <Link
                  to="/dashboard/configuracoes"
                  className="block py-3 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg"
                  onClick={() => setMobileOpen(false)}
                >
                  Configurações
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileOpen(false);
                  }}
                  className="block w-full text-left py-3 px-3 text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="block py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-center"
                onClick={() => setMobileOpen(false)}
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
