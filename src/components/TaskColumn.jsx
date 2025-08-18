import TaskCard from "./TaskCard";

export default function TaskColumn({ title, tasks }) {
  return (
    <div className="min-w-[280px] max-w-xs w-full bg-gray-100 p-4 rounded-lg shadow-md">
      <h2 className="mb-3 text-lg font-semibold text-gray-700">{title}</h2>
      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
