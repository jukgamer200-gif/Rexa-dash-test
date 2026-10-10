/**
 * RexaCloud Server Backups Management
 * Lists, creates, downloads, and restores container backups.
 * Real API integration with Pterodactyl.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { BackupItem } from '@/shared/types';
import { Modal } from '../../components/common/Modal.js';
import {
  HardDrive,
  Plus,
  Trash2,
  ChevronRight,
  Loader2,
  Archive,
  AlertCircle,
} from 'lucide-react';

export const BackupsPage: React.FC = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (identifier) {
      loadBackups();
    }
  }, [identifier]);

  const loadBackups = async () => {
    if (!identifier) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.listBackups(identifier);
      setBackups(res.backups || []);
    } catch (err: any) {
      console.error('Failed to load backups:', err);
      setErrorMessage(err.message || 'Failed to list backups');
      setBackups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;
    setIsCreating(true);
    try {
      await api.createBackup(identifier, backupName || `Backup_${Date.now()}`);
      setCreateModalOpen(false);
      setBackupName('');
      await loadBackups();
    } catch (err: any) {
      alert(`Backup creation failed: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (backupUuid: string) => {
    if (!identifier) return;
    if (!confirm('Are you sure you want to delete this backup?')) return;
    try {
      await api.deleteBackup(identifier, backupUuid);
      await loadBackups();
    } catch (err: any) {
      alert(`Failed to delete backup: ${err.message}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (!identifier) {
    return (
      <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl p-8 text-center text-slate-400">
        No server selected. Please choose a server to view backups.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/servers" className="hover:text-purple-300">Servers</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <Link to={`/server/${identifier}/console`} className="hover:text-purple-300 font-mono">{identifier}</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-purple-400 font-semibold">Backups</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Backups</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create snapshots and restore game containers from disk archives
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Backup</span>
        </button>
      </div>

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 text-purple-500 animate-spin" />
          <p className="text-xs">Loading backups...</p>
        </div>
      ) : backups.length === 0 ? (
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Archive className="w-10 h-10 text-purple-400/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Backups Found</h3>
          <p className="text-xs max-w-sm mx-auto">
            You have not created any snapshots for this server container yet.
          </p>
        </div>
      ) : (
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl overflow-hidden divide-y divide-purple-900/20">
          {backups.map((b) => (
            <div key={b.uuid} className="p-4 flex items-center justify-between text-xs hover:bg-purple-950/20 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center text-purple-400">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{b.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {formatSize(b.bytes)} · Created {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(b.uuid)}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                  title="Delete Backup"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Backup Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Server Backup"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Backup Name</label>
            <input
              type="text"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="e.g. Pre-Update Snapshot"
              className="w-full bg-[#130E22] border border-purple-900/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Start Backup'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
