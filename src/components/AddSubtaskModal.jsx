import { useState, useEffect } from 'react';
import users from '../data/users';

export default function AddSubtaskModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  onUpdate, 
  parentTask, 
  editingSubtask = null 
}) {
  const [title, setTitle] = useState('');
  const [mainAssignee, setMainAssignee] = useState('');
  const [supportingAssignees, setSupportingAssignees] = useState([]);

  // Prefill fields if editing
  useEffect(() => {
    if (editingSubtask) {
      setTitle(editingSubtask.title || '');
      setMainAssignee(editingSubtask.mainAssignee || '');
      setSupportingAssignees(editingSubtask.supportingAssignees || []);
    } else {
      setTitle('');
      setMainAssignee('');
      setSupportingAssignees([]);
    }
  }, [editingSubtask]);

	const handleCheckboxToggle = (userId) => {
		setSupportingAssignees((prev) =>
			prev.includes(userId)
				? prev.filter((id) => id !== userId)
				: [...prev, userId],
		);
	};

  const handleSubmit = () => {
    if (!title.trim() || !mainAssignee) return; // ✅ Basic validation

    const subtaskData = {
      id: editingSubtask ? editingSubtask.id : Date.now(),
      title,
      completed: editingSubtask ? editingSubtask.completed : false,
      mainAssignee,
      supportingAssignees,
    };

    if (editingSubtask) {
      onUpdate(parentTask.id, subtaskData);
    } else {
      onAdd(parentTask.id, subtaskData);
    }

    onClose();
  };

	if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white w-full max-w-md p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">
          {editingSubtask ? 'Edit Subtask' : 'Add Subtask'}
        </h2>

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
					<label
						htmlFor="main-assignee"
						className="block mb-1 text-sm font-semibold"
					>
						Main Assignee
					</label>
					<select
						id="main-assignee"
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
					<span className="block mb-1 text-sm font-semibold">
						Supporting Assignees
					</span>
					<div className="flex flex-wrap gap-2">
						{users.map((user) => (
							<label key={user.id} className="flex items-center gap-1 text-sm">
								<input
									type="checkbox"
									id={`supporting-${user.id}`}
									checked={supportingAssignees.includes(user.id)}
									onChange={() => handleCheckboxToggle(user.id)}
									className="accent-blue-500"
								/>
								<span htmlFor={`supporting-${user.id}`}>{user.fullName}</span>
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
            {editingSubtask ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
