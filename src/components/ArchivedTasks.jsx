// src/components/ArchivedTasks.jsx
import TaskCard from "./TaskCard";

export default function ArchivedTasks({ tasks, onEdit, onDelete, onArchive }) {
  const archivedTasks = tasks.filter((task) => task.archived);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Archived Tasks</h2>
      {archivedTasks.length === 0 ? (
        <p className="text-gray-500">No archived tasks</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archivedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
