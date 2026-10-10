/**
 * RexaCloud File Manager
 * Screen 3 in reference image:
 * Breadcrumbs, directory bar (/ home / container /), action buttons (Upload, New File, New Folder),
 * folder & file list, three-dots contextual menu, file editing, renaming, and deletion.
 * Communicates with live Pterodactyl Client Files API.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { ServerFile } from '@/shared/types';
import { FileEditorModal } from '../../components/files/FileEditorModal.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Upload,
  FilePlus,
  FolderPlus,
  Folder,
  FileText,
  FileCode,
  FileArchive,
  MoreVertical,
  ChevronRight,
  Loader2,
  Trash2,
  Edit3,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

export const FileManagerPage: React.FC = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const { isLoading: authLoading } = useAuth();

  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServerFile | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && identifier) {
      loadFiles(currentPath);
    }
  }, [identifier, currentPath, authLoading]);

  const loadFiles = async (dir: string) => {
    if (!identifier) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.listFiles(identifier, dir);
      setFiles(res.files || []);
    } catch (err: any) {
      console.error('Failed to list files:', err);
      setErrorMessage(err.message || 'Failed to list directory contents from Pterodactyl');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !identifier) return;
    try {
      await api.createFolder(identifier, currentPath, newFolderName.trim());
      setNewFolderOpen(false);
      setNewFolderName('');
      await loadFiles(currentPath);
    } catch (err: any) {
      alert(`Error creating folder: ${err.message}`);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || !identifier) return;
    const path = `${currentPath}/${newFileName.trim()}`.replace(/\/+/g, '/');
    try {
      await api.writeFile(identifier, path, '# New file\n');
      setNewFileOpen(false);
      setNewFileName('');
      await loadFiles(currentPath);
      setEditingFile(path);
    } catch (err: any) {
      alert(`Error creating file: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !identifier) return;
    try {
      await api.deleteFiles(identifier, currentPath, [deleteTarget.name]);
      setDeleteTarget(null);
      await loadFiles(currentPath);
    } catch (err: any) {
      alert(`Error deleting item: ${err.message}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (file: ServerFile) => {
    if (!file.isFile) return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
    if (file.name.endsWith('.jar') || file.name.endsWith('.zip') || file.name.endsWith('.tar.gz')) {
      return <FileArchive className="w-4 h-4 text-purple-400" />;
    }
    if (file.name.endsWith('.sh') || file.name.endsWith('.yml') || file.name.endsWith('.json') || file.name.endsWith('.properties')) {
      return <FileCode className="w-4 h-4 text-blue-400" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  if (!identifier) {
    return (
      <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl p-8 text-center text-slate-400">
        No server selected. Please choose a server from the server list.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/servers" className="hover:text-purple-300 transition-colors">
          Servers
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <Link to={`/server/${identifier}/console`} className="hover:text-purple-300 transition-colors font-mono">
          {identifier}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-purple-400 font-semibold">File Manager</span>
      </div>

      {/* 2. Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">File Manager</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and edit container files directly on your server host
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setNewFileOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#130E22] hover:bg-[#1c1530] text-slate-200 border border-purple-900/40 hover:border-purple-600/50 transition-colors cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5 text-purple-400" />
            <span>New File</span>
          </button>

          <button
            onClick={() => setNewFolderOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#130E22] hover:bg-[#1c1530] text-slate-200 border border-purple-900/40 hover:border-purple-600/50 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
            <span>New Folder</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. Directory Path Bar */}
      <div className="bg-[#100D1A] border border-purple-900/25 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-mono text-slate-400">
        <span className="text-purple-400 font-bold">&gt;</span>
        <button
          onClick={() => setCurrentPath('/')}
          className="hover:text-purple-300 transition-colors cursor-pointer"
        >
          / home / container
        </button>
        {currentPath !== '/' && (
          <span className="text-slate-200">{currentPath}</span>
        )}
      </div>

      {/* 4. File Listing Table */}
      <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-7 h-7 text-purple-500 animate-spin" />
            <p className="text-xs font-medium">Reading directory structure...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p>This directory is empty.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-purple-900/25 text-slate-400 font-semibold bg-[#130E22]/60">
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5 w-32">Size</th>
                <th className="py-3 px-5 w-44">Modified</th>
                <th className="py-3 px-5 w-16 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/15">
              {currentPath !== '/' && (
                <tr
                  onClick={() => {
                    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
                    setCurrentPath(parent);
                  }}
                  className="hover:bg-purple-950/20 cursor-pointer text-purple-300"
                >
                  <td colSpan={4} className="py-3 px-5 font-mono">
                    📁 .. (Parent Directory)
                  </td>
                </tr>
              )}

              {files.map((file) => (
                <tr
                  key={file.name}
                  className="hover:bg-purple-950/20 transition-colors group"
                >
                  <td className="py-3 px-5">
                    <button
                      onClick={() => {
                        if (!file.isFile) {
                          setCurrentPath(`${currentPath === '/' ? '' : currentPath}/${file.name}`);
                        } else {
                          setEditingFile(`${currentPath === '/' ? '' : currentPath}/${file.name}`);
                        }
                      }}
                      className="flex items-center gap-3 text-white hover:text-purple-300 transition-colors cursor-pointer text-left font-medium"
                    >
                      {getFileIcon(file)}
                      <span className="truncate max-w-md">{file.name}</span>
                    </button>
                  </td>
                  <td className="py-3 px-5 text-slate-400 font-mono">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="py-3 px-5 text-slate-400">
                    {file.modifiedAt || 'Recently'}
                  </td>
                  <td className="py-3 px-5 text-right relative">
                    <button
                      onClick={() =>
                        setActionMenuOpen(actionMenuOpen === file.name ? null : file.name)
                      }
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-purple-900/30 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {actionMenuOpen === file.name && (
                      <div className="absolute right-5 mt-1 w-36 bg-[#160E28] border border-purple-900/40 rounded-xl shadow-xl z-20 py-1 text-xs text-left">
                        {file.isFile && (
                          <button
                            onClick={() => {
                              setActionMenuOpen(null);
                              setEditingFile(`${currentPath === '/' ? '' : currentPath}/${file.name}`);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-purple-900/30"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                            <span>Edit File</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActionMenuOpen(null);
                            setDeleteTarget(file);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* File Editor Modal */}
      {editingFile && (
        <FileEditorModal
          isOpen={true}
          filePath={editingFile}
          serverIdentifier={identifier}
          onClose={() => {
            setEditingFile(null);
            loadFiles(currentPath);
          }}
        />
      )}

      {/* New Folder Modal */}
      <Modal
        isOpen={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="Create New Folder"
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Folder Name</label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. plugins, config"
              required
              className="w-full bg-[#130E22] border border-purple-900/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewFolderOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white"
            >
              Create Folder
            </button>
          </div>
        </form>
      </Modal>

      {/* New File Modal */}
      <Modal
        isOpen={newFileOpen}
        onClose={() => setNewFileOpen(false)}
        title="Create New File"
      >
        <form onSubmit={handleCreateFile} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">File Name</label>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. server.properties, start.sh"
              required
              className="w-full bg-[#130E22] border border-purple-900/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewFileOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white"
            >
              Create & Open
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>
              Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone on the server container.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
