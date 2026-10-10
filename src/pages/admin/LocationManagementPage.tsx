/**
 * RexaCloud Datacenter Location Management
 * Global datacenter zones (Frankfurt, London, New York, Dallas, Singapore, Tokyo).
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { AdminLocation } from '@/shared/types';
import { MapPin, Plus, Server, Globe, Loader2 } from 'lucide-react';

export const LocationManagementPage: React.FC = () => {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setIsLoading(true);
    try {
      const res = await api.listLocations();
      setLocations(res.locations);
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Datacenter Locations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Geographic regions and edge pops hosting RexaCloud gaming infrastructure
          </p>
        </div>

        <button
          onClick={() => alert('New location modal')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Location</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-xs">Loading datacenter regions...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Globe className="w-10 h-10 text-purple-400/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Datacenter Locations Found</h3>
          <p className="text-xs max-w-sm mx-auto">
            No locations were returned from your Pterodactyl Panel. Create locations in Pterodactyl Admin &gt; Locations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-3 shadow-sm hover:border-purple-600/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 font-bold font-mono">
                  {loc.short}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{loc.long}</h3>
                  <p className="text-xs text-slate-400 font-mono">Region ID: #{loc.id}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-purple-900/20 flex justify-between items-center text-xs text-slate-400">
                <span>Location Code: <strong className="text-purple-300">{loc.short}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
