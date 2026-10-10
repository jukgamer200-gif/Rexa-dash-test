/**
 * RexaCloud Infrastructure Nodes Management
 * Lists physical compute nodes running Wings daemon with memory and disk allocations.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { AdminNode } from '@/shared/types';
import {
  Cpu,
  Server,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react';

export const NodeManagementPage: React.FC = () => {
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    setIsLoading(true);
    try {
      const res = await api.listNodes();
      setNodes(res.nodes);
    } catch (err) {
      console.error('Failed to load nodes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Compute Nodes</h1>
          <p className="text-xs text-slate-400 mt-1">
            Physical bare-metal and virtualized hosts executing Wings daemon containers
          </p>
        </div>

        <button
          onClick={() => alert('New node configuration wizard')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Deploy Node</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-xs">Connecting to node heartbeat daemon...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {nodes.length === 0 ? (
            <div className="col-span-full bg-[#100D1A] border border-purple-900/25 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <Cpu className="w-10 h-10 text-purple-400/50 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Compute Nodes Available</h3>
              <p className="text-xs max-w-sm mx-auto">
                No active Wings nodes were returned by your Pterodactyl Panel. Configure nodes in your Pterodactyl Application API.
              </p>
            </div>
          ) : (
            nodes.map((node) => {
              const memGB = (node.memoryAllocated / 1024).toFixed(0);
              const memTotalGB = (node.memory / 1024).toFixed(0);
              const memPercent = Math.round((node.memoryAllocated / (node.memory || 1)) * 100);

              const diskGB = (node.diskAllocated / 1024).toFixed(0);
              const diskTotalGB = (node.disk / 1024).toFixed(0);
              const diskPercent = Math.round((node.diskAllocated / (node.disk || 1)) * 100);

              return (
                <div
                  key={node.id}
                  className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{node.name}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{node.fqdn}</p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{node.description}</p>

                  {/* Telemetry Progress Bars */}
                  <div className="space-y-3 pt-2 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Memory Allocated</span>
                        <span className="font-mono text-white">{memGB} / {memTotalGB} GB ({memPercent}%)</span>
                      </div>
                      <div className="w-full bg-[#181228] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${memPercent}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Disk Space Allocated</span>
                        <span className="font-mono text-white">{diskGB} / {diskTotalGB} GB ({diskPercent}%)</span>
                      </div>
                      <div className="w-full bg-[#181228] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${diskPercent}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-purple-900/20 flex justify-between items-center text-xs text-slate-400">
                    <span>Location: <strong className="text-purple-300">{node.locationName}</strong></span>
                    <span>{node.serversCount} Containers</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
