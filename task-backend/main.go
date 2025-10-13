package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Task uses a numeric `id` field so frontend doesn't need to change.
type Task struct {
	ID                  int64     `bson:"id" json:"id"`
	Title               string    `json:"title" bson:"title"`
	Description         *string   `json:"description,omitempty" bson:"description,omitempty"`
	Priority            *string   `json:"priority,omitempty" bson:"priority,omitempty"`
	Type                *string   `json:"type,omitempty" bson:"type,omitempty"`
	Completed           bool      `json:"completed" bson:"completed"`
	Archived            bool      `json:"archived" bson:"archived"`
	Pinned              bool      `json:"pinned" bson:"pinned"`
	CreatedAt           time.Time `json:"created_at" bson:"created_at"`
	MainAssigneeID      *int      `json:"main_assignee_id,omitempty" bson:"main_assignee_id,omitempty"`
	SupportingAssignees *string   `json:"supporting_assignees,omitempty" bson:"supporting_assignees,omitempty"`
	Schedule            *string   `json:"schedule,omitempty" bson:"schedule,omitempty"`
	Subtasks            []Subtask `json:"subtasks,omitempty" bson:"-"`
}

type Subtask struct {
	ID                  int64   `bson:"id" json:"id"`
	TaskID              int64   `json:"task_id" bson:"task_id"`
	Title               string  `json:"title" bson:"title"`
	Completed           bool    `json:"completed" bson:"completed"`
	MainAssigneeID      *int    `json:"main_assignee_id,omitempty" bson:"main_assignee_id,omitempty"`
	SupportingAssignees *string `json:"supporting_assignees,omitempty" bson:"supporting_assignees,omitempty"`
	Schedule            *string `json:"schedule,omitempty" bson:"schedule,omitempty"`
}

type User struct {
	ID   int64  `bson:"id" json:"id"`
	Name string `bson:"name" json:"name"`
}

