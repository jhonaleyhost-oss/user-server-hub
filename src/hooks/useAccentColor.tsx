import { createContext, useContext, useEffect, useState } from "react";

export type AccentColor = "pink" | "blue" | "green" | "orange";

type AccentColorContextType = {
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
};

const AccentColorContext = createContext<AccentColorContextType | undefined>(undefined);

const STORAGE_KEY = "jhonaley-accent-color";

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as AccentColor) || "pink";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Add transition class for smooth color change
    root.classList.add("theme-transition");

    // Remove all accent classes
    root.classList.remove("accent-pink", "accent-blue", "accent-green", "accent-orange");
    
    // Add current accent class
    root.classList.add(`accent-${accent}`);

    // Remove transition class after animation
    const timeout = setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 300);

    return () => clearTimeout(timeout);
  }, [accent]);

  const setAccent = (newAccent: AccentColor) => {
    localStorage.setItem(STORAGE_KEY, newAccent);
    setAccentState(newAccent);
  };

  return (
    <AccentColorContext.Provider value={{ accent, setAccent }}>
      {children}
    </AccentColorContext.Provider>
  );
}

export const useAccentColor = () => {
  const context = useContext(AccentColorContext);
  if (context === undefined) {
    throw new Error("useAccentColor must be used within an AccentColorProvider");
  }
  return context;
};
