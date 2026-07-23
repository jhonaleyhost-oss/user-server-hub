import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      duration={2500}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto !w-auto !max-w-[92vw] !min-w-0 !py-2.5 !px-3.5 !rounded-full !gap-2 group-[.toaster]:bg-background/85 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/60 group-[.toaster]:shadow-[0_8px_24px_-8px_hsl(var(--background)/0.6)] text-sm",
          title: "!text-sm !font-medium leading-tight",
          description: "group-[.toast]:text-muted-foreground !text-xs leading-tight",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          icon: "!m-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
