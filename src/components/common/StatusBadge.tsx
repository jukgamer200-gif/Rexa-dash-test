/**
 * RexaCloud Status Badge
 * Recreates the pill status badges from the reference image (Online / Offline / Starting).
 */

import React from 'react';
import { ServerStatus } from '@/shared/types';

interface StatusBadgeProps {
  status: ServerStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const isOnline = status === 'running' || status === 'online';
  const isStarting = status === 'starting';

  if (isOnline) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Online
      </span>
    );
  }

  if (isStarting) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Starting
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
      Offline
    </span>
  );
};
