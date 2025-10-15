import React, { useState, useEffect } from "react";
import users from "../data/users";
import { Pencil, Trash2, Plus, Archive, Pin, Link as LinkIcon, FileText, Image as ImageIcon } from "lucide-react";
import ImageLightbox from "./ImageLightbox";

const priorityBorderColors = {
  High: "border-red-500 text-red-600",
  Medium: "border-yellow-500 text-yellow-600",
  Low: "border-green-500 text-green-600",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Helper to format dates safely
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Parse schedule from JSON string or object
const parseSchedule = (schedule) => {
  if (!schedule) return null;
  if (typeof schedule === 'string') {
    try {
      return JSON.parse(schedule);
    } catch (e) {
      console.warn("Failed to parse schedule:", schedule);
      return null;
    }
  }
  return schedule;
};

// Parse assignees from JSON string or array
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

// Real hook only for countdowns
const useCountdown = (item) => {
  const [timeLeft, setTimeLeft] = useState("--:--");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (item?.schedule?.mode === "countdown" && item.schedule.countdownSeconds) {
      const start = new Date(item.schedule.countdownStartAt || new Date());
      const end = new Date(start.getTime() + item.schedule.countdownSeconds * 1000);

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
  }, [item]);

  return { timeLeft, expired };
};

// Pure formatter (no hooks)
const getDueDisplay = (item, countdownValue) => {
  if (!item) return "--:--";

  // Countdown mode
  if (item.schedule?.mode === "countdown") {
    return countdownValue || "--:--";
  }

  // One-time due date
  if (item.schedule?.dueAt) {
    const formatted = formatDate(item.schedule.dueAt);
    if (!formatted) return "TIME UP";
    const dueDate = new Date(item.schedule.dueAt);
    if (dueDate < new Date()) return "TIME UP";
    return formatted;
  }


  // N-day repeat logic
  if (item.schedule?.repeatDays && item.schedule?.dueTime) {
    const now = new Date();
    // Find last reset date
    const created = new Date(item.createdAt || item.created_at || now);
    const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const cycleDay = daysSince % item.schedule.repeatDays;
    // Calculate next due time for this cycle
    const [hour, minute] = item.schedule.dueTime.split(":").map(Number);
    const dueToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
    if (cycleDay === 0 && now > dueToday) {
      return "TIME UP";
    }
    return `Every ${item.schedule.repeatDays} days @ ${item.schedule.dueTime}`;
  }
  // Only day picked, expires after N days
  if (item.schedule?.expiresInDays) {
    const created = new Date(item.createdAt || item.created_at || new Date());
    const expires = new Date(created.getTime() + item.schedule.expiresInDays * 24 * 60 * 60 * 1000);
    if (new Date() > expires) {
      return "TIME UP";
    }
    return `Expires in ${item.schedule.expiresInDays} day${item.schedule.expiresInDays > 1 ? "s" : ""}`;
  }

  return "--:--";
};

