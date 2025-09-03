import React, { useState, useEffect } from "react";
import useLocalStorageTasks from "../hooks/use-tasks";
import users from "../data/users";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// Weekday list for "weekly" schedule
const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function AddTaskModal({ open, onClose, onAdd, taskToEdit }) {
  const { saveTask } = useLocalStorageTasks("tasks");
  const isEditMode = Boolean(taskToEdit);

  // Core task fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [type, setType] = useState("custom"); // default type

  const [mainAssignee, setMainAssignee] = useState("");
  const [supportingAssignees, setSupportingAssignees] = useState([]);

  // Scheduling state
  const [mode, setMode] = useState("none");
  const [cdHours, setCdHours] = useState(0);
  const [cdMinutes, setCdMinutes] = useState(0);
  const [dueTime, setDueTime] = useState("");
  const [dueWeekday, setDueWeekday] = useState(1);
  const [dueDateAbs, setDueDateAbs] = useState("");

  // Populate on edit / reset on open
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || "");
      setDescription(taskToEdit.description || "");
      setPriority(taskToEdit.priority || "Medium");
      setType(taskToEdit.type || "custom");
      setMainAssignee(taskToEdit.mainAssignee ?? "");
      setSupportingAssignees(taskToEdit.supportingAssignees || []);

      const sch = taskToEdit.schedule || { mode: "none", reset: "none" };
      setMode(sch.mode || "none");

      const total = sch.countdownSeconds ?? 0;
      setCdHours(Math.floor(total / 3600));
      setCdMinutes(Math.floor((total % 3600) / 60));

      setDueTime(sch.dueTime || "");
      setDueWeekday(typeof sch.dueWeekday === "number" ? sch.dueWeekday : 1);

      if (sch.dueDate) {
        setDueDateAbs(sch.dueDate);
      } else {
        setDueDateAbs("");
      }
    } else {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setType("custom");
      setMainAssignee("");
      setSupportingAssignees([]);
      setMode("none");
      setCdHours(0);
      setCdMinutes(0);
      setDueTime("");
      setDueWeekday(1);
      setDueDateAbs("");
    }
  }, [taskToEdit, open]);

  const toggleSupporting = (id) => {
    setSupportingAssignees((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const resetPolicy =
    type === "daily" ? "daily" : type === "weekly" ? "weekly" : "none";

  const buildSchedule = () => {
    if (mode === "none") return { mode: "none", reset: resetPolicy };

    if (mode === "countdown") {
      const totalSeconds =
        Math.max(0, parseInt(cdHours || 0, 10)) * 3600 +
        Math.max(0, parseInt(cdMinutes || 0, 10)) * 60;
      if (totalSeconds <= 0) return { mode: "none", reset: resetPolicy };
      return {
        mode: "countdown",
        reset: resetPolicy,
        countdownSeconds: totalSeconds,
        countdownStartAt: new Date().toISOString(),
      };
    }

    if (type === "daily" || type === "weekly") {
      const sch = { mode: "due", reset: resetPolicy, dueTime: dueTime || "" };
      if (type === "weekly") {
        sch.dueWeekday =
          typeof dueWeekday === "number"
            ? dueWeekday
            : parseInt(dueWeekday, 10) || 1;
      }
      if (!sch.dueTime) return { mode: "none", reset: resetPolicy };
      return sch;
    }

    // Project / Custom → only date
    if (dueDateAbs) {
      return {
        mode: "due",
        reset: "none",
        dueDate: dueDateAbs, // YYYY-MM-DD only
      };
    }

    return { mode: "none", reset: resetPolicy };
  };

  const handleSubmit = () => {
    if (!title.trim() || !mainAssignee) return;

    let finalcountdown = new Date();
    let totalSeconds = 5 * 60;
    finalcountdown.setSeconds(finalcountdown.getSeconds() + totalSeconds);

    const taskData = {
      //dueDate: Date.now(),
      countdown: finalcountdown,
      id: taskToEdit?.id || Date.now(),
      title: title.trim(),
      description: description.trim(),
      priority,
      type,
      mainAssignee: Number(mainAssignee),
      supportingAssignees: supportingAssignees.map(Number),
      completed: taskToEdit?.completed || false,
      subtasks: taskToEdit?.subtasks || [],
      createdAt: taskToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schedule: buildSchedule(),
    };

    if (isEditMode) saveTask(taskData, taskToEdit.id);
    else saveTask(taskData);

    onAdd(taskData);
    onClose();
  };

  const isRecurring = type === "daily" || type === "weekly";
  const showCountdownInputs = mode === "countdown";
  const showDueTimeRecurring = isRecurring && mode === "due";
  const showAbsDue = !isRecurring && mode === "due";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-lg">
            {isEditMode ? "Edit Task" : "Add New Task"}
          </DialogTitle>
        </DialogHeader>

        {/* Title */}
        <div className="mb-3 text-sm">
          <Label htmlFor="title" className="mb-1 block">
            Title
          </Label>
          <Input
            id="title"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="p-1 text-sm"
          />
        </div>

        {/* Description */}
        <div className="mb-3 text-sm">
          <Label htmlFor="description" className="mb-1 block">
            Description
          </Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="p-1 text-sm"
          />
        </div>

        {/* Priority & Type */}
        <div className="flex gap-3 mb-3 text-sm">
          <div className="flex-1">
            <Label className="mb-1 block">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="p-1 text-sm">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">🔥 High</SelectItem>
                <SelectItem value="Medium">⚠️ Medium</SelectItem>
                <SelectItem value="Low">✅ Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="mb-1 block">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setMode("none");
              }}
            >
              <SelectTrigger className="p-1 text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">🕒 Daily</SelectItem>
                <SelectItem value="weekly">🗓️ Weekly</SelectItem>
                <SelectItem value="project">🛠️ Project</SelectItem>
                <SelectItem value="custom">✏️ Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Assignee */}
        <div className="mb-3 text-sm">
          <Label htmlFor="main-assignee" className="mb-1 block">
            Main Assignee
          </Label>
          <select
            id="main-assignee"
            className="w-full p-1 border rounded text-sm text-black"
            value={mainAssignee}
            onChange={(e) => setMainAssignee(e.target.value)}
          >
            <option value="">Select</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.initials} — {u.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Supporting Assignees */}
        <div className="mb-3 text-sm">
          <Label className="mb-1 block">Supporting Assignees</Label>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  value={u.id}
                  checked={supportingAssignees.includes(u.id)}
                  onChange={() => toggleSupporting(u.id)}
                />
                <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded font-bold">
                  {u.initials}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Scheduling */}
        <div className="mb-3 text-sm">
          <Label className="font-medium block mb-1">Time / Due</Label>

          {/* Mode selector */}
          <div className="flex gap-3 mb-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                checked={mode === "none"}
                onChange={() => setMode("none")}
              />
              None
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                checked={mode === "countdown"}
                onChange={() => setMode("countdown")}
              />
              Countdown
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                checked={mode === "due"}
                onChange={() => setMode("due")}
              />
              {type === "daily" || type === "weekly" ? "Due time" : "Due date"}
            </label>
          </div>

          {/* Countdown */}
          <div
            className={`grid grid-cols-2 gap-2 mb-2 ${
              showCountdownInputs ? "" : "opacity-50"
            }`}
          >
            <Input
              type="number"
              min={0}
              disabled={!showCountdownInputs}
              value={cdHours}
              onChange={(e) => setCdHours(parseInt(e.target.value || 0, 10))}
              placeholder="Hours"
              className="p-1 text-sm"
            />
            <Input
              type="number"
              min={0}
              max={59}
              disabled={!showCountdownInputs}
              value={cdMinutes}
              onChange={(e) =>
                setCdMinutes(
                  Math.min(59, Math.max(0, parseInt(e.target.value || 0, 10)))
                )
              }
              placeholder="Minutes"
              className="p-1 text-sm"
            />
          </div>

          {/* Daily/Weekly due time */}
          {isRecurring && (
            <div
              className={`grid grid-cols-2 gap-2 ${
                showDueTimeRecurring ? "" : "opacity-50"
              }`}
            >
              {type === "weekly" && (
                <select
                  disabled={!showDueTimeRecurring}
                  value={dueWeekday}
                  onChange={(e) => setDueWeekday(parseInt(e.target.value, 10))}
                  className="p-1 text-sm border rounded text-black"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              )}
              <Input
                type="time"
                disabled={!showDueTimeRecurring}
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="p-1 text-sm"
              />
            </div>
          )}

          {/* Project/Custom absolute due (date only) */}
          {!isRecurring && (
            <div
              className={`grid grid-cols-1 ${showAbsDue ? "" : "opacity-50"}`}
            >
              <Input
                type="date"
                disabled={!showAbsDue}
                value={dueDateAbs}
                onChange={(e) => setDueDateAbs(e.target.value)}
                className="p-1 text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="destructive" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} size="sm">
            {isEditMode ? "Save Changes" : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
