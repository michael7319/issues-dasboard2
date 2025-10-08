package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/microsoft/go-mssqldb"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// SQL models (nullable fields where appropriate)
type sqlTask struct {
	ID                  int64          `db:"id"`
	Title               string         `db:"title"`
	Description         sql.NullString `db:"description"`
	Priority            sql.NullString `db:"priority"`
	Type                sql.NullString `db:"type"`
	Completed           bool           `db:"completed"`
	Archived            bool           `db:"archived"`
	Pinned              bool           `db:"pinned"`
	CreatedAt           time.Time      `db:"created_at"`
	MainAssigneeID      sql.NullInt64  `db:"main_assignee_id"`
	SupportingAssignees sql.NullString `db:"supporting_assignees"`
	Schedule            sql.NullString `db:"schedule"`
}

type sqlSubtask struct {
	ID                  int64          `db:"id"`
	TaskID              int64          `db:"task_id"`
	Title               string         `db:"title"`
	Completed           bool           `db:"completed"`
	MainAssigneeID      sql.NullInt64  `db:"main_assignee_id"`
	SupportingAssignees sql.NullString `db:"supporting_assignees"`
	Schedule            sql.NullString `db:"schedule"`
}

type sqlUser struct {
	ID   int64  `db:"id"`
	Name string `db:"name"`
}

