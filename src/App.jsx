import { useState } from "react";
import useLocalStorageTasks from "./hooks/use-tasks";
import Sidebar from "./components/Sidebar";
import TimeframeView from "./components/TimeframeView";
import KanbanView from "./components/KanbanView"; // Optional

function App() {
	const [view, setView] = useState("timeframe");
	const { clearAllTasks } = useLocalStorageTasks("tasks");

	const clearTasks = () => {
		clearAllTasks();
		window.location.reload();
	};

	return (
		<div className="flex min-h-screen bg-white text-gray-800 dark:bg-gray-900 dark:text-black">
			{/* Sidebar */}
			<aside className="w-64 bg-blue-100 p-6 shadow-md">
				<Sidebar currentView={view} setView={setView} />
			</aside>

			{/* Main View */}
			<main className="flex-grow bg-gray-800 p-6 overflow-y-auto text-white">
				{view === "timeframe" ? <TimeframeView /> : <KanbanView />}
			</main>

			{/* 🔴 Clear Local Storage Button */}
			<button
				type="button"
				onClick={clearTasks}
				className="fixed bottom-4 left-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded shadow-lg z-50"
			>
				Clear All Tasks
			</button>
		</div>
	);
}

export default App;
