// src/components/ArchivedTasks.jsx
import { useState } from "react";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";

export default function ArchivedTasks({ tasks, onEdit, onDelete, onArchive, onTaskClick }) {
  // Remove modal state for editing

  const archivedTasks = tasks.filter((task) => task.archived);

  // Remove edit handlers

  return (
    <div className="p-4">
      <h2 className={`text-xl font-bold mb-4 ${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'text-white' : 'text-black'}`}>Archived Tasks</h2>
      {archivedTasks.length === 0 ? (
        <p className="text-gray-500">No archived tasks</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {archivedTasks.map((task) => (
            <div key={task.id} className="h-fit min-h-[200px] [&_.bg-gray-900]:bg-gray-700 [&_.border-gray-700]:border-gray-600 [&_.bg-gray-800]:bg-gray-600 [&_.border-gray-600]:border-gray-500 [&_.bg-gray-700]:bg-gray-500">
              <TaskCard
                task={task}
                // Remove onEdit to disable editing
                onDelete={onDelete}
                onArchive={onArchive}
                onTaskClick={onTaskClick}
              />
            </div>
          ))}
        </div>
      )}

      {/* Edit modal removed for archived section */}
    </div>
  );
}