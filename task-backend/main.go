package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Task uses a numeric `id` field so frontend doesn't need to change.
type Task struct {
	ID                  int64        `bson:"id" json:"id"`
	Title               string       `json:"title" bson:"title"`
	Description         *string      `json:"description,omitempty" bson:"description,omitempty"`
	Priority            *string      `json:"priority,omitempty" bson:"priority,omitempty"`
	Type                *string      `json:"type,omitempty" bson:"type,omitempty"`
	Completed           bool         `json:"completed" bson:"completed"`
	Archived            bool         `json:"archived" bson:"archived"`
	Pinned              bool         `json:"pinned" bson:"pinned"`
	CreatedAt           time.Time    `json:"created_at" bson:"created_at"`
	MainAssigneeID      *int         `json:"main_assignee_id,omitempty" bson:"main_assignee_id,omitempty"`
	SupportingAssignees *string      `json:"supporting_assignees,omitempty" bson:"supporting_assignees,omitempty"`
	Schedule            *string      `json:"schedule,omitempty" bson:"schedule,omitempty"`
	Subtasks            []Subtask    `json:"subtasks,omitempty" bson:"-"`
	Attachments         []Attachment `json:"attachments,omitempty" bson:"-"`
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

type Attachment struct {
	ID        int64     `bson:"id" json:"id"`
	TaskID    int64     `json:"task_id" bson:"task_id"`
	Type      string    `json:"type" bson:"type"` // "link", "file"
	Name      string    `json:"name" bson:"name"`
	URL       string    `json:"url" bson:"url"`
	Size      any       `json:"size,omitempty" bson:"size,omitempty"` // Can be int64 or string from DB
	MimeType  *string   `json:"mime_type,omitempty" bson:"mime_type,omitempty"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
}

type User struct {
	ID   int64  `bson:"id" json:"id"`
	Name string `bson:"name" json:"name"`
}

const fileServerBase = "http://41.76.198.1:9091"

// fileServerClient uses a generous timeout for proxying large file
// uploads/downloads to the external file server. Keep-alives are enabled
// (default) so connections are reused; the retry logic in uploadToFileServer
// handles the case where a pooled connection has been closed by the server.
var fileServerClient = &http.Client{
	Timeout: 3 * time.Minute,
}

func uploadToFileServer(file multipart.File, filename string, fileSize int64) (string, error) {
	// Buffer the entire multipart body first so we know its size and can
	// retry without needing to re-read the (already-consumed) source file.
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("files", filename)
	if err != nil {
		return "", err
	}
	copied, err := io.Copy(part, file)
	if err != nil {
		return "", fmt.Errorf("reading uploaded file: %w", err)
	}
	writer.Close()

	body := buf.Bytes()
	contentType := writer.FormDataContentType()
	log.Printf("uploadToFileServer: file=%q declared=%d bytes read=%d multipart_body=%d bytes",
		filename, fileSize, copied, len(body))

	var lastErr error
	for attempt := 1; attempt <= 2; attempt++ {
		req, err := http.NewRequest("POST", fileServerBase+"/upload/issuesDashboard", bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", contentType)
		// Suppress Go's automatic "Expect: 100-continue" header.
		// Nginx rejects large requests at the header stage when it sees
		// Expect: 100-continue + a Content-Length over client_max_body_size,
		// but allows the same upload from browsers (which don't send Expect).
		req.Header.Set("Expect", "")
		// Don't set ContentLength — let Go use chunked transfer encoding.
		// This avoids nginx rejecting based on Content-Length before reading.
		req.ContentLength = -1
		log.Printf("uploadToFileServer attempt %d: POST %s body=%d bytes (chunked)",
			attempt, fileServerBase+"/upload/issuesDashboard", len(body))

		resp, err := fileServerClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("could not reach file server: %w", err)
			log.Printf("uploadToFileServer attempt %d network error: %v", attempt, lastErr)
			continue // retry
		}

		respBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		log.Printf("uploadToFileServer attempt %d: response status=%d body=%s",
			attempt, resp.StatusCode, strings.TrimSpace(string(respBytes)))

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return "", fmt.Errorf("file server returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
		}

		var result struct {
			Data []string `json:"Data"`
		}
		if err := json.Unmarshal(respBytes, &result); err != nil {
			return "", fmt.Errorf("file server response parse error: %w (body: %s)", err, strings.TrimSpace(string(respBytes)))
		}
		if len(result.Data) == 0 {
			return "", fmt.Errorf("file server returned empty path list (body: %s)", strings.TrimSpace(string(respBytes)))
		}
		return result.Data[0], nil
	}
	return "", lastErr
}

func deleteFromFileServer(filePath string) {
	req, err := http.NewRequest("DELETE", fileServerBase+"/delete?filepath="+url.QueryEscape(filePath), nil)
	if err != nil {
		log.Println("deleteFromFileServer request error:", err)
		return
	}
	resp, err := fileServerClient.Do(req)
	if err != nil {
		log.Println("deleteFromFileServer error:", err)
		return
	}
	resp.Body.Close()
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
	r.MaxMultipartMemory = 256 << 20 // 256 MB — matches our hard file size limit

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
		// Use a fresh context with longer timeout to avoid cancellation
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		// PERFORMANCE: Check if lightweight mode (exclude large base64 URLs)
		lightweight := c.DefaultQuery("lightweight", "true") == "true"

		tasksColl := db.Collection("tasks")
		subtasksColl := db.Collection("subtasks")
		attachmentsColl := db.Collection("attachments")
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

		// PERFORMANCE FIX: Batch fetch all subtasks and attachments in 2 queries instead of N+1
		allSubtasks := []Subtask{}
		if len(tasks) > 0 {
			subCur, err := subtasksColl.Find(ctx, bson.M{})
			if err != nil {
				log.Println("subtasks batch Find error:", err)
			} else {
				if err := subCur.All(ctx, &allSubtasks); err != nil {
					log.Println("subtasks batch cursor.All error:", err)
				}
			}
		}

		allAttachments := []Attachment{}
		if len(tasks) > 0 {
			attCur, err := attachmentsColl.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
			if err != nil {
				log.Println("attachments batch Find error:", err)
			} else {
				if err := attCur.All(ctx, &allAttachments); err != nil {
					log.Println("attachments batch cursor.All error:", err)
				}
			}
		}

		// Build lookup maps for O(1) access
		subtasksByTaskID := make(map[int64][]Subtask)
		for _, sub := range allSubtasks {
			subtasksByTaskID[sub.TaskID] = append(subtasksByTaskID[sub.TaskID], sub)
		}

		attachmentsByTaskID := make(map[int64][]Attachment)
		for _, att := range allAttachments {
			attachmentsByTaskID[att.TaskID] = append(attachmentsByTaskID[att.TaskID], att)
		}

		// Assign subtasks and attachments to tasks
		for i := range tasks {
			if subs, ok := subtasksByTaskID[tasks[i].ID]; ok {
				tasks[i].Subtasks = subs
			} else {
				tasks[i].Subtasks = []Subtask{}
			}

			if atts, ok := attachmentsByTaskID[tasks[i].ID]; ok {
				// Strip large base64 URLs in lightweight mode
				if lightweight {
					for j := range atts {
						if len(atts[j].URL) > 1000 {
							atts[j].URL = "" // Will be loaded on-demand
						}
					}
				}
				tasks[i].Attachments = atts
			} else {
				tasks[i].Attachments = []Attachment{}
			}
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

	// GET /tasks/:id/attachments
	r.GET("/tasks/:id/attachments", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		idStr := c.Param("id")
		taskIDNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		attachmentsColl := db.Collection("attachments")
		cur, err := attachmentsColl.Find(ctx, bson.M{"task_id": taskIDNum}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
		if err != nil {
			log.Println("attachments Find error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var attachments []Attachment
		if err := cur.All(ctx, &attachments); err != nil {
			log.Println("attachments cursor.All error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if attachments == nil {
			attachments = []Attachment{}
		}
		// Prevent browser from caching large attachment responses (base64 images)
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, attachments)
	})

	// POST /tasks/:id/attachments
	r.POST("/tasks/:id/attachments", func(c *gin.Context) {
		ctx := c.Request.Context()
		idStr := c.Param("id")
		taskIDNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}

		var attachment Attachment
		attachment.TaskID = taskIDNum
		attachment.CreatedAt = time.Now().UTC()

		const maxFileSizeBytes = 250 << 20 // 250 MB hard limit

		contentType := c.GetHeader("Content-Type")
		if len(contentType) >= 9 && contentType[:9] == "multipart" {
			// Gin parses with r.MaxMultipartMemory (256 MB) — no need for
			// explicit ParseMultipartForm or MaxBytesReader here.
			fileHeader, err := c.FormFile("file")
			if err != nil {
				log.Printf("FormFile error: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{"error": "Missing file field: " + err.Error()})
				return
			}

			if fileHeader.Size > maxFileSizeBytes {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("File too large (%d MB, max 250 MB)", fileHeader.Size>>20)})
				return
			}

			attachment.Type = c.PostForm("type")
			attachment.Name = c.PostForm("name")
			mimeType := c.PostForm("mime_type")
			attachment.MimeType = &mimeType

			f, err := fileHeader.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
				return
			}
			defer f.Close()

			filename := fileHeader.Filename
			if attachment.Name == "" {
				attachment.Name = filename
			}

			storedPath, err := uploadToFileServer(f, filename, fileHeader.Size)
			if err != nil {
				log.Println("uploadToFileServer error:", err)
				msg := fmt.Sprintf("Failed to upload to file server: %s", err.Error())
				c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
				return
			}
			attachment.URL = storedPath
			attachment.Size = fileHeader.Size
		} else {
			// JSON body — link type
			if err := c.BindJSON(&attachment); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			attachment.TaskID = taskIDNum
		}

		if attachment.CreatedAt.IsZero() {
			attachment.CreatedAt = time.Now().UTC()
		}

		seq, err := getNextSeq(ctx, "attachmentid")
		if err != nil {
			log.Println("attachment seq error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate id"})
			return
		}
		attachment.ID = seq
		attachmentsColl := db.Collection("attachments")
		if _, err := attachmentsColl.InsertOne(ctx, attachment); err != nil {
			log.Println("attachments InsertOne error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, attachment)
	})

	// DELETE /tasks/:id/attachments/:attachmentId
	r.DELETE("/tasks/:id/attachments/:attachmentId", func(c *gin.Context) {
		ctx := c.Request.Context()
		idStr := c.Param("id")
		attachmentStr := c.Param("attachmentId")
		taskIDNum, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		attachmentIDNum, err := strconv.ParseInt(attachmentStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attachment ID"})
			return
		}
		attachmentsColl := db.Collection("attachments")

		// Fetch attachment to get file path before deleting
		var existing Attachment
		if err := attachmentsColl.FindOne(ctx, bson.M{"id": attachmentIDNum, "task_id": taskIDNum}).Decode(&existing); err == nil {
			if existing.Type == "file" && existing.URL != "" {
				deleteFromFileServer(existing.URL)
			}
		}

		if _, err := attachmentsColl.DeleteOne(ctx, bson.M{"id": attachmentIDNum, "task_id": taskIDNum}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	})

	// GET /tasks/:id/attachments/:attachmentId/download
	// Proxies the file from the file server back to the client
	r.GET("/tasks/:id/attachments/:attachmentId/download", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		taskIDNum, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
			return
		}
		attIDNum, err := strconv.ParseInt(c.Param("attachmentId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attachment ID"})
			return
		}

		attachmentsColl := db.Collection("attachments")
		var att Attachment
		if err := attachmentsColl.FindOne(ctx, bson.M{"id": attIDNum, "task_id": taskIDNum}).Decode(&att); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found"})
			return
		}

		if att.Type != "file" || att.URL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Not a file attachment"})
			return
		}

		fileURL := fileServerBase + "/download?filepath=" + url.QueryEscape(att.URL)
		req, err := http.NewRequest("GET", fileURL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build request"})
			return
		}
		resp, err := fileServerClient.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "File server unreachable"})
			return
		}
		defer resp.Body.Close()

		var fsResp struct {
			Data struct {
				Filename  string `json:"Filename"`
				FileBytes string `json:"FileBytes"`
			} `json:"Data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&fsResp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode file server response"})
			return
		}

		fileBytes, err := base64.StdEncoding.DecodeString(fsResp.Data.FileBytes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode file bytes"})
			return
		}

		filename := fsResp.Data.Filename
		if filename == "" {
			filename = att.Name
		}

		mimeType := "application/octet-stream"
		if att.MimeType != nil && *att.MimeType != "" && *att.MimeType != "application/octet-stream" {
			mimeType = *att.MimeType
		} else {
			// Fallback: detect from file extension (mime.TypeByExtension can be unreliable on Windows)
			ext := strings.ToLower(filepath.Ext(filename))
			knownMimes := map[string]string{
				".jpg":  "image/jpeg",
				".jpeg": "image/jpeg",
				".jfif": "image/jpeg",
				".png":  "image/png",
				".gif":  "image/gif",
				".webp": "image/webp",
				".bmp":  "image/bmp",
				".svg":  "image/svg+xml",
				".avif": "image/avif",
				".tiff": "image/tiff",
				".tif":  "image/tiff",
				".ico":  "image/x-icon",
				".heic": "image/heic",
				".heif": "image/heif",
				".mp4":  "video/mp4",
				".webm": "video/webm",
				".mov":  "video/quicktime",
				".avi":  "video/x-msvideo",
				".mkv":  "video/x-matroska",
				".ogg":  "video/ogg",
				".pdf":  "application/pdf",
				".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				".xls":  "application/vnd.ms-excel",
				".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				".doc":  "application/msword",
				".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
				".zip":  "application/zip",
				".txt":  "text/plain",
				".csv":  "text/csv",
			}
			if m, ok := knownMimes[ext]; ok {
				mimeType = m
			} else if detected := mime.TypeByExtension(ext); detected != "" {
				mimeType = detected
			}
		}

		// ?inline=1 → Content-Disposition: inline (for browser preview)
		// default → Content-Disposition: attachment (force download)
		disposition := "attachment"
		if c.Query("inline") == "1" {
			disposition = "inline"
		}

		c.Header("Content-Disposition", disposition+`; filename="`+filename+`"`)
		c.Header("Content-Type", mimeType)
		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, mimeType, fileBytes)
	})

	r.Run(":8080")
}
