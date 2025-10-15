import React, { useState } from "react";
import { Link as LinkIcon, FileText, Image as ImageIcon, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function AttachmentManager({ attachments = [], onAdd, onRemove, disabled = false }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [attachmentType, setAttachmentType] = useState("link");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError("");
      
      // Auto-set name from filename if not already set
      if (!attachmentName.trim()) {
        setAttachmentName(file.name);
      }
      
      // Convert file to base64 data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentUrl(reader.result);
      };
      reader.onerror = () => {
        setUploadError("Failed to read file");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdd = () => {
    // For links, URL is required
    if (attachmentType === "link") {
      if (!attachmentUrl.trim()) {
        setUploadError("URL is required for links");
        return;
      }
      // Validate URL format
      try {
        new URL(attachmentUrl.trim());
      } catch {
        setUploadError("Please enter a valid URL (e.g., https://example.com)");
        return;
      }
    }

    // For images/documents, either file or URL is required
    if ((attachmentType === "image" || attachmentType === "document") && !attachmentUrl && !selectedFile) {
      setUploadError("Please upload a file or provide a URL");
      return;
    }

    // Auto-generate name from URL if not provided
    let finalName = attachmentName.trim();
    if (!finalName) {
      if (selectedFile) {
        finalName = selectedFile.name;
      } else if (attachmentUrl.trim()) {
        try {
          const urlObj = new URL(attachmentUrl.trim());
          const pathname = urlObj.pathname;
          finalName = pathname.split('/').pop() || urlObj.hostname || "Unnamed";
        } catch {
          finalName = "Unnamed Attachment";
        }
      } else {
        finalName = "Unnamed Attachment";
      }
    }

    const newAttachment = {
      type: attachmentType,
      name: finalName,
      url: attachmentUrl.trim() || "",
      mime_type: selectedFile ? selectedFile.type : getMimeType(attachmentType, attachmentUrl),
      size: selectedFile ? selectedFile.size : null,
      created_at: new Date().toISOString(),
    };

    onAdd(newAttachment);
    
    // Reset form
    setAttachmentName("");
    setAttachmentUrl("");
    setSelectedFile(null);
    setUploadError("");
    setShowAddForm(false);
  };

  const getMimeType = (type, url) => {
    if (type === "link") return "text/html";
    if (type === "image") {
      if (url.endsWith(".png")) return "image/png";
      if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
      if (url.endsWith(".gif")) return "image/gif";
      return "image/jpeg";
    }
    if (type === "document") {
      if (url.endsWith(".pdf")) return "application/pdf";
      if (url.endsWith(".doc") || url.endsWith(".docx")) return "application/msword";
      return "application/pdf";
    }
    return "text/html";
  };

  const getIcon = (type) => {
    switch (type) {
      case "image":
        return <ImageIcon size={14} className="text-purple-400" />;
      case "document":
        return <FileText size={14} className="text-blue-400" />;
      case "link":
      default:
        return <LinkIcon size={14} className="text-green-400" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">Attachments</Label>
        {!showAddForm && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
            disabled={disabled}
            className="text-xs h-7"
          >
            + Add Attachment
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="attachment-type" className="text-xs mb-1 block">
                Type
              </Label>
              <Select value={attachmentType} onValueChange={setAttachmentType}>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">🔗 Link</SelectItem>
                  <SelectItem value="document">📄 Document</SelectItem>
                  <SelectItem value="image">🖼️ Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="attachment-name" className="text-xs mb-1 block">
              Name <span className="text-gray-400">(optional)</span>
            </Label>
            <Input
              id="attachment-name"
              type="text"
              placeholder={selectedFile ? selectedFile.name : "Auto-generated from file/URL"}
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              className="text-xs h-8"
              maxLength={100}
            />
          </div>

          {attachmentType === "link" ? (
            <div>
              <Label htmlFor="attachment-url" className="text-xs mb-1 block">
                URL
              </Label>
              <Input
                id="attachment-url"
                type="url"
                placeholder="https://..."
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="text-xs h-8"
              />
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="attachment-file" className="text-xs mb-1 block">
                  Upload {attachmentType === "image" ? "Image" : "Document"}
                </Label>
                <Input
                  id="attachment-file"
                  type="file"
                  accept={attachmentType === "image" ? "image/*" : ".pdf,.doc,.docx,.txt"}
                  onChange={handleFileChange}
                  className="text-xs h-8"
                />
                {selectedFile && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="attachment-url-alt" className="text-xs mb-1 block">
                  Or provide URL <span className="text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="attachment-url-alt"
                  type="url"
                  placeholder="https://..."
                  value={attachmentUrl && !attachmentUrl.startsWith('data:') ? attachmentUrl : ''}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="text-xs h-8"
                  disabled={!!selectedFile}
                />
              </div>
            </>
          )}

          {uploadError && (
            <p className="text-[10px] text-red-600">{uploadError}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setAttachmentName("");
                setAttachmentUrl("");
                setSelectedFile(null);
                setUploadError("");
              }}
              className="text-xs h-7"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={attachmentType === "link" ? !attachmentUrl.trim() : (!selectedFile && !attachmentUrl.trim())}
              className="text-xs h-7"
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {attachments.map((att, index) => (
            <div
              key={att.id || index}
              className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getIcon(att.type)}
                {att.type === "link" ? (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate flex items-center gap-1"
                    title={att.name}
                  >
                    {att.name}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-xs text-gray-700 truncate" title={att.name}>
                    {att.name}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(att.id || index)}
                disabled={disabled}
                className="text-red-500 hover:text-red-700 p-1"
                title="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && !showAddForm && (
        <p className="text-xs text-gray-400 italic">No attachments</p>
      )}
    </div>
  );
}
