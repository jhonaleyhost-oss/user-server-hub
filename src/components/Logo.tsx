import logoAsset from "@/assets/logo.png.asset.json";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const Logo = ({ size = "md", showText = true }: LogoProps) => {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-14",
  };

  return (
    <div className="flex items-center gap-3">
      <img
        src={logoAsset.url}
        alt="Jhonaley Store"
        className={`${sizeClasses[size]} w-auto object-contain shrink-0`}
      />
      {showText && (
        <div>
          <h1 className="font-bold text-lg leading-none tracking-tight text-foreground">
            Jhonaley Store Cpanel
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">v5.0 Stable</p>
        </div>
      )}
    </div>
  );
};

export default Logo;
