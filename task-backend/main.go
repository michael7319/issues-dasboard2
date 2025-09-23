package main

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/microsoft/go-mssqldb"
)

// Task matches frontend and DB schema
type Task struct {
	ID                  int64     `json:"id" db:"id"`
	Title               string    `json:"title" db:"title"`
	Description         string    `json:"description" db:"description"`
	Priority            string    `json:"priority" db:"priority"`
	Type                string    `json:"type" db:"type"`
	Completed           bool      `json:"completed" db:"completed"`
	Archived            bool      `json:"archived" db:"archived"`
	CreatedAt           string    `json:"created_at" db:"created_at"`
	MainAssigneeID      int       `json:"main_assignee_id" db:"main_assignee_id"`
	SupportingAssignees string    `json:"supporting_assignees" db:"supporting_assignees"` // JSON string
	Schedule            string    `json:"schedule" db:"schedule"`                         // JSON string
	Subtasks            []Subtask `json:"subtasks,omitempty"`
}

// Subtask mirrors frontend
type Subtask struct {
	ID                  int64  `json:"id" db:"id"`
	TaskID              int64  `json:"task_id" db:"task_id"`
	Title               string `json:"title" db:"title"`
	Completed           bool   `json:"completed" db:"completed"`
	MainAssigneeID      int    `json:"main_assignee_id" db:"main_assignee_id"`
	SupportingAssignees string `json:"supporting_assignees" db:"supporting_assignees"` // JSON string
	Schedule            string `json:"schedule" db:"schedule"`                         // JSON string
}

var db *sqlx.DB

