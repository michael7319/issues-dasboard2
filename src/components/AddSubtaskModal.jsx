import React, { useState, useEffect } from "react";
import users from "../data/users";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { Form, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export default function AddSubtaskModal({
	open,
	onClose,
	onAdd,
	onUpdate,
	parentTask,
	editingSubtask = null,
}) {
	const isEditMode = editingSubtask !== null;

	const formSchema = z.object({
		id: z.string().optional(),
		title: z.string().min(1, { message: "Title is required" }),
		mainAssignee: z.string().min(1, { message: "Main assignee is required" }),
		supportingAssignees: z.array(z.string()).optional(),
		completed: z.boolean().optional(),
	});

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			id: editingSubtask?.id || Date.now(),
			title: editingSubtask?.title || "",
			mainAssignee: editingSubtask?.mainAssignee || "",
			supportingAssignees: editingSubtask?.supportingAssignees || [],
			completed: editingSubtask?.completed || false,
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();

		const subtaskData = form.getValues();

		if (isEditMode) {
			onUpdate(parentTask.id, subtaskData);
		} else {
			onAdd(parentTask.id, subtaskData);
		}

		handleClose();
	};

	const handleClose = () => {
		form.reset();
		onClose();
	};

	const toggleSupporting = (userId) => {
		form.setValue(
			"supportingAssignees",
			form.getValues("supportingAssignees").includes(userId)
				? form.getValues("supportingAssignees").filter((id) => id !== userId)
				: [...form.getValues("supportingAssignees"), userId],
		);
	};

	console.log(form.formState.isValid);
	console.log(editingSubtask);

	return (
		<Dialog
			open={open}
			onOpenChange={(openState) => {
				if (!openState) {
					handleClose();
				}
			}}
		>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="text-center">
						{isEditMode
							? "Edit Subtask"
							: `Add Subtask to "${parentTask?.title}"`}
					</DialogTitle>
				</DialogHeader>

				<Form
					control={form.control}
					onSubmit={form.handleSubmit(handleSubmit)}
					className="space-y-4 py-4"
				>
					{/* Title Input */}
					<div className="space-y-2">
						<Label htmlFor="title" className="text-right">
							Title *
						</Label>
						<Input
							id="title"
							placeholder="Enter subtask title"
							{...form.register("title")}
							className="w-full"
							required
						/>
					</div>

					{/* Main Assignee Select */}
					<div className="space-y-2">
						<Label htmlFor="mainAssignee" className="text-right">
							Main Assignee *
						</Label>
						<Select {...form.register("mainAssignee")} required>
							<SelectTrigger id="mainAssignee" className="w-full">
								<SelectValue placeholder="Select main assignee" />
							</SelectTrigger>
							<SelectContent>
								{users.map((user) => (
									<SelectItem key={user.id} value={String(user.id)}>
										{user.fullName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Supporting Assignees */}
					<div className="space-y-2">
						<Label className="text-right">Supporting Assignees</Label>
						<div className="grid gap-2 max-h-40 overflow-y-auto p-3 border rounded-md">
							{users.map((user) => (
								<div key={user.id} className="flex items-center space-x-2">
									<Checkbox
										id={`supporting-${user.id}`}
										onCheckedChange={() => toggleSupporting(user.id)}
										{...form.register("supportingAssignees")}
									/>
									<label
										htmlFor={`supporting-${user.id}`}
										className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										{user.fullName}
									</label>
								</div>
							))}
						</div>
					</div>

					<DialogFooter className="gap-2 sm:gap-0 pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							className="w-full sm:w-auto"
						>
							Cancel
						</Button>
						<Button type="submit" className="w-full sm:w-auto">
							{isEditMode ? "Update Subtask" : "Add Subtask"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
