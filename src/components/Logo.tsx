import logoAsset from "@/assets/logo.png.asset.json";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const Logo = ({ size = "md", className }: LogoProps) => {
  const sizeClasses = {
    sm: "h-10",
    md: "h-12",
    lg: "h-[68px]",
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