// Isolated Subtask component so we can use hooks safely
function SubtaskCard({
  sub,
  hoveredSubtaskId,
  setHoveredSubtaskId,
  users,
  onEditSubtask,
  onDeleteSubtask,
  onUpdateSubtask,
  parentId,
}) {
  const isSubHovered = hoveredSubtaskId === sub.id;
  
  // Parse subtask schedule
  const subtaskSchedule = parseSchedule(sub.schedule);
  const subtaskWithSchedule = { ...sub, schedule: subtaskSchedule };
  const { timeLeft, expired } = useCountdown(subtaskWithSchedule);
  const subDueDisplay = getDueDisplay(subtaskWithSchedule, timeLeft);

  // Parse assignees with proper field mapping
  const mainSubAssigneeId = sub.mainAssigneeId || sub.mainAssignee || sub.main_assignee_id;
  const mainSubAssignee = users.find((u) => u.id === Number(mainSubAssigneeId));
  
  const supportingSubAssigneeIds = parseAssignees(sub.supportingAssignees || sub.supporting_assignees);
  const supportingSubAssignees = users.filter(
    (u) => supportingSubAssigneeIds.includes(u.id) && u.id !== Number(mainSubAssigneeId)
  );

  const handleSubtaskToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onUpdateSubtask(parentId, sub.id, { completed: !sub.completed });
  };

  const handleEditSubtask = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEditSubtask?.(sub);
  };

  const handleDeleteSubtask = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteSubtask(parentId, sub.id);
  };

  const renderUserTag = (user, isMain = false) => {
    if (!user) return null;
    const parts = user.fullName.trim().split(" ");
    const initials =
      parts.length > 1
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    return (
      <span
        key={user.id}
        className={`w-4 h-4 flex items-center justify-center rounded-full font-bold text-[9px] shadow ${
          isMain ? "bg-blue-600 text-white" : "bg-green-500 text-white"
        }`}
      >
        {initials}
      </span>
    );
  };

  return (
    <div
      className="relative p-2 text-[11px] bg-gray-800 border border-gray-600 rounded-md cursor-pointer w-full"
      onMouseEnter={() => setHoveredSubtaskId(sub.id)}
      onMouseLeave={() => setHoveredSubtaskId(null)}
      onClick={handleEditSubtask}
    >
      <div className="absolute flex justify-between items-center top-1 left-1 right-1 z-30">
        <span
          className={`text-[9px] ${
            subDueDisplay === "TIME UP" || expired ? "text-red-500" : "text-white"
          }`}
        >
          {subDueDisplay}
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={handleEditSubtask} title="Edit Subtask">
            <Pencil size={11} className="text-gray-400 hover:text-blue-400" />
          </button>
          <button type="button" onClick={handleDeleteSubtask} title="Delete Subtask">
            <Trash2 size={11} className="text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      <div className="pt-4">
        <div className="flex items-start gap-2 w-full">
          <input
            type="checkbox"
            checked={sub.completed}
            onChange={handleSubtaskToggle}
            onClick={handleSubtaskToggle}
            className="w-3 h-3 accent-green-500 cursor-pointer mt-0.5 flex-shrink-0"
          />
          <span 
            className={`flex-1 cursor-pointer break-words whitespace-pre-wrap overflow-hidden min-w-0 ${sub.completed ? "line-through text-gray-400" : ""}`}
            onClick={handleSubtaskToggle}
            style={{ wordBreak: 'break-word' }}
          >
            {sub.title}
          </span>
        </div>
      </div>

      {(mainSubAssignee || supportingSubAssignees.length > 0) && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isSubHovered ? "max-h-12 mt-1 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-wrap gap-1 p-1 rounded-md bg-gray-700/20">
            {mainSubAssignee && renderUserTag(mainSubAssignee, true)}
            {supportingSubAssignees.map((u) => renderUserTag(u))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onAddSubtask,
  onEditSubtask,
  onComplete,
  onDeleteSubtask,
  onUpdateSubtask,
  onArchive,
  onPin,
  onTaskClick,
}) {
  const [isCompleted, setIsCompleted] = useState(task.completed || false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredSubtaskId, setHoveredSubtaskId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    setIsCompleted(task.completed || false);
  }, [task.completed]);

  // Parse assignees with proper field mapping - handle both camelCase and snake_case
  const mainAssigneeId = task.mainAssigneeId || task.mainAssignee || task.main_assignee_id;
  const main = users.find((u) => u.id === Number(mainAssigneeId));
  
  const supportingAssigneeIds = parseAssignees(task.supportingAssignees || task.supporting_assignees);
  const supporting = users.filter(
    (u) => supportingAssigneeIds.includes(u.id) && u.id !== Number(mainAssigneeId)
  );

  // Parse task schedule
  const taskSchedule = parseSchedule(task.schedule);
  const taskWithSchedule = { ...task, schedule: taskSchedule };
  const { timeLeft, expired } = useCountdown(taskWithSchedule);
  const dueDisplay = getDueDisplay(taskWithSchedule, timeLeft);

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't allow toggling for archived tasks
    if (task.archived) {
      return;
    }
    
    const newStatus = !isCompleted;
    setIsCompleted(newStatus);
    onComplete(task.id, newStatus);
  };

  const handleAddSubtaskClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAddSubtask?.();
  };

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(task);
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(task.id);
  };

  const handleArchiveClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onArchive?.(task.id);
  };

  const handlePinClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPin?.(task.id);
  };

  const getUserInitials = (user) => {
    if (!user) return "";
    const parts = user.fullName.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  const renderUserTag = (user, isMain = false) => {
    if (!user) return null;
    return (
      <span
        key={user.id}
        className={`w-4 h-4 flex items-center justify-center rounded-full font-bold text-[9px] shadow ${
          isMain ? "bg-blue-600 text-white" : "bg-green-500 text-white"
        }`}
      >
        {getUserInitials(user)}
      </span>
    );
  };

  return (
    <>
      <div
        className="p-1 space-y-1 text-white bg-gray-900 border border-gray-700 shadow-sm rounded-lg w-[250px] cursor-pointer"
        onClick={() => onTaskClick && onTaskClick(task)}
      >
      <div
        className="relative p-2 space-y-1 text-xs bg-gray-800 border border-gray-600 rounded-md"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top Buttons Row */}
        <div className="absolute flex justify-between items-center top-1 left-1 right-1 px-1 z-30">
          <div className="flex gap-1">
            <button type="button" title={task.pinned ? "Unpin" : "Pin"} onClick={handlePinClick}>
              <Pin size={12} className={`${task.pinned ? "text-red-500" : "text-gray-400 hover:text-red-400"}`} />
            </button>
            <button type="button" title={task.archived ? "Unarchive" : "Archive"} onClick={handleArchiveClick}>
              <Archive size={12} className="text-gray-400 hover:text-yellow-400" />
            </button>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={handleEditClick} title="Edit">
              <Pencil size={12} className="text-gray-400 hover:text-blue-400" />
            </button>
            <button type="button" onClick={handleDeleteClick} title="Delete">
              <Trash2 size={12} className="text-gray-400 hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Title & Description */}
        <div className="pt-3">
          <h3 className="text-[11px] font-semibold break-words">{task.title}</h3>
          <p className="text-[10px] text-gray-300 break-words whitespace-pre-wrap">{task.description}</p>
        </div>

        {/* Assignees */}
        {(main || supporting.length > 0) && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isHovered ? "max-h-12 mt-1 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-wrap gap-1 p-1 rounded-md bg-gray-700/20">
              {main && renderUserTag(main, true)}
              {supporting.map((u) => renderUserTag(u))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isHovered ? "max-h-96 mt-2 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="space-y-2">
              {/* Image thumbnails - shown as actual images */}
              {task.attachments.filter(att => att.type === "image" && att.url && att.url.trim() !== '').length > 0 && (
                <div className="flex flex-col gap-2">
                  {task.attachments
                    .filter(att => att.type === "image" && att.url && att.url.trim() !== '')
                    .map((att, index) => {
                      const key = att.id || `image-${index}`;
                      return (
                        <div
                          key={key}
                          className="block rounded overflow-hidden hover:opacity-80 transition-opacity cursor-pointer border border-gray-600 hover:border-purple-500 w-full"
                          title={`View ${att.name || 'image'}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLightboxImage({ url: att.url, name: att.name });
                          }}
                        >
                          <img
                            src={att.url}
                            alt={att.name || 'attachment'}
                            className="w-full h-auto object-cover rounded"
                            onError={(e) => {
                              // If image fails to load, show placeholder
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = `<div class="h-20 w-20 bg-gray-700 flex items-center justify-center text-purple-400"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`;
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              )}
              
              {/* Links and Documents - shown as badges */}
              {task.attachments.filter(att => (att.type === "link" || att.type === "document") && att.url && att.url.trim() !== '').length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.attachments.map((att, index) => {
                    const isUploadedFile = att.url && att.url.startsWith('data:');
                    const hasValidUrl = att.url && att.url.trim() !== '';
                    const key = att.id || `attachment-${index}`;

                    // Skip images (already rendered above)
                    if (att.type === "image") return null;

                    const content = (
                      <>
                        {att.type === "document" && <FileText size={10} className="text-blue-400" />}
                        {att.type === "link" && <LinkIcon size={10} className="text-green-400" />}
                        <span className="max-w-[80px] truncate">{att.name || 'Unnamed'}</span>
                      </>
                    );

                    // Links are always clickable if they have a valid URL
                    if (att.type === "link" && hasValidUrl) {
                      return (
                        <a
                          key={key}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-600 rounded text-[9px] hover:bg-gray-500 transition-colors cursor-pointer"
                          title={`${att.name || 'Link'} - ${att.url}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {content}
                        </a>
                      );
                    }
                    
                    // Documents - can be downloaded or opened
                    if (att.type === "document" && hasValidUrl) {
                      if (isUploadedFile) {
                        // Base64 document - download
                        return (
                          <a
                            key={key}
                            href={att.url}
                            download={att.name || 'document'}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-600 rounded text-[9px] hover:bg-gray-500 transition-colors cursor-pointer"
                            title={`Download ${att.name || 'document'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {content}
                          </a>
                        );
                      } else {
                        // External document URL - open in new tab
                        return (
                          <a
                            key={key}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-600 rounded text-[9px] hover:bg-gray-500 transition-colors cursor-pointer"
                            title={`${att.name || 'Document'} - ${att.url}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {content}
                          </a>
                        );
                      }
                    }
                    
                    // Fallback - just display as text (no URL available)
                    return (
                      <span
                        key={key}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-600 rounded text-[9px] cursor-default"
                        title={att.name || 'Attachment'}
                      >
                        {content}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Priority + Due/Countdown */}
        <div className="flex justify-between items-center">
          <span
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
              priorityBorderColors[task.priority] ||
              "border-gray-400 text-gray-200"
            }`}
          >
            {task.priority}
          </span>
          <span
            className={`text-[9px] ${
              dueDisplay === "TIME UP" || expired ? "text-red-500" : "text-white"
            }`}
          >
            {dueDisplay}
          </span>
        </div>

        {/* Status + Add Subtask */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={handleToggle}
              onClick={handleToggle}
              className="w-3 h-3 accent-green-500 cursor-pointer"
            />
            <span 
              className={`cursor-pointer ${isCompleted ? "text-green-400" : "text-yellow-400"}`}
              onClick={handleToggle}
            >
              {isCompleted ? "Done" : "Pending"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddSubtaskClick}
            className="p-0.5 text-white bg-blue-600 rounded-full hover:bg-blue-700"
            title="Add Subtask"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {task.subtasks?.map((sub) => (
        <SubtaskCard
          key={sub.id}
          sub={sub}
          hoveredSubtaskId={hoveredSubtaskId}
          setHoveredSubtaskId={setHoveredSubtaskId}
          users={users}
          onEditSubtask={onEditSubtask}
          onDeleteSubtask={onDeleteSubtask}
          onUpdateSubtask={onUpdateSubtask}
          parentId={task.id}
          parentTask={task}
        />
      ))}
    </div>

    {/* Image Lightbox - rendered outside card to prevent event interference */}
    <ImageLightbox
      imageUrl={lightboxImage?.url}
      imageName={lightboxImage?.name}
      isOpen={!!lightboxImage}
      onClose={() => setLightboxImage(null)}
    />
    </>
  );
}