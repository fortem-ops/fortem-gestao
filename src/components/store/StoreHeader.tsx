import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, ShoppingBag, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartLoja } from "@/hooks/useCartLoja";
import { useStoreTheme } from "@/hooks/useStoreTheme";

interface StoreHeaderProps {
  backTo?: string;
  title?: string;
}

const StoreHeader = ({ backTo, title = "Loja Fortem" }: StoreHeaderProps) => {
  const { totalItems } = useCartLoja();
  const navigate = useNavigate();
  const { theme, toggleTheme, palette } = useStoreTheme();
  const headerBg = theme === "dark" ? "bg-neutral-950/90" : "bg-white/90";

  return (
    <header
      className={`sticky top-0 z-40 border-b ${palette.border} ${headerBg} ${palette.text} backdrop-blur`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar"
            className={palette.text}
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link
            to="/store"
            className="truncate font-display text-lg font-black uppercase tracking-tight"
          >
            {title}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            className={`${palette.card} hover:${palette.surface}`}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Link to="/store/carrinho" aria-label="Carrinho" className="relative">
            <Button variant="outline" size="icon" className={palette.card}>
              <ShoppingBag className="h-5 w-5" />
            </Button>
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default StoreHeader;
