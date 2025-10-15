import React, { useState } from 'react';

export default function AddAttachment({ taskId, onAttachmentAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('link');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsLoading(true);
    try {
      const API_BASE = `http://${window.location.hostname}:8080`;
      const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          name: name.trim(),
          url: url.trim(),
        }),
      });

      if (response.ok) {
        const newAttachment = await response.json();
        onAttachmentAdded(newAttachment);
        setName('');
        setUrl('');
        setShowForm(false);
      }
    } catch (error) {
      console.error('Error adding attachment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setUrl('');
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
      >
        <span>📎</span>
        <span>Add Attachment</span>
      </button>
    );
  }

  return (
    <div className="border border-gray-600 rounded-md p-4 bg-gray-800">
      <h4 className="text-sm font-medium text-gray-200 mb-3">Add Attachment</h4>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="link">🔗 Link</option>
            <option value="document">📄 Document</option>
            <option value="image">🖼️ Image</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter attachment name..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={type === 'link' ? 'https://example.com' : 'https://example.com/file.pdf'}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div className="flex space-x-2 pt-2">
          <button
            type="submit"
            disabled={isLoading || !name.trim() || !url.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
          >
            {isLoading ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}