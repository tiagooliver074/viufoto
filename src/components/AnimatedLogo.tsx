import React from "react";
import viufotoLogoLight from "@/assets/viufoto-logo-light.png";
import viufotoLogoDark from "@/assets/viufoto-logo-dark.png";

interface AnimatedLogoProps {
  className?: string;
}

/**
 * Logomarca oficial da ViuFoto.
 * Swap automático entre versão para fundo claro (padrão) e fundo escuro (.dark-theme),
 * controlado por CSS em src/index.css.
 */
const AnimatedLogo = React.forwardRef<HTMLSpanElement, AnimatedLogoProps>(
  ({ className = "h-6 sm:h-7" }, ref) => {
    return (
      <span ref={ref} className={`relative inline-block ${className}`} aria-label="ViuFoto">
        <img
          src={viufotoLogoLight}
          alt="ViuFoto"
          draggable={false}
          className="viufoto-logo-light h-full w-auto block select-none animate-fade-in"
        />
        <img
          src={viufotoLogoDark}
          alt="ViuFoto"
          draggable={false}
          className="viufoto-logo-dark h-full w-auto hidden select-none animate-fade-in"
        />
      </span>
    );
  }
);

AnimatedLogo.displayName = "AnimatedLogo";

export default AnimatedLogo;