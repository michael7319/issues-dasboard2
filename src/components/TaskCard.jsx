import React, { useState, useEffect } from "react";
import users from "../data/users";
import { Pencil, Trash2, Plus, Archive } from "lucide-react";
import { use } from "react";

const priorityBorderColors = {
  High: "border-red-500 text-red-600",
  Medium: "border-yellow-500 text-yellow-600",
  Low: "border-green-500 text-green-600",
};

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  // onArchive,  // ❌ commented out until backend
  onAddSubtask,
  onEditSubtask,
  onComplete,
  onDeleteSubtask,
  onUpdateSubtask,
}) {
  const [isCompleted, setIsCompleted] = useState(task.completed || false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredSubtaskId, setHoveredSubtaskId] = useState(null);
  const [timeleft, settimeleft] = useState(null);

  useEffect(() => {
    setIsCompleted(task.completed || false);
  }, [task.completed]);

  const main = users.find((u) => Number(u.id) === Number(task.mainAssignee));
  const supporting = users.filter(
    (u) =>
      task.supportingAssignees?.includes(Number(u.id)) &&
      Number(u.id) !== Number(task.mainAssignee)
  );

  useEffect(() => {
    if (task.countdown) {
      let IntervalID = setInterval(() => {
        let end = task.countdown; // future Date
        let now = new Date();

        let diffMs = end - now; // remaining time in ms

        if (diffMs <= 0) {
          clearInterval(IntervalID);
          settimeleft("0:00"); // countdown finished
        } else {
          // Convert to minutes + seconds
          let totalSeconds = Math.floor(diffMs / 1000);
          let minutes = Math.floor(totalSeconds / 60);
          let seconds = totalSeconds % 60;

          // Format as "M:SS" (e.g., 4:07)
          let formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

          settimeleft(formatted);
        }
      }, 1000); // update every second

      return () => clearInterval(IntervalID); // cleanup
    }
  }, [task.countdown]);

  const handleToggle = (e) => {
    e.stopPropagation();
    const newStatus = !isCompleted;
    setIsCompleted(newStatus);
    onComplete(task.id, newStatus);
  };

  // const handleArchiveClick = (e) => {
  //   e.stopPropagation();
  //   if (onArchive) onArchive(task.id, !task.archived);
  // };

  const handleSubtaskToggle = (e, subtaskId, completed) => {
    e.stopPropagation();
    onUpdateSubtask(task.id, subtaskId, { completed: !completed });
  };

  const handleEditSubtask = (e, subtask) => {
    e.stopPropagation();
    onEditSubtask?.(subtask);
  };

  const handleDeleteSubtask = (e, subtaskId) => {
    e.stopPropagation();
    onDeleteSubtask(task.id, subtaskId);
  };

  const handleAddSubtaskClick = (e) => {
    e.stopPropagation();
    onAddSubtask?.();
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit(task);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(task.id);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-1 space-y-1 text-white bg-gray-900 border border-gray-700 shadow-sm rounded-lg w-[260px]">
      <div
        className="relative p-2 space-y-1 text-xs bg-gray-800 border border-gray-600 rounded-md"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top Buttons Row */}
        <div className="absolute flex justify-between items-center top-1 left-1 right-1 px-1 z-30">
          {/* Archive button (UI only, no functionality for now) */}
          <button type="button" title="Archive">
            <Archive
              size={12}
              className="text-gray-400 hover:text-yellow-400"
            />
          </button>
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
          <h3 className="text-[11px] font-semibold">{task.title}</h3>
          <p className="text-[10px] text-gray-300">{task.description}</p>
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

        {/* Priority + Due Date */}
        <div className="flex justify-between items-center">
          <span
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
              priorityBorderColors[task.priority] ||
              "border-gray-400 text-gray-200"
            }`}
          >
            {task.priority}
          </span>
          {timeleft && (
            <span className="text-[9px] text-gray-400">
              {timeleft}
            </span>
          )}
          {task.dueDate && (
            <span className="text-[9px] text-gray-400">
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        {/* Status + Add Subtask */}
        <div className="flex items-center justify-between mt-1">
          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={handleToggle}
              className="w-3 h-3 accent-green-500"
            />
            <span
              className={isCompleted ? "text-green-400" : "text-yellow-400"}
            >
              {isCompleted ? "Done" : "Pending"}
            </span>
          </label>
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
      {task.subtasks?.map((sub) => {
        const mainSubAssignee = users.find((u) => u.id === sub.mainAssignee);
        const supportingSubAssignees = users.filter(
          (u) =>
            sub.supportingAssignees?.includes(u.id) && u.id !== sub.mainAssignee
        );
        const isSubHovered = hoveredSubtaskId === sub.id;

        return (
          <div
            key={sub.id}
            className="relative p-2 text-[11px] bg-gray-800 border border-gray-600 rounded-md"
            onMouseEnter={() => setHoveredSubtaskId(sub.id)}
            onMouseLeave={() => setHoveredSubtaskId(null)}
          >
            <div className="absolute flex justify-between items-center top-1 left-1 right-1 z-30">
              {sub.dueDate && (
                <span className="text-[9px] text-gray-400">
                  {formatDate(sub.dueDate)}
                </span>
              )}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={(e) => handleEditSubtask(e, sub)}
                  title="Edit Subtask"
                >
                  <Pencil
                    size={11}
                    className="text-gray-400 hover:text-blue-400"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSubtask(e, sub.id)}
                  title="Delete Subtask"
                >
                  <Trash2
                    size={11}
                    className="text-gray-400 hover:text-red-400"
                  />
                </button>
              </div>
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-1 pr-8 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sub.completed}
                  onChange={(e) =>
                    handleSubtaskToggle(e, sub.id, sub.completed)
                  }
                  className="w-3 h-3 accent-green-500"
                />
                <span
                  className={sub.completed ? "line-through text-gray-400" : ""}
                >
                  {sub.title}
                </span>
              </label>
            </div>

            {(mainSubAssignee || supportingSubAssignees.length > 0) && (
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isSubHovered
                    ? "max-h-12 mt-1 opacity-100"
                    : "max-h-0 opacity-0"
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
      })}
    </div>
  );
}
