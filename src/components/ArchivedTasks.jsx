// src/components/ArchivedTasks.jsx
import { useState } from "react";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";

export default function ArchivedTasks({ tasks, onEdit, onDelete, onArchive }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const archivedTasks = tasks.filter((task) => task.archived);

  const handleEditTask = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleAddOrEditTask = async (updated) => {
    if (!editingTask) return;
    await onEdit(editingTask.id, updated);
    setEditingTask(null);
    setIsModalOpen(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Archived Tasks</h2>
      {archivedTasks.length === 0 ? (
        <p className="text-gray-500">No archived tasks</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {archivedTasks.map((task) => (
            <div key={task.id} className="h-fit min-h-[200px] [&_.bg-gray-900]:bg-gray-700 [&_.border-gray-700]:border-gray-600 [&_.bg-gray-800]:bg-gray-600 [&_.border-gray-600]:border-gray-500 [&_.bg-gray-700]:bg-gray-500">
              <TaskCard
                task={task}
                onEdit={handleEditTask}
                onDelete={onDelete}
                onArchive={onArchive}
              />
            </div>
          ))}
        </div>
      )}

      <AddTaskModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onAdd={handleAddOrEditTask}
        taskToEdit={editingTask}
      />
    </div>
  );
}