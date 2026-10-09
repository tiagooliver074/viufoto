import { Link, useNavigate } from "react-router-dom";
import { Search, Menu, X, User, LogOut, Package, Sun, Moon, Camera, Heart, LayoutDashboard } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFavorites } from "@/hooks/useFavorites";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import AnimatedLogo from "@/components/AnimatedLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ClientNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { user, profile, displayName: profileDisplayName, signOut, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { count: favCount } = useFavorites();
  const isCleanTheme = theme === "clean";

  const displayName = profileDisplayName || user?.email?.split("@")[0] || "Usuário";
  const initials = (profileDisplayName || user?.email || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const isPhotographerOrOrganizer = hasRole("photographer") || hasRole("organizer");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/buscar?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <AnimatedLogo />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/meus-pedidos"
              className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              Meus pedidos
            </Link>

            <Link
              to="/favoritos"
              className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5 relative"
            >
              <Heart className="w-4 h-4" />
              Favoritos
              {favCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {favCount}
                </span>
              )}
            </Link>

            {/* Show dashboard link for photographers/organizers */}
            {user && isPhotographerOrOrganizer && (
              <Link
                to="/dashboard"
                className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4" />
                Painel
              </Link>
            )}

            {user && !isPhotographerOrOrganizer && (
              <Link
                to="/virar-fotografo"
                className="px-3 py-2 rounded-lg text-primary font-bold hover:bg-primary/10 transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                Sou fotógrafo
              </Link>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {isCleanTheme ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-all">
                  <Avatar className="w-8 h-8">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                      {initials || <User className="w-4 h-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground max-w-[120px] truncate">{displayName}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/meus-pedidos")}>
                    <Package className="w-4 h-4 mr-2" /> Meus Pedidos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/favoritos")}>
                    <Heart className="w-4 h-4 mr-2" /> Favoritos {favCount > 0 && `(${favCount})`}
                  </DropdownMenuItem>
                  {isPhotographerOrOrganizer && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                        <LayoutDashboard className="w-4 h-4 mr-2" /> Painel do Fotógrafo
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
              >
                Entrar
              </Link>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <button
              className="p-2 text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {searchOpen && (
          <div className="border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3">
            <form onSubmit={handleSearch} className="container mx-auto max-w-2xl flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar evento, fotógrafo..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                Buscar
              </button>
            </form>
          </div>
        )}

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border p-4 space-y-1">
            <Link to="/meus-pedidos" className="flex items-center gap-2 py-3 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg" onClick={() => setMobileOpen(false)}>
              <Package className="w-4 h-4" /> Meus pedidos
            </Link>
            <Link to="/favoritos" className="flex items-center gap-2 py-3 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg" onClick={() => setMobileOpen(false)}>
              <Heart className="w-4 h-4" /> Favoritos {favCount > 0 && `(${favCount})`}
            </Link>
            <Link to="/buscar" className="flex items-center gap-2 py-3 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg" onClick={() => setMobileOpen(false)}>
              <Search className="w-4 h-4" /> Buscar eventos
            </Link>

            {user && isPhotographerOrOrganizer && (
              <Link to="/dashboard" className="flex items-center gap-2 py-3 px-3 text-primary hover:bg-primary/10 rounded-lg font-medium" onClick={() => setMobileOpen(false)}>
                <LayoutDashboard className="w-4 h-4" /> Painel do Fotógrafo
              </Link>
            )}

            {user && !isPhotographerOrOrganizer && (
              <Link to="/virar-fotografo" className="flex items-center gap-2 py-3 px-3 text-primary hover:bg-primary/10 rounded-lg font-bold" onClick={() => setMobileOpen(false)}>
                <Camera className="w-4 h-4" /> Sou fotógrafo
              </Link>
            )}

            <div className="pt-2 border-t border-border mt-2">
              {user ? (
                <>
                  <div className="py-2 px-3 text-sm text-foreground font-medium">{displayName}</div>
                  <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="flex items-center gap-2 w-full text-left py-3 px-3 text-destructive hover:bg-destructive/10 rounded-lg">
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </>
              ) : (
                <Link to="/login" className="block py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-center" onClick={() => setMobileOpen(false)}>
                  Entrar
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default ClientNavbar;
