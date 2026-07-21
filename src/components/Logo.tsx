import logoAsset from "@/assets/logo.png.asset.json";
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

  return (
    <img
      src={logoAsset.url}
      alt="Jhonaley Store"
      className={cn(`${sizeClasses[size]} w-auto object-contain shrink-0`, className)}
    />
  );
};

export default Logo;
