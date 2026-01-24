import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'light') return Sun;
    if (theme === 'dark') return Moon;
    return Monitor;
  };

  const Icon = getIcon();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2.5 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-all overflow-hidden group"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={theme}
              initial={{ y: -20, opacity: 0, rotate: -90 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 20, opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <Icon className="w-5 h-5 text-foreground" />
            </motion.div>
          </AnimatePresence>
          
          {/* Glow effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl" />
          </div>
        </motion.button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="glass-card border-border min-w-[140px]">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={`flex items-center gap-3 cursor-pointer ${theme === 'light' ? 'text-primary' : ''}`}
        >
          <Sun className="w-4 h-4" />
          <span>Light</span>
          {theme === 'light' && (
            <motion.div
              layoutId="theme-indicator"
              className="ml-auto w-2 h-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-3 cursor-pointer ${theme === 'dark' ? 'text-primary' : ''}`}
        >
          <Moon className="w-4 h-4" />
          <span>Dark</span>
          {theme === 'dark' && (
            <motion.div
              layoutId="theme-indicator"
              className="ml-auto w-2 h-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={`flex items-center gap-3 cursor-pointer ${theme === 'system' ? 'text-primary' : ''}`}
        >
          <Monitor className="w-4 h-4" />
          <span>System</span>
          {theme === 'system' && (
            <motion.div
              layoutId="theme-indicator"
              className="ml-auto w-2 h-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
