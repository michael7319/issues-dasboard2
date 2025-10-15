import React from 'react';

const getAttachmentIcon = (type) => {
  switch (type) {
    case 'link':
      return '🔗';
    case 'image':
      return '🖼️';
    case 'document':
      return '📄';
    default:
      return '📎';
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export default function AttachmentList({ attachments, taskId, onAttachmentRemoved, isCompact = false }) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className={isCompact ? "space-y-1" : "mt-3 space-y-2"}>
      {!isCompact && (
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Attachments ({attachments.length})
        </div>
      )}
      <div className="space-y-1">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className={`rounded-md transition-colors ${
              isCompact 
                ? "p-1 bg-gray-700/20 border border-gray-600 hover:border-gray-500" 
                : "p-2 bg-gray-800 border border-gray-700 hover:border-gray-600"
            }`}
          >
            {/* Image Preview */}
            {attachment.type === 'image' && !isCompact && (
              <div className="mb-2">
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="max-w-full h-32 object-cover rounded border border-gray-600"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <div className="hidden text-xs text-gray-500 italic">
                  Image preview not available
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span className={isCompact ? "text-[10px]" : "text-lg"}>
                  {getAttachmentIcon(attachment.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-blue-400 hover:text-blue-300 font-medium truncate block ${
                      isCompact ? "text-[9px]" : "text-sm"
                    }`}
                    title={attachment.name}
                  >
                    {attachment.name}
                  </a>
                  {!isCompact && attachment.size && (
                    <div className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)}
                    </div>
                  )}
                </div>
              </div>
              {onAttachmentRemoved && (
                <button
                  onClick={() => onAttachmentRemoved(attachment.id)}
                  className={`text-red-400 hover:text-red-300 rounded ${
                    isCompact ? "p-0.5 text-[8px]" : "p-1"
                  }`}
                  title="Remove attachment"
                >
                  {isCompact ? (
                    "✕"
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}