import { useState } from 'react';
import users from '../data/users';

export default function AddSubtaskModal({ isOpen, onClose, onAdd, parentTask }) {
  const [title, setTitle] = useState('');
  const [mainAssignee, setMainAssignee] = useState('');
  const [supportingAssignees, setSupportingAssignees] = useState([]);

  const handleCheckboxToggle = (userId) => {
    setSupportingAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    const newSubtask = {
      id: Date.now(),
      title,
      completed: false,
      mainAssignee,
      supportingAssignees,
    };

    onAdd(parentTask.id, newSubtask);
    setTitle('');
    setMainAssignee('');
    setSupportingAssignees([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white w-full max-w-md p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Add Subtask</h2>

        {/* Title Input */}
        <input
          type="text"
          placeholder="Subtask title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 mb-4 rounded border border-gray-700 bg-gray-800 text-white"
        />

        {/* Main Assignee Select */}
        <div className="mb-4">
          <label className="block mb-1 text-sm font-semibold">Main Assignee</label>
          <select
            value={mainAssignee}
            onChange={(e) => setMainAssignee(Number(e.target.value))}
            className="w-full p-2 rounded border border-gray-700 bg-gray-800 text-white"
          >
            <option value="">-- Select --</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Supporting Assignees */}
        <div className="mb-4">
          <label className="block mb-1 text-sm font-semibold">Supporting Assignees</label>
          <div className="flex flex-wrap gap-2">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={supportingAssignees.includes(user.id)}
                  onChange={() => handleCheckboxToggle(user.id)}
                  className="accent-blue-500"
                />
                {user.fullName}
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
