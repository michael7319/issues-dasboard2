import React, { useState, useEffect, useRef } from "react";
import { X, Edit2, Trash2, Link as LinkIcon, FileText, Image as ImageIcon, Clock, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ImageLightbox from "./ImageLightbox";

// Helper to parse assignees safely
const parseAssignees = (assignees) => {
  if (!assignees) return [];
  if (typeof assignees === 'string') {
    try {
      return JSON.parse(assignees);
    } catch (e) {
      console.warn("Failed to parse assignees:", assignees);
      return [];
    }
  }
  if (Array.isArray(assignees)) return assignees;
  return [];
};

export default function TaskViewModal({ task, users, isOpen, onClose, onEdit, onDelete, onTaskUpdate }) {
  const [lightboxImage, setLightboxImage] = useState(null);
  const lightboxClosingRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState("--:--");
  const [expired, setExpired] = useState(false);
  const [localTask, setLocalTask] = useState(task);

  // Sync local task with prop
  useEffect(() => {
    setLocalTask(task);
  }, [task]);

  // Reset lightbox when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLightboxImage(null);
    }
  }, [isOpen]);

  // Live countdown logic
  useEffect(() => {
    if (!task || !task.schedule) {
      setTimeLeft("--:--");
      setExpired(false);
      return;
    }

    let schedule = null;
    try {
      schedule = typeof task.schedule === 'string' ? JSON.parse(task.schedule) : task.schedule;
    } catch (e) {
      console.error("Failed to parse schedule:", e);
      setTimeLeft("--:--");
      setExpired(false);
      return;
    }

    if (schedule?.mode === "countdown" && schedule.countdownSeconds) {
      const start = new Date(schedule.countdownStartAt || new Date());
      const end = new Date(start.getTime() + schedule.countdownSeconds * 1000);

      const update = () => {
        const now = new Date();
        const diffMs = end - now;

        if (diffMs <= 0) {
          setTimeLeft("TIME UP");
          setExpired(true);
          return;
        }

        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
        setExpired(false);
      };

      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft("--:--");
      setExpired(false);
    }
  }, [task]);
  
  // Early return if no task - prevents any rendering or calculations
  if (!localTask || !isOpen) return null;

  // Get user details
  const mainAssignee = users.find((u) => u.id === Number(localTask.mainAssigneeId || localTask.main_assignee_id));
  const supportingAssigneeIds = parseAssignees(localTask.supportingAssignees || localTask.supporting_assignees);
  const supportingAssignees = supportingAssigneeIds
    .map((id) => users.find((u) => u.id === Number(id)))
    .filter(Boolean);

  // Parse schedule
  let schedule = null;
  try {
    schedule = localTask.schedule ? (typeof localTask.schedule === 'string' ? JSON.parse(localTask.schedule) : localTask.schedule) : null;
  } catch (e) {
    console.error("Failed to parse schedule:", e);
  }

  // Get due date display with live countdown
  const getDueDisplay = () => {
    if (!schedule) return null;

    // Countdown mode - use live timeLeft
    if (schedule.mode === "countdown") {
      return timeLeft;
    }
    
    // One-time due date
    if (schedule.dueAt) {
      const dueDate = new Date(schedule.dueAt);
      if (dueDate < new Date()) return "TIME UP";
      return dueDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    
    // N-day repeat logic
    if (schedule.repeatDays && schedule.dueTime) {
      const now = new Date();
      const created = new Date(localTask.createdAt || localTask.created_at || now);
      const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      const cycleDay = daysSince % schedule.repeatDays;
      const [hour, minute] = schedule.dueTime.split(":").map(Number);
      const dueToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
      if (cycleDay === 0 && now > dueToday) {
        return "TIME UP";
      }
      return `Every ${schedule.repeatDays} days @ ${schedule.dueTime}`;
    }
    
    // Only day picked, expires after N days
    if (schedule.expiresInDays) {
      const created = new Date(localTask.createdAt || localTask.created_at || new Date());
      const expires = new Date(created.getTime() + schedule.expiresInDays * 24 * 60 * 60 * 1000);
      if (new Date() > expires) {
        return "TIME UP";
      }
      return `Expires in ${schedule.expiresInDays} day${schedule.expiresInDays > 1 ? "s" : ""}`;
    }
    
    return null;
  };

  const dueDisplay = getDueDisplay();

  // Priority colors
  const priorityColors = {
    High: "bg-red-500/20 text-red-400 border-red-500",
    Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
    Low: "bg-green-500/20 text-green-400 border-green-500",
  };

  const handleLightboxClose = () => {
    lightboxClosingRef.current = true;
    setLightboxImage(null);
    // Reset the flag after a brief delay
    setTimeout(() => {
      lightboxClosingRef.current = false;
    }, 100);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        // Ignore close events triggered while closing the lightbox
        if (!open && lightboxClosingRef.current) {
          return;
        }
        onClose();
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar-modal bg-gray-800 text-white border-gray-700">
          <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="text-2xl font-bold text-white pr-8">
              {localTask.title}
            </DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(localTask)}
                className="hover:bg-gray-700"
                title="Edit Task"
              >
                <Edit2 size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="hover:bg-red-900/50 text-red-400"
                title="Delete Task"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Priority and Type */}
          <div className="flex gap-3 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                priorityColors[localTask.priority] || "bg-gray-700 text-gray-300 border-gray-600"
              }`}
            >
              {localTask.priority} Priority
            </span>
            <span className="px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-400 border border-blue-500">
              {localTask.type}
            </span>
            {localTask.completed && (
              <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-500">
                ✓ Completed
              </span>
            )}
            {localTask.archived && (
              <span className="px-3 py-1 rounded-full text-sm bg-gray-600/50 text-gray-400 border border-gray-600">
                Archived
              </span>
            )}
          </div>

          {/* Description */}
          {localTask.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Description</h3>
              <p className="text-gray-200 whitespace-pre-wrap">{localTask.description}</p>
            </div>
          )}

          {/* Schedule/Due Date */}
          {dueDisplay && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                <Clock size={16} />
                {schedule?.mode === "countdown" ? "Countdown" : "Due Date"}
              </h3>
              <p className={`text-lg font-mono ${dueDisplay === "TIME UP" || expired ? "text-red-500 font-bold" : "text-gray-200"}`}>
                {dueDisplay}
              </p>
            </div>
          )}

          {/* Assignees */}
          {(mainAssignee || supportingAssignees.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Assignees</h3>
              <div className="flex flex-wrap gap-2">
                {mainAssignee && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-full">
                    <span className="text-xs font-semibold">
                      {mainAssignee.initials}
                    </span>
                    <span className="text-sm">{mainAssignee.fullName}</span>
                    <span className="text-xs text-blue-200">(Main)</span>
                  </div>
                )}
                {supportingAssignees.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 rounded-full"
                  >
                    <span className="text-xs font-semibold">
                      {user.initials}
                    </span>
                    <span className="text-sm">{user.fullName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {localTask.attachments && localTask.attachments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Attachments</h3>
              
              {/* Images - Show larger previews */}
              {localTask.attachments.filter(att => att.type === "image" && att.url).length > 0 && (
                <div className="space-y-3 mb-4">
                  {localTask.attachments
                    .filter(att => att.type === "image" && att.url)
                    .map((att, index) => (
                      <div key={att.id || `img-${index}`} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <ImageIcon size={16} className="text-purple-400" />
                          <span>{att.name || 'Image'}</span>
                        </div>
                        <div
                          onClick={() => setLightboxImage({ url: att.url, name: att.name })}
                          className="block rounded-lg overflow-hidden border border-gray-600 hover:border-purple-500 cursor-pointer transition-colors"
                        >
                          <img
                            src={att.url}
                            alt={att.name || 'attachment'}
                            className="w-full h-auto max-h-96 object-contain bg-gray-900"
                            onError={(e) => {
                              e.target.parentElement.innerHTML = `
                                <div class="w-full h-48 bg-gray-700 flex items-center justify-center text-gray-400">
                                  <div class="text-center">
                                    <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                    <p>Failed to load image</p>
                                  </div>
                                </div>
                              `;
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Links and Documents */}
              {localTask.attachments.filter(att => (att.type === "link" || att.type === "document") && att.url).length > 0 && (
                <div className="space-y-2">
                  {localTask.attachments
                    .filter(att => (att.type === "link" || att.type === "document") && att.url)
                    .map((att, index) => {
                      const isUploadedFile = att.url.startsWith('data:');
                      return (
                        <a
                          key={att.id || `att-${index}`}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.type === "document" && isUploadedFile ? att.name : undefined}
                          className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          {att.type === "link" && <LinkIcon size={20} className="text-green-400" />}
                          {att.type === "document" && <FileText size={20} className="text-blue-400" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{att.name || 'Untitled'}</p>
                            {att.size && (
                              <p className="text-xs text-gray-400">
                                {typeof att.size === 'number' ? `${(att.size / 1024).toFixed(1)} KB` : att.size}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {att.type === "document" && isUploadedFile ? "Download" : "Open"}
                          </span>
                        </a>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Subtasks */}
          {localTask.subtasks && localTask.subtasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">
                Subtasks ({localTask.subtasks.filter(s => s.completed).length}/{localTask.subtasks.length})
              </h3>
              <div className="space-y-2">
                {localTask.subtasks.map((subtask) => {
                  const subMainAssignee = users.find((u) => u.id === subtask.mainAssigneeId);
                  const subSupportingAssignees = subtask.supportingAssignees
                    ? JSON.parse(subtask.supportingAssignees)
                        .map((id) => users.find((u) => u.id === id))
                        .filter(Boolean)
                    : [];

                  // Parse subtask schedule for countdown/due date display
                  let subSchedule = null;
                  let subDueDisplay = null;
                  if (subtask.schedule) {
                    try {
                      subSchedule = typeof subtask.schedule === 'string' 
                        ? JSON.parse(subtask.schedule) 
                        : subtask.schedule;
                      
                      // Calculate due display for subtask
                      if (subSchedule.mode === "countdown" && subSchedule.countdownSeconds) {
                        const start = new Date(subSchedule.countdownStartAt || new Date());
                        const end = new Date(start.getTime() + subSchedule.countdownSeconds * 1000);
                        const now = new Date();
                        const diffMs = end - now;
                        
                        if (diffMs <= 0) {
                          subDueDisplay = "TIME UP";
                        } else {
                          const hours = Math.floor(diffMs / (1000 * 60 * 60));
                          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                          const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                          subDueDisplay = `${hours}h ${minutes}m ${seconds}s`;
                        }
                      } else if (subSchedule.dueAt) {
                        const dueDate = new Date(subSchedule.dueAt);
                        if (dueDate < new Date()) {
                          subDueDisplay = "TIME UP";
                        } else {
                          subDueDisplay = dueDate.toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          });
                        }
                      }
                    } catch (e) {
                      console.warn("Failed to parse subtask schedule:", e);
                    }
                  }

                  return (
                    <div
                      key={subtask.id}
                      className={`p-3 rounded-lg border ${
                        subtask.completed
                          ? "bg-green-900/20 border-green-700"
                          : "bg-gray-700 border-gray-600"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={async () => {
                            try {
                              const API_BASE = `http://${window.location.hostname}:8080`;
                              const response = await fetch(`${API_BASE}/tasks/${localTask.id}/subtasks/${subtask.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ completed: !subtask.completed })
                              });
                              
                              if (response.ok) {
                                // Update local state
                                const updatedSubtasks = localTask.subtasks.map(s => 
                                  s.id === subtask.id ? { ...s, completed: !s.completed } : s
                                );
                                const updatedTask = { ...localTask, subtasks: updatedSubtasks };
                                setLocalTask(updatedTask);
                                
                                // Notify parent to update the task list
                                if (onTaskUpdate) {
                                  onTaskUpdate(updatedTask);
                                }
                              }
                            } catch (err) {
                              console.error('Failed to toggle subtask:', err);
                            }
                          }}
                          className="mt-1 w-4 h-4 accent-green-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`${subtask.completed ? "line-through text-gray-400" : ""} break-words`}>
                            {subtask.title}
                          </p>
                          
                          {/* Subtask Schedule/Due Date */}
                          {subDueDisplay && (
                            <div className="flex items-center gap-1 mt-1">
                              <Clock size={12} className="text-gray-400" />
                              <span className={`text-xs ${subDueDisplay === "TIME UP" ? "text-red-400 font-semibold" : "text-gray-400"}`}>
                                {subDueDisplay}
                              </span>
                            </div>
                          )}
                          
                          {/* Assignees */}
                          {(subMainAssignee || subSupportingAssignees.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {subMainAssignee && (
                                <span className="text-xs px-2 py-0.5 bg-blue-600 rounded">
                                  {subMainAssignee.name}
                                </span>
                              )}
                              {subSupportingAssignees.map((user) => (
                                <span key={user.id} className="text-xs px-2 py-0.5 bg-gray-600 rounded">
                                  {user.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Delete button */}
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={async () => {
                              try {
                                const API_BASE = `http://${window.location.hostname}:8080`;
                                const response = await fetch(`${API_BASE}/tasks/${localTask.id}/subtasks/${subtask.id}`, {
                                  method: 'DELETE'
                                });
                                
                                if (response.ok) {
                                  // Update local state by removing the subtask
                                  const updatedSubtasks = localTask.subtasks.filter(s => s.id !== subtask.id);
                                  const updatedTask = { ...localTask, subtasks: updatedSubtasks };
                                  setLocalTask(updatedTask);
                                  
                                  // Notify parent to update the task list
                                  if (onTaskUpdate) {
                                    onTaskUpdate(updatedTask);
                                  }
                                }
                              } catch (err) {
                                console.error('Failed to delete subtask:', err);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete subtask"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Created Date */}
          <div className="text-xs text-gray-400">
            Created: {new Date(localTask.createdAt).toLocaleString()}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Image Lightbox */}
    <ImageLightbox
      imageUrl={lightboxImage?.url}
      imageName={lightboxImage?.name}
      isOpen={!!lightboxImage}
      onClose={handleLightboxClose}
    />
    </>
  );
}
