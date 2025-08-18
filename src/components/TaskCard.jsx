import React, { useState, useEffect } from "react";
import users from "../data/users";
import { Pencil, Trash2, Plus } from "lucide-react";
import AddSubtaskModal from "./AddSubtaskModal";

const priorityBorderColors = {
  High: "border-red-500 text-red-600",
  Medium: "border-yellow-500 text-yellow-600",
  Low: "border-green-500 text-green-600",
};

export default function TaskCard({
	task,
	onEdit,
	onDelete,
	onAddSubtask,
	onComplete,
}) {
  const [isCompleted, setIsCompleted] = useState(task.completed || false);
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredSubtaskId, setHoveredSubtaskId] = useState(null);

	useEffect(() => {
		setIsCompleted(task.completed || false);
	}, [task.completed]);

	const main = users.find((u) => Number(u.id) === Number(task.mainAssignee));
	const supporting = users.filter(
		(u) =>
			task.supportingAssignees?.includes(Number(u.id)) &&
			Number(u.id) !== Number(task.mainAssignee),
	);

	const handleToggle = () => {
		const newStatus = !isCompleted;
		setIsCompleted(newStatus);
		onComplete(task.id, newStatus);
	};

  const handleSubtaskToggle = (subtask_id, task_id, sub_complete_state) => {
    if (task.id !== task_id) return;

    const updatedSubtasks = task.subtasks.map((subtask) =>
      subtask.id === subtask_id
        ? { ...subtask, completed: !sub_complete_state }
        : subtask
    );

    updateTask({ ...task, subtasks: updatedSubtasks }, task_id);
  };

  const handleEditSubtask = (subtask) => {
    setEditingSubtask(subtask);
    setIsSubtaskModalOpen(true);
  };

  const handleDeleteSubtask = (subtaskId) => {
    const updatedSubtasks = task.subtasks.filter((st) => st.id !== subtaskId);
    updateTask({ ...task, subtasks: updatedSubtasks }, task.id);
  };

  const handleSaveSubtask = (parentTaskId, subtask) => {
    let updatedSubtasks;

    if (editingSubtask) {
      updatedSubtasks = task.subtasks.map((st) =>
        st.id === subtask.id ? subtask : st
      );
    } else {
      updatedSubtasks = [...(task.subtasks || []), subtask];
    }

    updateTask({ ...task, subtasks: updatedSubtasks }, parentTaskId);
    setEditingSubtask(null);
  };

  // 🔹 Two-letter initials
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
        className={`w-4 h-4 flex items-center justify-center rounded-full font-bold text-[9px] shadow 
        ${isMain ? "bg-blue-600 text-white" : "bg-green-500 text-white"}`}
      >
        {getUserInitials(user)}
      </span>
    );
  };

  return (
    <div className="p-2 space-y-1 text-white bg-gray-900 border border-gray-700 shadow-sm rounded-lg w-[260px]">
      {/* Main Task Block */}
      <div
        className="relative p-2 space-y-1 text-xs bg-gray-800 border border-gray-600 rounded-md"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div>
          <h3 className="text-sm font-semibold">{task.title}</h3>
          <p className="text-xs text-gray-300">{task.description}</p>
        </div>

        {/* Hover Expanding Assignees */}
        {(main || supporting.length > 0) && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out 
              ${isHovered ? "max-h-16 mt-2 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="flex flex-wrap gap-1 p-1 rounded-md bg-gray-700/20 backdrop-blur-sm">
              {main && renderUserTag(main, true)}
              {supporting.length > 0 && supporting.map((u) => renderUserTag(u))}
            </div>
          </div>
        )}

        {/* Edit/Delete Buttons */}
        <div className="absolute flex gap-1 top-1 right-1 z-30">
          <button onClick={() => onEdit(task)} title="Edit">
            <Pencil size={14} className="text-gray-400 hover:text-blue-400" />
          </button>
          <button onClick={() => onDelete(task.id)} title="Delete">
            <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
          </button>
        </div>

        <div className="flex items-end justify-between pt-1">
          <div className="flex flex-col items-start gap-1">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                priorityBorderColors[task.priority] ||
                "border-gray-400 text-gray-200"
              }`}
            >
              {task.priority}
            </span>

            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={handleToggle}
                className="w-3.5 h-3.5 accent-green-500"
              />
              <span
                className={isCompleted ? "text-green-400" : "text-yellow-400"}
              >
                {isCompleted ? "Complete" : "Pending"}
              </span>
            </label>
          </div>

          {/* Add Subtask Button */}
          <div className="relative z-30 mt-1 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingSubtask(null);
                setIsSubtaskModalOpen(true);
              }}
              className="p-1 text-white bg-blue-600 rounded-full hover:bg-blue-700"
              title="Add Subtask"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {task.subtasks?.length > 0 &&
        task.subtasks.map((sub) => {
          const mainSubAssignee = users.find((u) => u.id === sub.mainAssignee);
          const supportingSubAssignees = users.filter(
            (u) =>
              sub.supportingAssignees?.includes(u.id) &&
              u.id !== sub.mainAssignee
          );

          const isSubHovered = hoveredSubtaskId === sub.id;

          return (
            <div
              key={sub.id}
              className="relative p-2 text-xs bg-gray-800 border border-gray-600 rounded-md"
              onMouseEnter={() => setHoveredSubtaskId(sub.id)}
              onMouseLeave={() => setHoveredSubtaskId(null)}
            >
              {/* Expanding Assignees */}
              {(mainSubAssignee || supportingSubAssignees.length > 0) && (
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out 
                    ${
                      isSubHovered ? "max-h-16 mt-2 opacity-100" : "max-h-0 opacity-0"
                    }`}
                >
                  <div className="flex flex-wrap gap-1 p-1 rounded-md bg-gray-700/20 backdrop-blur-sm">
                    {mainSubAssignee && renderUserTag(mainSubAssignee, true)}
                    {supportingSubAssignees.length > 0 &&
                      supportingSubAssignees.map((u) => renderUserTag(u))}
                  </div>
                </div>
              )}

              {/* Edit/Delete Subtask */}
              <div className="absolute flex gap-1 top-1 right-1 z-30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSubtask(sub);
                  }}
                  title="Edit Subtask"
                >
                  <Pencil
                    size={12}
                    className="text-gray-400 hover:text-blue-400"
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSubtask(sub.id);
                  }}
                  title="Delete Subtask"
                >
                  <Trash2
                    size={12}
                    className="text-gray-400 hover:text-red-400"
                  />
                </button>
              </div>

              <div className="pt-1 space-y-1">
                <label className="flex items-center gap-1 pr-8 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sub.completed}
                    onChange={() =>
                      handleSubtaskToggle(sub.id, task.id, sub.completed)
                    }
                    className="w-3.5 h-3.5 accent-green-500"
                  />
                  <span
                    className={
                      sub.completed ? "line-through text-gray-400" : ""
                    }
                  >
                    {sub.title}
                  </span>
                </label>
              </div>
            </div>
          );
        })}

      {/* Subtask Modal */}
      <AddSubtaskModal
        isOpen={isSubtaskModalOpen}
        onClose={() => setIsSubtaskModalOpen(false)}
        onAdd={handleSaveSubtask}
        parentTask={task}
        editingSubtask={editingSubtask}
      />
    </div>
  );
}
