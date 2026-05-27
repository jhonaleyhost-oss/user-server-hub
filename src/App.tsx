import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AccentColorProvider } from "@/hooks/useAccentColor";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import PromoPopup from "@/components/PromoPopup";
import ChatNotifier from "@/components/ChatNotifier";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="jhonaley-ui-theme">
      <AccentColorProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PromoPopup />
            <BrowserRouter>
              <ChatNotifier />
              <AnimatedRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </AccentColorProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
