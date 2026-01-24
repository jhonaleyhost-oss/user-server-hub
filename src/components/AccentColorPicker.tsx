import { motion } from 'framer-motion';
import { Check, Palette } from 'lucide-react';
import { useAccentColor, AccentColor } from '@/hooks/useAccentColor';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const accentColors: { id: AccentColor; name: string; color: string; gradient: string }[] = [
  { 
    id: 'pink', 
    name: 'Rose', 
    color: 'hsl(347 77% 50%)', 
    gradient: 'linear-gradient(135deg, hsl(347 77% 50%), hsl(330 81% 60%))' 
  },
  { 
    id: 'blue', 
    name: 'Ocean', 
    color: 'hsl(217 91% 60%)', 
    gradient: 'linear-gradient(135deg, hsl(217 91% 60%), hsl(199 89% 48%))' 
  },
  { 
    id: 'green', 
    name: 'Emerald', 
    color: 'hsl(142 71% 45%)', 
    gradient: 'linear-gradient(135deg, hsl(142 71% 45%), hsl(160 84% 39%))' 
  },
  { 
    id: 'orange', 
    name: 'Sunset', 
    color: 'hsl(25 95% 53%)', 
    gradient: 'linear-gradient(135deg, hsl(25 95% 53%), hsl(38 92% 50%))' 
  },
];

const AccentColorPicker = () => {
  const { accent, setAccent } = useAccentColor();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2.5 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-all overflow-hidden group"
        >
          <Palette className="w-5 h-5 text-foreground" />
          
          {/* Current accent indicator */}
          <div 
            className="absolute bottom-1 right-1 w-2 h-2 rounded-full"
            style={{ background: accentColors.find(c => c.id === accent)?.color }}
          />
          
          {/* Glow effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl" />
          </div>
        </motion.button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="glass-card border-border w-48 p-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-3">Pilih Warna Aksen</p>
          
          <div className="grid grid-cols-2 gap-2">
            {accentColors.map((color) => (
              <motion.button
                key={color.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAccent(color.id)}
                className={`relative flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  accent === color.id 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div 
                  className="w-5 h-5 rounded-full flex-shrink-0"
                  style={{ background: color.gradient }}
                />
                <span className="text-xs font-medium truncate">{color.name}</span>
                
                {accent === color.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AccentColorPicker;
