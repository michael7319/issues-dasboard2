// src/data/tasks.js
const tasks = [
  {
    id: 1,
    title: "Fix login bug",
    description: "Users can't log in with special characters in password.",
    type: "daily", // ✅ updated
    priority: "High",
    status: "Open",
    mainAssignee: 1,
    supportingAssignees: [4, 6],
  },
  {
    id: 2,
    title: "Update dashboard layout",
    description: "Redesign layout for better responsiveness.",
    type: "weekly", // ✅ updated
    priority: "Medium",
    status: "In Progress",
    mainAssignee: 4,
    supportingAssignees: [],
  },
  {
    id: 3,
    title: "Client Onboarding Project",
    description: "Full project setup with multiple tasks.",
    type: "project", // ✅ updated
    priority: "High",
    status: "Open",
    mainAssignee: 6,
    supportingAssignees: [2, 3],
  },
  {
    id: 4,
    title: "Write monthly report",
    description: "Summarize key activities and performance.",
    type: "custom", // ✅ updated
    priority: "Low",
    status: "Pending",
    mainAssignee: 8,
    supportingAssignees: [],
  },
];

export default tasks;
