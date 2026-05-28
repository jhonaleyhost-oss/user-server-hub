import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, Wifi, WifiOff, RefreshCw, Loader2, Lock, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Link } from 'react-router-dom';

interface ServerStatus {
  serverId: string;
  serverName: string;
  isOnline: boolean;
  totalServers: number;
  totalUsers: number;
  isPrivate?: boolean;
}

interface Props {
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  selectedServerId?: string; // ID of server currently used by user
}

const ServerStatusDisplay = ({ autoRefresh = true, refreshInterval = 30, selectedServerId }: Props) => {
  const [statuses, setStatuses] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { role } = useUserRole();
  const isFree = role === 'free';

  const fetchStatuses = async () => {
    try {
      const response = await supabase.functions.invoke('public-server-status');

      if (response.error) {
        console.error('Error fetching server status:', response.error);
        return;
      }

      if (response.data?.success) {
        setStatuses(response.data.statuses);
        setLastUpdated(new Date(response.data.lastUpdated));
      }
    } catch (err) {
      console.error('Error fetching server statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();

    if (autoRefresh) {
      const interval = setInterval(fetchStatuses, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const onlineCount = statuses.filter(s => s.isOnline).length;
  const totalCount = statuses.length;

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Memuat status server...</span>
        </div>
      </div>
    );
  }

  if (statuses.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Server Status</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {onlineCount}/{totalCount} online
          </span>
          <button
            onClick={fetchStatuses}
            className="p-1 hover:bg-secondary rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {statuses.map((server, idx) => {
          const isSelected = selectedServerId === server.serverId;
          const locked = isFree && server.isPrivate;
          return (
            <motion.div
              key={server.serverId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-center justify-between p-2 rounded-lg border-2 transition-all ${
                isSelected 
                  ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]' 
                  : server.isOnline 
                    ? 'bg-green-500/10 border-transparent' 
                    : 'bg-red-500/10 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                {locked ? (
                  <Lock className="w-3 h-3 text-muted-foreground" />
                ) : server.isOnline ? (
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSelected ? 'bg-primary' : 'bg-green-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isSelected ? 'bg-primary' : 'bg-green-500'}`}></span>
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                )}
                <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''} ${locked ? 'blur-[3px] select-none' : ''}`}>
                  {locked ? '••••••••' : server.serverName}
                </span>
                {server.isPrivate && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-medium">
                    Private
                  </span>
                )}
                {isSelected && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">
                    Anda
                  </span>
                )}
              </div>
              
              {locked ? (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              ) : server.isOnline ? (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{server.totalServers} panel</span>
                  <span>{server.totalUsers} user</span>
                </div>
              ) : (
                <span className="text-xs text-red-400">Offline</span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Upgrade CTA for free users with private servers */}
      {isFree && statuses.some(s => s.isPrivate) && (
        <Link
          to="/upgrade"
          className="flex items-center justify-center gap-2 w-full p-2.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-primary/20 border border-amber-500/30 hover:from-amber-500/30 hover:to-primary/30 transition-all text-xs font-medium text-amber-200"
        >
          <Crown className="w-3.5 h-3.5" />
          Upgrade ke Reseller untuk akses server private
        </Link>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-center text-xs text-muted-foreground">
          Update: {lastUpdated.toLocaleTimeString('id-ID')} • Auto refresh {refreshInterval}s
        </div>
      )}
    </motion.div>
  );
};

export default ServerStatusDisplay;