func main() {
	// Connect to SQL Server
	connStr := "server=MICHAEL,1433;database=task_manager_db;trusted_connection=true;"
	var err error
	db, err = sqlx.Open("mssql", connStr)
	if err != nil {
		log.Fatal("Failed to connect to DB:", err)
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		log.Fatal("DB ping failed:", err)
	}
	log.Println("Connected to SQL Server!")

	// Gin router with CORS
	r := gin.Default()
	r.Use(cors.Default())

	// GET /tasks - Fetch all tasks with subtasks
	r.GET("/tasks", func(c *gin.Context) {
		var tasks []Task
		err := db.Select(&tasks, "SELECT * FROM Tasks WHERE archived = 0 ORDER BY created_at DESC")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Fetch subtasks for each task
		for i := range tasks {
			var subtasks []Subtask
			err := db.Select(&subtasks, "SELECT * FROM Subtasks WHERE task_id = ?", tasks[i].ID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			tasks[i].Subtasks = subtasks
		}
		c.JSON(http.StatusOK, tasks)
	})

	// POST /tasks - Create a task
	r.POST("/tasks", func(c *gin.Context) {
		var task Task
		if err := c.BindJSON(&task); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		// Validate that the main_assignee_id exists in Users table if it's not 0
		if task.MainAssigneeID != 0 {
			var userExists bool
			err := db.Get(&userExists, "SELECT CASE WHEN EXISTS(SELECT 1 FROM Users WHERE id = ?) THEN 1 ELSE 0 END", task.MainAssigneeID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate assignee"})
				return
			}
			if !userExists {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Main assignee ID does not exist"})
				return
			}
		}
		
		res, err := db.Exec(
			`INSERT INTO Tasks (title, description, priority, type, main_assignee_id, supporting_assignees, schedule, completed, archived)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			task.Title, task.Description, task.Priority, task.Type, task.MainAssigneeID, task.SupportingAssignees,
			task.Schedule, task.Completed, task.Archived)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		task.ID = id
		c.JSON(http.StatusCreated, task)
	})

	// PUT /tasks/:id - Update task (e.g., for drag-and-drop)
	r.PUT("/tasks/:id", func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}
		var task Task
		if err := c.BindJSON(&task); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		// Validate that the main_assignee_id exists in Users table if it's not 0
		if task.MainAssigneeID != 0 {
			var userExists bool
			err = db.Get(&userExists, "SELECT CASE WHEN EXISTS(SELECT 1 FROM Users WHERE id = ?) THEN 1 ELSE 0 END", task.MainAssigneeID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate assignee"})
				return
			}
			if !userExists {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Main assignee ID does not exist"})
				return
			}
		}
		
		_, err = db.Exec(
			`UPDATE Tasks SET title = ?, description = ?, priority = ?, type = ?, main_assignee_id = ?,
			 supporting_assignees = ?, schedule = ?, completed = ?, archived = ?
			 WHERE id = ?`,
			task.Title, task.Description, task.Priority, task.Type, task.MainAssigneeID,
			task.SupportingAssignees, task.Schedule, task.Completed, task.Archived, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, task) // Return full task
	})

	// DELETE /tasks/:id
	r.DELETE("/tasks/:id", func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}
		_, err = db.Exec("DELETE FROM Tasks WHERE id = ?", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	})

	// POST /tasks/:id/subtasks
	r.POST("/tasks/:id/subtasks", func(c *gin.Context) {
		taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		var subtask Subtask
		if err := c.BindJSON(&subtask); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		// Validate that the main_assignee_id exists in Users table if it's not 0
		if subtask.MainAssigneeID != 0 {
			var userExists bool
			err = db.Get(&userExists, "SELECT CASE WHEN EXISTS(SELECT 1 FROM Users WHERE id = ?) THEN 1 ELSE 0 END", subtask.MainAssigneeID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate assignee"})
				return
			}
			if !userExists {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Main assignee ID does not exist"})
				return
			}
		}
		
		res, err := db.Exec(
			`INSERT INTO Subtasks (task_id, title, completed, main_assignee_id, supporting_assignees, schedule)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			taskID, subtask.Title, subtask.Completed, subtask.MainAssigneeID, subtask.SupportingAssignees, subtask.Schedule)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		id, _ := res.LastInsertId()
		subtask.ID = id
		subtask.TaskID = taskID
		c.JSON(http.StatusCreated, subtask)
	})

	// PUT /tasks/:id/subtasks/:subtaskId - Update subtask
	r.PUT("/tasks/:id/subtasks/:subtaskId", func(c *gin.Context) {
		taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		subtaskID, err := strconv.ParseInt(c.Param("subtaskId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subtask ID"})
			return
		}
		var subtask Subtask
		if err := c.BindJSON(&subtask); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		// Validate that the main_assignee_id exists in Users table if it's not 0
		if subtask.MainAssigneeID != 0 {
			var userExists bool
			err = db.Get(&userExists, "SELECT CASE WHEN EXISTS(SELECT 1 FROM Users WHERE id = ?) THEN 1 ELSE 0 END", subtask.MainAssigneeID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate assignee"})
				return
			}
			if !userExists {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Main assignee ID does not exist"})
				return
			}
		}
		
		_, err = db.Exec(
			`UPDATE Subtasks SET title = ?, completed = ?, main_assignee_id = ?, supporting_assignees = ?, schedule = ?
			 WHERE id = ? AND task_id = ?`,
			subtask.Title, subtask.Completed, subtask.MainAssigneeID, subtask.SupportingAssignees, subtask.Schedule,
			subtaskID, taskID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		subtask.ID = subtaskID
		subtask.TaskID = taskID
		c.JSON(http.StatusOK, subtask)
	})

	// DELETE /tasks/:id/subtasks/:subtaskId - Delete subtask
	r.DELETE("/tasks/:id/subtasks/:subtaskId", func(c *gin.Context) {
		taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		subtaskID, err := strconv.ParseInt(c.Param("subtaskId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subtask ID"})
			return
		}
		_, err = db.Exec("DELETE FROM Subtasks WHERE id = ? AND task_id = ?", subtaskID, taskID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	})

	// POST /tasks/clear - Clear all non-archived tasks
	r.POST("/tasks/clear", func(c *gin.Context) {
		_, err := db.Exec("DELETE FROM Tasks WHERE archived = 0")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "cleared"})
	})

	r.Run(":8080")
}
