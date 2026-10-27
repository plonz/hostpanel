import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  FileCode,
  FileText,
  FileArchive,
  Image as ImageIcon,
  ArrowUp,
  Download,
  Trash2,
  Edit,
  FolderPlus,
  FilePlus,
  Upload,
  RefreshCw,
  Search,
  HardDrive,
  Save,
  X,
  Archive,
  Check,
  AlertTriangle
} from 'lucide-react';
import { api, formatBytes } from '../api';

export default function FileManagerView({ initialPath }) {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [parentPath, setParentPath] = useState(null);
  const [items, setItems] = useState([]);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pathInput, setPathInput] = useState(initialPath || '');

  // Modals
  const [editorFile, setEditorFile] = useState(null); // { path, name, content }
  const [editorSaving, setEditorSaving] = useState(false);
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameModal, setRenameModal] = useState(null); // { item, newName }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // item
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState(null);

  const fileInputRef = useRef(null);

  const showNotification = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadDirectory = async (targetPath = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFiles(targetPath);
      setCurrentPath(data.currentPath);
      setPathInput(data.currentPath);
      setParentPath(data.parentPath);
      setItems(data.items || []);
      setDrives(data.drives || []);
    } catch (err) {
      setError(err.message);
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(initialPath || '');
  }, [initialPath]);

  // Filtered files
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenFolder = (folderPath) => {
    loadDirectory(folderPath);
  };

  const handleOpenFile = async (fileItem) => {
    if (!fileItem.isText) {
      // If not text, trigger download
      window.open(api.getDownloadUrl(fileItem.path), '_blank');
      return;
    }

    try {
      setLoading(true);
      const data = await api.readFile(fileItem.path);
      setEditorFile(data);
    } catch (err) {
      showNotification(`Failed to open file: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditor = async () => {
    if (!editorFile) return;
    setEditorSaving(true);
    try {
      await api.saveFile(editorFile.path, editorFile.content);
      showNotification('File saved successfully!');
    } catch (err) {
      showNotification(`Failed to save: ${err.message}`, true);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleCreateFile = async (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    try {
      await api.createFile(currentPath, newFileName.trim());
      setNewFileModal(false);
      setNewFileName('');
      showNotification('File created successfully!');
      loadDirectory(currentPath);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.createFolder(currentPath, newFolderName.trim());
      setNewFolderModal(false);
      setNewFolderName('');
      showNotification('Folder created successfully!');
      loadDirectory(currentPath);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameModal || !renameModal.newName.trim()) return;
    const oldPath = renameModal.item.path;
    // Calculate new full path
    const parentDir = currentPath;
    const separator = currentPath.includes('/') ? '/' : '\\';
    const newPath = `${parentDir.replace(/[\\/]$/, '')}${separator}${renameModal.newName.trim()}`;

    try {
      await api.renameItem(oldPath, newPath);
      setRenameModal(null);
      showNotification('Renamed successfully!');
      loadDirectory(currentPath);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deleteItem(deleteConfirm.path);
      setDeleteConfirm(null);
      showNotification('Item deleted successfully!');
      loadDirectory(currentPath);
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleExtract = async (item) => {
    try {
      setLoading(true);
      await api.extractZip(item.path, currentPath);
      showNotification('Extracted successfully!');
      loadDirectory(currentPath);
    } catch (err) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCompress = async (item) => {
    try {
      setLoading(true);
      await api.compressZip(item.path);
      showNotification('Compressed to zip successfully!');
      loadDirectory(currentPath);
    } catch (err) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      await api.uploadFiles(currentPath, files);
      showNotification(`Uploaded ${files.length} file(s) successfully!`);
      loadDirectory(currentPath);
    } catch (err) {
      showNotification(`Upload failed: ${err.message}`, true);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getItemIcon = (item) => {
    if (item.isDirectory) return <Folder className="w-5 h-5 text-amber-400" />;
    if (item.isArchive) return <FileArchive className="w-5 h-5 text-purple-400" />;
    if (item.isImage) return <ImageIcon className="w-5 h-5 text-rose-400" />;
    if (item.isText) return <FileCode className="w-5 h-5 text-cyan-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition animate-fade-in ${notification.isError ? 'bg-rose-950 border border-rose-500/50 text-rose-200' : 'bg-emerald-950 border border-emerald-500/50 text-emerald-200'}`}>
          {notification.isError ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <Check className="w-4 h-4 text-emerald-400" />}
          {notification.msg}
        </div>
      )}

      {/* Top Bar: Path & Controls */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-4 shadow-md space-y-3">
        {/* Drives bar (if multiple) */}
        {drives.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-300 pb-2 border-b border-slate-700/50">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">Drives:</span>
            {drives.map(drive => (
              <button
                key={drive}
                onClick={() => loadDirectory(drive)}
                className={`px-2.5 py-1 rounded font-mono font-medium transition ${currentPath.startsWith(drive) ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
              >
                {drive}
              </button>
            ))}
          </div>
        )}

        {/* Path Input & Go */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => parentPath && loadDirectory(parentPath)}
            disabled={!parentPath}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 text-slate-200 transition"
            title="Up one level"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <form
            onSubmit={(e) => { e.preventDefault(); loadDirectory(pathInput); }}
            className="flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
          >
            <span className="pl-3 text-slate-500 font-mono text-sm">Path:</span>
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-200 font-mono outline-none"
              placeholder="Enter absolute directory path..."
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border-l border-slate-700 transition"
            >
              Go
            </button>
          </form>

          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
            title="Refresh directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setNewFileModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition"
            >
              <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
              New File
            </button>
            <button
              onClick={() => setNewFolderModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              New Folder
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium cursor-pointer transition">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Upload Files'}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {/* Search in current folder */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in folder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 w-48 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* File List Table */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/60 text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 w-28">Size</th>
                <th className="py-3 px-4 w-44">Last Modified</th>
                <th className="py-3 px-4 w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40 text-slate-300">
              {/* Parent directory shortcut */}
              {parentPath && (
                <tr
                  onClick={() => loadDirectory(parentPath)}
                  className="hover:bg-slate-700/40 cursor-pointer transition select-none"
                >
                  <td className="py-2.5 px-4 flex items-center gap-2 font-medium text-slate-400">
                    <ArrowUp className="w-4 h-4 text-slate-500" />
                    <span>.. (Parent Directory)</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">-</td>
                  <td className="py-2.5 px-4 text-slate-500">-</td>
                  <td className="py-2.5 px-4 text-right"></td>
                </tr>
              )}

              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500">
                    {searchQuery ? 'No files match your search filter' : 'This folder is empty'}
                  </td>
                </tr>
              )}

              {filteredItems.map((item) => (
                <tr
                  key={item.path}
                  className="hover:bg-slate-700/30 transition group select-none"
                >
                  <td
                    className="py-2.5 px-4 cursor-pointer font-medium"
                    onClick={() => item.isDirectory ? handleOpenFolder(item.path) : handleOpenFile(item)}
                  >
                    <div className="flex items-center gap-2.5">
                      {getItemIcon(item)}
                      <span className={`truncate max-w-md ${item.isDirectory ? 'text-amber-200 hover:text-amber-100 font-semibold' : 'text-slate-200 hover:text-cyan-400'}`}>
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 font-mono">
                    {item.isDirectory ? '-' : formatBytes(item.size)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">
                    {item.modifiedAt ? new Date(item.modifiedAt).toLocaleString() : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
                      {item.isText && (
                        <button
                          onClick={() => handleOpenFile(item)}
                          className="p-1.5 rounded hover:bg-slate-600 text-slate-300 hover:text-cyan-400 transition"
                          title="Edit Code"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!item.isDirectory && (
                        <a
                          href={api.getDownloadUrl(item.path)}
                          download={item.name}
                          className="p-1.5 rounded hover:bg-slate-600 text-slate-300 hover:text-emerald-400 transition"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {item.isArchive && (
                        <button
                          onClick={() => handleExtract(item)}
                          className="p-1.5 rounded hover:bg-slate-600 text-slate-300 hover:text-purple-400 transition"
                          title="Extract Zip"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleCompress(item)}
                        className="p-1.5 rounded hover:bg-slate-600 text-slate-300 hover:text-indigo-400 transition"
                        title="Compress to Zip"
                      >
                        <FileArchive className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setRenameModal({ item, newName: item.name })}
                        className="p-1.5 rounded hover:bg-slate-600 text-slate-300 hover:text-amber-400 transition"
                        title="Rename"
                      >
                        <span className="text-xs font-semibold px-1">ab</span>
                      </button>

                      <button
                        onClick={() => setDeleteConfirm(item)}
                        className="p-1.5 rounded hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Editor Modal */}
      {editorFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileCode className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-white truncate">{editorFile.name}</span>
                <span className="text-xs text-slate-400 font-mono truncate hidden sm:inline">({editorFile.path})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEditor}
                  disabled={editorSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
                >
                  <Save className={`w-3.5 h-3.5 ${editorSaving ? 'animate-spin' : ''}`} />
                  {editorSaving ? 'Saving...' : 'Save (Ctrl+S)'}
                </button>
                <button
                  onClick={() => setEditorFile(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Code Textarea Area */}
            <div className="flex-1 bg-slate-950 p-4 font-mono text-xs overflow-auto flex">
              <textarea
                value={editorFile.content}
                onChange={(e) => setEditorFile({ ...editorFile, content: e.target.value })}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    handleSaveEditor();
                  }
                }}
                className="w-full h-full bg-transparent text-slate-200 outline-none resize-none font-mono text-sm leading-relaxed"
                spellCheck="false"
              />
            </div>
            <div className="px-5 py-2 bg-slate-800/80 border-t border-slate-700 text-xs text-slate-400 flex justify-between">
              <span>Lines: {editorFile.content.split('\n').length}</span>
              <span>Size: {formatBytes(editorFile.content.length)}</span>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {newFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateFile} className="bg-slate-800 border border-slate-700 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <FilePlus className="w-4 h-4 text-cyan-400" />
              Create New File
            </h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">File Name</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. index.js, app.py, .env"
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setNewFileModal(false); setNewFileName(''); }}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-medium transition"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Folder Modal */}
      {newFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateFolder} className="bg-slate-800 border border-slate-700 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-amber-400" />
              Create New Folder
            </h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. my-project, src, static"
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setNewFolderModal(false); setNewFolderName(''); }}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-medium transition"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRename} className="bg-slate-800 border border-slate-700 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Rename Item</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">New Name</label>
              <input
                type="text"
                value={renameModal.newName}
                onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameModal(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-medium transition"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-semibold text-white">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white font-mono">{deleteConfirm.name}</strong>?
              {deleteConfirm.isDirectory && ' All contents inside this directory will be permanently removed.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs text-white font-medium transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
