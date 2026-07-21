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
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Stylized pterodactyl / bag mark */}
        <path d="M8 40 C 18 20, 30 14, 44 18 L 56 12 L 52 26 C 58 34, 54 46, 42 50 L 34 58 L 30 48 C 20 48, 12 46, 8 40 Z" />
        <circle cx="46" cy="24" r="1.8" fill="currentColor" stroke="none" />
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