func main() {
	// Connect to MongoDB (default localhost)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	//client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb+srv://rachealaudu_db_user:Collectionz_2015@cluster0.gr27rks.mongodb.net/?retryWrites=true&w=majority"))
	if err != nil {
		log.Fatal("Failed to connect to MongoDB:", err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()
	if err := client.Ping(context.Background(), nil); err != nil {
		log.Fatal("Failed to ping MongoDB:", err)
	}
	log.Println("Connected to MongoDB")

	//db := client.Database("issues_tasks_db")
	db := client.Database("task_manager_db")

	r := gin.Default()

	// Configure CORS to allow network access
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}
	r.Use(cors.New(config))

	// helper to get next sequence number
	getNextSeq := func(ctx context.Context, name string) (int64, error) {
		counters := db.Collection("counters")
		opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
		var out bson.M
		err := counters.FindOneAndUpdate(ctx, bson.M{"_id": name}, bson.M{"$inc": bson.M{"seq": 1}}, opts).Decode(&out)
		if err != nil {
			return 0, err
		}
		switch v := out["seq"].(type) {
		case int32:
			return int64(v), nil
		case int64:
			return v, nil
		case float64:
			return int64(v), nil
		default:
			return 0, nil
		}
	}

	// GET /tasks/recent
	r.GET("/tasks/recent", func(c *gin.Context) {
		ctx := c.Request.Context()
		tasksColl := db.Collection("tasks")
		filter := bson.M{"archived": false} // Only filter out archived tasks, show both completed and incomplete
		op := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(5)
		cur, err := tasksColl.Find(ctx, filter, op)
		if err != nil {
			log.Println("/tasks/recent Find error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var tasks []Task
		if err := cur.All(ctx, &tasks); err != nil {
			log.Println("/tasks/recent cursor.All error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, tasks)
	})

	// GET /users
	r.GET("/users", func(c *gin.Context) {
		ctx := c.Request.Context()
		usersColl := db.Collection("users")
		cur, err := usersColl.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "name", Value: 1}}))
		if err != nil {
			log.Println("/users Find error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var users []User
		if err := cur.All(ctx, &users); err != nil {
			log.Println("/users cursor.All error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, users)
	})

	// GET /tasks
	r.GET("/tasks", func(c *gin.Context) {
		ctx := c.Request.Context()
		tasksColl := db.Collection("tasks")
		subtasksColl := db.Collection("subtasks")
		cur, err := tasksColl.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "pinned", Value: -1}, {Key: "created_at", Value: -1}}))
		if err != nil {
			log.Println("/tasks Find error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var tasks []Task
		if err := cur.All(ctx, &tasks); err != nil {
			log.Println("/tasks cursor.All error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for i := range tasks {
			subCur, err := subtasksColl.Find(ctx, bson.M{"task_id": tasks[i].ID})
			if err != nil {
				log.Println("subtasks Find error:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			var subs []Subtask
			if err := subCur.All(ctx, &subs); err != nil {
				log.Println("subtasks cursor.All error:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			tasks[i].Subtasks = subs
		}
		c.JSON(http.StatusOK, tasks)
	})

	// POST /tasks
	r.POST("/tasks", func(c *gin.Context) {
		ctx := c.Request.Context()
		var task Task
		if err := c.BindJSON(&task); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if task.CreatedAt.IsZero() {
			task.CreatedAt = time.Now().UTC()
		}
		seq, err := getNextSeq(ctx, "taskid")
		if err != nil {
			log.Println("getNextSeq error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
			return
		}
		task.ID = seq
		tasksColl := db.Collection("tasks")
		if _, err := tasksColl.InsertOne(ctx, task); err != nil {
			log.Println("tasks InsertOne error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, task)
	})

	// PUT /tasks/:id
	r.PUT("/tasks/:id", func(c *gin.Context) {
		ctx := c.Request.Context()
		idStr := c.Param("id")
		idNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}
		var updateData map[string]interface{}
		if err := c.BindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		delete(updateData, "id")
		tasksColl := db.Collection("tasks")
		if _, err := tasksColl.UpdateOne(ctx, bson.M{"id": idNum}, bson.M{"$set": updateData}); err != nil {
			log.Println("tasks UpdateOne error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var updated Task
		if err := tasksColl.FindOne(ctx, bson.M{"id": idNum}).Decode(&updated); err != nil {
			log.Println("tasks FindOne after update error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch updated task"})
			return
		}

		// Fetch subtasks for the updated task
		subtasksColl := db.Collection("subtasks")
		subCur, err := subtasksColl.Find(ctx, bson.M{"task_id": updated.ID})
		if err != nil {
			log.Println("subtasks Find error:", err)
		} else {
			var subtasks []Subtask
			if err := subCur.All(ctx, &subtasks); err != nil {
				log.Println("subtasks cursor.All error:", err)
			} else {
				updated.Subtasks = subtasks
			}
		}

		c.JSON(http.StatusOK, updated)
	})

	// DELETE /tasks/:id
	r.DELETE("/tasks/:id", func(c *gin.Context) {
		ctx := c.Request.Context()
		idStr := c.Param("id")
		idNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}
		tasksColl := db.Collection("tasks")
		if _, err := tasksColl.DeleteOne(ctx, bson.M{"id": idNum}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	})

	// POST /tasks/:id/subtasks
	r.POST("/tasks/:id/subtasks", func(c *gin.Context) {
		ctx := c.Request.Context()
		idStr := c.Param("id")
		taskIDNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		var raw map[string]interface{}
		if err := c.BindJSON(&raw); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		subtask := Subtask{}
		subtask.TaskID = taskIDNum
		if title, ok := raw["title"].(string); ok {
			subtask.Title = title
		}
		if completed, ok := raw["completed"].(bool); ok {
			subtask.Completed = completed
		}
		if mainAssignee, ok := raw["main_assignee_id"].(float64); ok {
			v := int(mainAssignee)
			subtask.MainAssigneeID = &v
		} else if mainAssignee, ok := raw["main_assignee_id"].(int); ok {
			subtask.MainAssigneeID = &mainAssignee
		}
		if sa, ok := raw["supporting_assignees"]; ok {
			switch v := sa.(type) {
			case string:
				subtask.SupportingAssignees = &v
			case []interface{}:
				b, _ := json.Marshal(v)
				s := string(b)
				subtask.SupportingAssignees = &s
			}
		}
		if sched, ok := raw["schedule"]; ok {
			switch v := sched.(type) {
			case string:
				subtask.Schedule = &v
			case map[string]interface{}:
				b, _ := json.Marshal(v)
				s := string(b)
				subtask.Schedule = &s
			}
		}
		seq, err := getNextSeq(ctx, "subtaskid")
		if err != nil {
			log.Println("subtask seq error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
			return
		}
		subtask.ID = seq
		subtasksColl := db.Collection("subtasks")
		if _, err := subtasksColl.InsertOne(ctx, subtask); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, subtask)
	})

	// PUT /tasks/:id/subtasks/:subtaskId
	r.PUT("/tasks/:id/subtasks/:subtaskId", func(c *gin.Context) {
		ctx := c.Request.Context()
		idStr := c.Param("id")
		subtaskStr := c.Param("subtaskId")
		taskIDNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		subtaskIDNum, err := strconv.ParseInt(subtaskStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subtask ID"})
			return
		}
		var updateData map[string]interface{}
		if err := c.BindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		delete(updateData, "id")
		delete(updateData, "task_id")
		subtasksColl := db.Collection("subtasks")
		if _, err := subtasksColl.UpdateOne(ctx, bson.M{"id": subtaskIDNum, "task_id": taskIDNum}, bson.M{"$set": updateData}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var updated Subtask
		if err := subtasksColl.FindOne(ctx, bson.M{"id": subtaskIDNum, "task_id": taskIDNum}).Decode(&updated); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch updated subtask"})
			return
		}
		c.JSON(http.StatusOK, updated)
	})

	// DELETE /tasks/:id/subtasks/:subtaskId
	r.DELETE("/tasks/:id/subtasks/:subtaskId", func(c *gin.Context) {
		ctx := c.Request.Context()
		idStr := c.Param("id")
		subtaskStr := c.Param("subtaskId")
		taskIDNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		subtaskIDNum, err := strconv.ParseInt(subtaskStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subtask ID"})
			return
		}
		subtasksColl := db.Collection("subtasks")
		if _, err := subtasksColl.DeleteOne(ctx, bson.M{"id": subtaskIDNum, "task_id": taskIDNum}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	})

	// POST /tasks/clear
	r.POST("/tasks/clear", func(c *gin.Context) {
		ctx := c.Request.Context()
		tasksColl := db.Collection("tasks")
		if _, err := tasksColl.DeleteMany(ctx, bson.M{"archived": false}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "cleared"})
	})

	r.Run(":8080")
}
