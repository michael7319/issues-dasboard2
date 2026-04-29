import React, { useState, useRef } from "react";
import { Link as LinkIcon, FileText, X, ExternalLink, Loader2 } from "lucide-react";
import { compressVideo, isVideoFile, validateFileSize, needsCompression, formatFileSize } from "@/lib/videoCompressor";
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
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setSelectedFile(null);
    setCompressionProgress(0);

    // Validate size limits before doing anything else
    const sizeError = validateFileSize(file);
    if (sizeError) {
      setUploadError(sizeError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!attachmentName.trim()) {
      setAttachmentName(file.name);
    }

    // Auto-compress videos that exceed the 20 MB limit
    if (needsCompression(file)) {
      setIsCompressing(true);
      setCompressionProgress(1);
      try {
        const compressed = await compressVideo(file, setCompressionProgress);
        setSelectedFile(compressed);
        // Update the displayed name to reflect the compressed file
        setAttachmentName((prev) => prev || compressed.name);
      } catch (err) {
        setUploadError(err.message);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        setIsCompressing(false);
      }
      return;
    }

    setSelectedFile(file);
  };

  const handleAdd = () => {
    if (attachmentType === "link") {
      if (!attachmentUrl.trim()) {
        setUploadError("URL is required for links");
        return;
      }
      // Auto-prepend https:// if no scheme provided
      let finalUrl = attachmentUrl.trim();
      if (!/^https?:\/\//i.test(finalUrl) && !/^ftp:\/\//i.test(finalUrl)) {
        finalUrl = "https://" + finalUrl;
      }
      try {
        new URL(finalUrl);
      } catch {
        setUploadError("Please enter a valid URL");
        return;
      }
      setAttachmentUrl(finalUrl);
    }

    if (attachmentType === "file" && !selectedFile) {
      setUploadError("Please select a file to upload");
      return;
    }

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
      url: attachmentType === "link" ? ((() => {
        let u = attachmentUrl.trim();
        if (!/^https?:\/\//i.test(u) && !/^ftp:\/\//i.test(u)) u = "https://" + u;
        return u;
      })()) : "",
      mime_type: selectedFile ? selectedFile.type : "text/html",
      size: selectedFile ? selectedFile.size : null,
      created_at: new Date().toISOString(),
      // Pass raw File object so App.jsx can upload it to the file server
      _file: attachmentType === "file" ? selectedFile : undefined,
    };

    onAdd(newAttachment);

    // Reset form
    setAttachmentName("");
    setAttachmentUrl("");
    setSelectedFile(null);
    setUploadError("");
    setShowAddForm(false);
  };

  const getIcon = (type) => {
    if (type === "link") return <LinkIcon size={14} className="text-green-400" />;
    return <FileText size={14} className="text-blue-400" />;
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
            disabled={disabled || isCompressing}
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
                  <SelectItem value="file">📁 Upload File</SelectItem>
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
            <div>
              <Label htmlFor="attachment-file" className="text-xs mb-1 block">
                Upload File
              </Label>
              <Input
                id="attachment-file"
                ref={fileInputRef}
                type="file"
                accept="*/*"
                onChange={handleFileChange}
                disabled={isCompressing}
                className="text-xs h-8"
              />
              {/* Compression progress bar */}
              {isCompressing && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] text-blue-600">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Compressing video… {compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Large videos are compressed to under 20 MB before upload.
                  </p>
                </div>
              )}
              {selectedFile && !isCompressing && (
                <p className="text-[10px] text-gray-500 mt-1">
                  {selectedFile.name.includes("_compressed")
                    ? `✓ Compressed: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                    : `Selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`}
                </p>
              )}
            </div>
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
                setIsCompressing(false);
                setCompressionProgress(0);
              }}
              disabled={isCompressing}
              className="text-xs h-7"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={isCompressing || (attachmentType === "link" ? !attachmentUrl.trim() : !selectedFile)}
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
