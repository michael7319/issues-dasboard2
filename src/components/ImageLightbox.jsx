import React from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";

export default function ImageLightbox({ imageUrl, imageName, isOpen, onClose }) {
  if (!isOpen) return null;

  // Render the lightbox at the root level using a portal
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors z-10"
        title="Close"
      >
        <X size={24} />
      </button>
      
      <div
        className="relative max-w-[70vw] max-h-[70vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={imageName || "Image preview"}
          className="max-w-full max-h-[calc(70vh-60px)] object-contain rounded-lg shadow-2xl"
          onError={(e) => {
            e.target.src = `data:image/svg+xml,${encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="#374151" width="400" height="300"/><text fill="#9CA3AF" font-family="Arial" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">Image failed to load</text></svg>'
            )}`;
          }}
        />
        {imageName && (
          <p className="mt-4 text-white text-sm bg-gray-800 px-4 py-2 rounded-lg">
            {imageName}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