func main() {
	// CLI flags / env
	var sqlConn string
	var mongoURI string
	var dryRun bool
	flag.StringVar(&sqlConn, "sql", "", "SQL Server connection string (or set SQL_CONN)")
	flag.StringVar(&mongoURI, "mongo", "", "MongoDB URI (or set MONGO_URI)")
	flag.BoolVar(&dryRun, "dry-run", false, "If set, do not write to MongoDB; just print what would be done")
	flag.Parse()

	if sqlConn == "" {
		sqlConn = os.Getenv("SQL_CONN")
	}
	if sqlConn == "" {
		// default used in original project
		sqlConn = "server=MICHAEL,1433;database=issues_tasks_db;trusted_connection=true;TrustServerCertificate=true;"
	}
	if mongoURI == "" {
		mongoURI = os.Getenv("MONGO_URI")
	}
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	log.Println("SQL_CONN:", sqlConn)
	log.Println("MONGO_URI:", mongoURI)
	if dryRun {
		log.Println("DRY RUN: no writes will be performed to MongoDB")
	}

	// Connect to SQL Server
	sqlDb, err := sqlx.Open("mssql", sqlConn)
	if err != nil {
		log.Fatalf("failed to open sql connection: %v", err)
	}
	defer sqlDb.Close()
	if err := sqlDb.Ping(); err != nil {
		log.Fatalf("failed to ping sql: %v", err)
	}

	// Connect to Mongo
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("failed to connect mongo: %v", err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()
	db := client.Database("issues_tasks_db")

	// Migrate users
	users := []sqlUser{}
	if err := sqlDb.Select(&users, "SELECT id, name FROM Users ORDER BY id"); err != nil {
		log.Printf("warning: could not read Users: %v (continuing)", err)
	} else {
		usersColl := db.Collection("users")
		for _, u := range users {
			doc := bson.M{"id": u.ID, "name": u.Name}
			if dryRun {
				log.Printf("DRY RUN: would upsert user id=%d doc=%v", u.ID, doc)
			} else {
				_, err := usersColl.UpdateOne(context.Background(), bson.M{"id": u.ID}, bson.M{"$set": doc}, options.Update().SetUpsert(true))
				if err != nil {
					log.Fatalf("failed to upsert user %d: %v", u.ID, err)
				}
			}
		}
		log.Printf("migrated %d users", len(users))
	}

	// Migrate tasks
	sqlTasks := []sqlTask{}
	if err := sqlDb.Select(&sqlTasks, "SELECT id, title, description, priority, type, completed, archived, pinned, created_at, main_assignee_id, supporting_assignees, schedule FROM Tasks ORDER BY id"); err != nil {
		log.Fatalf("failed to select tasks: %v", err)
	}
	tasksColl := db.Collection("tasks")
	var maxTaskID int64
	for _, t := range sqlTasks {
		doc := bson.M{
			"id":         t.ID,
			"title":      t.Title,
			"completed":  t.Completed,
			"archived":   t.Archived,
			"pinned":     t.Pinned,
			"created_at": t.CreatedAt,
		}
		if t.Description.Valid {
			doc["description"] = t.Description.String
		}
		if t.Priority.Valid {
			doc["priority"] = t.Priority.String
		}
		if t.Type.Valid {
			doc["type"] = t.Type.String
		}
		if t.MainAssigneeID.Valid {
			doc["main_assignee_id"] = int(t.MainAssigneeID.Int64)
		}
		if t.SupportingAssignees.Valid {
			doc["supporting_assignees"] = t.SupportingAssignees.String
		}
		if t.Schedule.Valid {
			doc["schedule"] = t.Schedule.String
		}

		if dryRun {
			log.Printf("DRY RUN: would upsert task id=%d doc keys=%v", t.ID, func() []string {
				keys := make([]string, 0, len(doc))
				for k := range doc {
					keys = append(keys, k)
				}
				return keys
			}())
		} else {
			_, err := tasksColl.UpdateOne(context.Background(), bson.M{"id": t.ID}, bson.M{"$set": doc}, options.Update().SetUpsert(true))
			if err != nil {
				log.Fatalf("failed to upsert task %d: %v", t.ID, err)
			}
		}
		if t.ID > maxTaskID {
			maxTaskID = t.ID
		}
	}
	log.Printf("migrated %d tasks (max id=%d)", len(sqlTasks), maxTaskID)

	// Migrate subtasks
	sqlSubs := []sqlSubtask{}
	if err := sqlDb.Select(&sqlSubs, "SELECT id, task_id, title, completed, main_assignee_id, supporting_assignees, schedule FROM Subtasks ORDER BY id"); err != nil {
		log.Fatalf("failed to select subtasks: %v", err)
	}
	subsColl := db.Collection("subtasks")
	var maxSubID int64
	for _, s := range sqlSubs {
		doc := bson.M{
			"id":        s.ID,
			"task_id":   s.TaskID,
			"title":     s.Title,
			"completed": s.Completed,
		}
		if s.MainAssigneeID.Valid {
			doc["main_assignee_id"] = int(s.MainAssigneeID.Int64)
		}
		if s.SupportingAssignees.Valid {
			doc["supporting_assignees"] = s.SupportingAssignees.String
		}
		if s.Schedule.Valid {
			doc["schedule"] = s.Schedule.String
		}

		if dryRun {
			log.Printf("DRY RUN: would upsert subtask id=%d task_id=%d doc keys=%v", s.ID, s.TaskID, func() []string {
				keys := make([]string, 0, len(doc))
				for k := range doc {
					keys = append(keys, k)
				}
				return keys
			}())
		} else {
			_, err := subsColl.UpdateOne(context.Background(), bson.M{"id": s.ID}, bson.M{"$set": doc}, options.Update().SetUpsert(true))
			if err != nil {
				log.Fatalf("failed to upsert subtask %d: %v", s.ID, err)
			}
		}
		if s.ID > maxSubID {
			maxSubID = s.ID
		}
	}
	log.Printf("migrated %d subtasks (max id=%d)", len(sqlSubs), maxSubID)

	// Update counters
	counters := db.Collection("counters")
	if maxTaskID > 0 {
		if dryRun {
			log.Printf("DRY RUN: would set counter 'taskid' to %d", maxTaskID)
		} else {
			_, err := counters.UpdateOne(context.Background(), bson.M{"_id": "taskid"}, bson.M{"$set": bson.M{"seq": maxTaskID}}, options.Update().SetUpsert(true))
			if err != nil {
				log.Fatalf("failed to set task counter: %v", err)
			}
		}
	}
	if maxSubID > 0 {
		if dryRun {
			log.Printf("DRY RUN: would set counter 'subtaskid' to %d", maxSubID)
		} else {
			_, err := counters.UpdateOne(context.Background(), bson.M{"_id": "subtaskid"}, bson.M{"$set": bson.M{"seq": maxSubID}}, options.Update().SetUpsert(true))
			if err != nil {
				log.Fatalf("failed to set subtask counter: %v", err)
			}
		}
	}
	// users counter if present
	var maxUserID int64
	if len(users) > 0 {
		for _, u := range users {
			if u.ID > maxUserID {
				maxUserID = u.ID
			}
		}
		if maxUserID > 0 {
			if dryRun {
				log.Printf("DRY RUN: would set counter 'userid' to %d", maxUserID)
			} else {
				_, err := counters.UpdateOne(context.Background(), bson.M{"_id": "userid"}, bson.M{"$set": bson.M{"seq": maxUserID}}, options.Update().SetUpsert(true))
				if err != nil {
					log.Fatalf("failed to set user counter: %v", err)
				}
			}
		}
	}

	fmt.Println("Migration finished successfully.")
}
