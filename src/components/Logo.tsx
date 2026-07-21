import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const Logo = ({ size = "md", className }: LogoProps) => {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-14",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  const iconSizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 shrink-0 min-w-0",
        sizeClasses[size],
        className
      )}
      aria-label="Jhonaley Store Pterodactyl"
    >
      <svg
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("shrink-0 text-primary", iconSizeClasses[size])}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Coral/tree branch behind the bag */}
        <g opacity="0.9">
          <path d="M14 56 L14 30" />
          <path d="M14 42 L6 34" />
          <path d="M14 36 L4 28" />
          <path d="M14 30 L8 20" />
          <path d="M14 30 L14 14" />
          <path d="M14 22 L20 14" />
          <path d="M14 18 L10 10" />
          <path d="M14 18 L18 8" />
        </g>
        {/* Shopping bag */}
        <path
          d="M22 24 L44 24 L48 56 L18 56 Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        {/* Bag handle */}
        <path d="M28 24 C 28 16, 38 16, 38 24" />
      </svg>
      <div className={cn("flex flex-col leading-none min-w-0", textSizeClasses[size])}>
        <span className="font-bold tracking-tight text-primary truncate">
          Jhonaley Store
        </span>
        <span className="text-[0.7em] font-medium tracking-widest text-muted-foreground uppercase truncate">
          Pterodactyl
        </span>
      </div>
    </div>
  );
};

export default Logo;
