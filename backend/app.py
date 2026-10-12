
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database file stays inside the backend folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "smartresolve.db")


# ---------------- DATABASE CONNECTION ----------------

def get_db():
    conn = sqlite3.connect(DATABASE, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_database():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            location TEXT NOT NULL,
            description TEXT NOT NULL,
            affected INTEGER DEFAULT 1,
            priority TEXT DEFAULT 'Normal',
            status TEXT DEFAULT 'Pending',
            created_at TEXT,
            updated_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id INTEGER,
            message TEXT,
            created_at TEXT,
            FOREIGN KEY (complaint_id)
                REFERENCES complaints(id)
                ON DELETE CASCADE
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id INTEGER,
            rating INTEGER,
            comment TEXT,
            created_at TEXT
        )
    """)

    # Migrate older databases without deleting existing data.
    # Add any columns missing from an older complaints table.
    complaint_columns = {
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(complaints)"
        ).fetchall()
    }

    complaint_migrations = {
        "title": "TEXT",
        "category": "TEXT DEFAULT 'General'",
        "location": "TEXT",
        "description": "TEXT",
        "affected": "INTEGER DEFAULT 1",
        "priority": "TEXT DEFAULT 'Normal'",
        "status": "TEXT DEFAULT 'Pending'",
        "created_at": "TEXT",
        "updated_at": "TEXT"
    }

    for column, definition in complaint_migrations.items():
        if column not in complaint_columns:
            conn.execute(
                f"ALTER TABLE complaints ADD COLUMN {column} {definition}"
            )

    # Fix the error:
    # table timeline has no column named message
    timeline_columns = {
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(timeline)"
        ).fetchall()
    }

    timeline_migrations = {
        "complaint_id": "INTEGER",
        "message": "TEXT",
        "created_at": "TEXT"
    }

    for column, definition in timeline_migrations.items():
        if column not in timeline_columns:
            conn.execute(
                f"ALTER TABLE timeline ADD COLUMN {column} {definition}"
            )

    feedback_columns = {
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(feedback)"
        ).fetchall()
    }

    feedback_migrations = {
        "complaint_id": "INTEGER",
        "rating": "INTEGER",
        "comment": "TEXT",
        "created_at": "TEXT"
    }

    for column, definition in feedback_migrations.items():
        if column not in feedback_columns:
            conn.execute(
                f"ALTER TABLE feedback ADD COLUMN {column} {definition}"
            )

    conn.commit()
    conn.close()


def add_timeline_event(complaint_id, message):
    conn = get_db()
    conn.execute("""
        INSERT INTO timeline (complaint_id, message, created_at)
        VALUES (?, ?, ?)
    """, (
        complaint_id,
        message,
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ))
    conn.commit()
    conn.close()


def complaint_to_dict(row):
    return dict(row)


# ---------------- HEALTH CHECK ----------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "success": True,
        "message": "SmartResolve AI backend is running"
    })


@app.route("/api/health", methods=["GET"])
def health():
    try:
        conn = get_db()
        conn.execute("SELECT 1").fetchone()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Backend and SQLite database connected"
        }), 200

    except sqlite3.Error as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# ---------------- DASHBOARD ----------------

@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    conn = get_db()

    total = conn.execute(
        "SELECT COUNT(*) FROM complaints"
    ).fetchone()[0]

    pending = conn.execute("""
        SELECT COUNT(*) FROM complaints
        WHERE LOWER(status) = 'pending'
    """).fetchone()[0]

    in_progress = conn.execute("""
        SELECT COUNT(*) FROM complaints
        WHERE LOWER(status) = 'in progress'
    """).fetchone()[0]

    resolved = conn.execute("""
        SELECT COUNT(*) FROM complaints
        WHERE LOWER(status) = 'resolved'
    """).fetchone()[0]

    urgent = conn.execute("""
        SELECT COUNT(*) FROM complaints
        WHERE LOWER(priority) = 'urgent'
    """).fetchone()[0]

    recent = conn.execute("""
        SELECT * FROM complaints
        ORDER BY id DESC
        LIMIT 10
    """).fetchall()

    conn.close()

    return jsonify({
        "success": True,
        "stats": {
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved,
            "urgent": urgent
        },
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "resolved": resolved,
        "urgent": urgent,
        "recent_complaints": [
            complaint_to_dict(row) for row in recent
        ]
    }), 200


# ---------------- GET ALL COMPLAINTS ----------------

@app.route("/api/complaints", methods=["GET"])
def get_complaints():
    conn = get_db()

    rows = conn.execute("""
        SELECT * FROM complaints
        ORDER BY id DESC
    """).fetchall()

    conn.close()

    complaints = [complaint_to_dict(row) for row in rows]

    return jsonify({
        "success": True,
        "complaints": complaints,
        "total": len(complaints)
    }), 200


# ---------------- SUBMIT COMPLAINT ----------------

@app.route("/api/complaints", methods=["POST"])
def create_complaint():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Please send valid JSON data"
        }), 400

    title = str(data.get("title", "")).strip()
    location = str(data.get("location", "")).strip()
    description = str(data.get("description", "")).strip()

    if not title or not location or not description:
        return jsonify({
            "success": False,
            "message": "Title, location and description are required"
        }), 400

    try:
        affected = int(data.get("affected", 1))
        if affected < 1:
            affected = 1
    except (TypeError, ValueError):
        affected = 1

    category = str(data.get("category", "General")).strip() or "General"

    # Simple rule-based priority classification
    urgent_words = (
        "urgent", "emergency", "danger", "accident",
        "severe", "critical", "overflow", "fire"
    )

    text_to_check = f"{title} {description}".lower()

    if any(word in text_to_check for word in urgent_words) or affected >= 100:
        priority = "Urgent"
    elif affected >= 25:
        priority = "High"
    else:
        priority = "Normal"

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()

    try:
        cursor = conn.execute("""
            INSERT INTO complaints (
                title, category, location, description,
                affected, priority, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            title, category, location, description,
            affected, priority, "Pending", now, now
        ))

        complaint_id = cursor.lastrowid

        conn.execute("""
            INSERT INTO timeline (complaint_id, message, created_at)
            VALUES (?, ?, ?)
        """, (
            complaint_id,
            "Complaint submitted",
            now
        ))

        conn.commit()

        row = conn.execute(
            "SELECT * FROM complaints WHERE id = ?",
            (complaint_id,)
        ).fetchone()

        result = complaint_to_dict(row)

        return jsonify({
            "success": True,
            "message": "Complaint submitted successfully",
            "complaint": result,
            "data": result
        }), 201

    except sqlite3.Error as error:
        conn.rollback()
        app.logger.exception("Complaint submission failed")

        return jsonify({
            "success": False,
            "message": "Database error while submitting complaint",
            "error": str(error)
        }), 500

    finally:
        conn.close()


# ---------------- SINGLE COMPLAINT ----------------

@app.route("/api/complaints/<int:complaint_id>", methods=["GET"])
def get_complaint(complaint_id):
    conn = get_db()

    row = conn.execute(
        "SELECT * FROM complaints WHERE id = ?",
        (complaint_id,)
    ).fetchone()

    conn.close()

    if row is None:
        return jsonify({
            "success": False,
            "message": "Complaint not found"
        }), 404

    return jsonify({
        "success": True,
        "complaint": complaint_to_dict(row)
    }), 200


# ---------------- UPDATE COMPLAINT STATUS ----------------

@app.route("/api/complaints/<int:complaint_id>/status", methods=["PUT", "PATCH"])
def update_status(complaint_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Please send a status"
        }), 400

    status = str(data.get("status", "")).strip()
    allowed_statuses = ["Pending", "In Progress", "Resolved"]

    matched_status = next(
        (item for item in allowed_statuses
         if item.lower() == status.lower()),
        None
    )

    if not matched_status:
        return jsonify({
            "success": False,
            "message": "Status must be Pending, In Progress or Resolved"
        }), 400

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()

    try:
        existing = conn.execute(
            "SELECT id FROM complaints WHERE id = ?",
            (complaint_id,)
        ).fetchone()

        if existing is None:
            return jsonify({
                "success": False,
                "message": "Complaint not found"
            }), 404

        conn.execute("""
            UPDATE complaints
            SET status = ?, updated_at = ?
            WHERE id = ?
        """, (matched_status, now, complaint_id))

        conn.execute("""
            INSERT INTO timeline (complaint_id, message, created_at)
            VALUES (?, ?, ?)
        """, (
            complaint_id,
            f"Status updated to {matched_status}",
            now
        ))

        conn.commit()

        updated = conn.execute(
            "SELECT * FROM complaints WHERE id = ?",
            (complaint_id,)
        ).fetchone()

        return jsonify({
            "success": True,
            "message": "Complaint status updated successfully",
            "complaint": complaint_to_dict(updated)
        }), 200

    except sqlite3.Error as error:
        conn.rollback()
        app.logger.exception("Status update failed")

        return jsonify({
            "success": False,
            "message": "Could not update status",
            "error": str(error)
        }), 500

    finally:
        conn.close()


# ---------------- COMPLAINT TIMELINE ----------------

@app.route("/api/complaints/<int:complaint_id>/timeline", methods=["GET"])
def get_complaint_timeline(complaint_id):
    conn = get_db()

    complaint = conn.execute(
        "SELECT id FROM complaints WHERE id = ?",
        (complaint_id,)
    ).fetchone()

    if complaint is None:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Complaint not found"
        }), 404

    events = conn.execute("""
        SELECT id, complaint_id, message, created_at
        FROM timeline
        WHERE complaint_id = ?
        ORDER BY id ASC
    """, (complaint_id,)).fetchall()

    conn.close()

    result = [dict(row) for row in events]

    return jsonify({
        "success": True,
        "timeline": result,
        "events": result
    }), 200


# ---------------- ANALYTICS ----------------

@app.route("/api/analytics", methods=["GET"])
def analytics():
    conn = get_db()

    by_status = conn.execute("""
        SELECT status, COUNT(*) AS count
        FROM complaints
        GROUP BY status
    """).fetchall()

    by_priority = conn.execute("""
        SELECT priority, COUNT(*) AS count
        FROM complaints
        GROUP BY priority
    """).fetchall()

    by_category = conn.execute("""
        SELECT category, COUNT(*) AS count
        FROM complaints
        GROUP BY category
        ORDER BY count DESC
    """).fetchall()

    daily = conn.execute("""
        SELECT substr(created_at, 1, 10) AS date,
               COUNT(*) AS count
        FROM complaints
        GROUP BY substr(created_at, 1, 10)
        ORDER BY date DESC
        LIMIT 7
    """).fetchall()

    conn.close()

    return jsonify({
        "success": True,
        "by_status": [dict(row) for row in by_status],
        "by_priority": [dict(row) for row in by_priority],
        "by_category": [dict(row) for row in by_category],
        "daily": [dict(row) for row in reversed(daily)]
    }), 200


# ---------------- AI INSIGHTS ----------------

@app.route("/api/insights", methods=["GET"])
@app.route("/api/ai-insights", methods=["GET"])
def insights():
    conn = get_db()

    total = conn.execute(
        "SELECT COUNT(*) FROM complaints"
    ).fetchone()[0]

    pending = conn.execute("""
        SELECT COUNT(*) FROM complaints
        WHERE LOWER(status) = 'pending'
    """).fetchone()[0]

    urgent = conn.execute("""
        SELECT COUNT(*) FROM complaints
        WHERE LOWER(priority) = 'urgent'
    """).fetchone()[0]

    top_location = conn.execute("""
        SELECT location, COUNT(*) AS count
        FROM complaints
        GROUP BY location
        ORDER BY count DESC
        LIMIT 1
    """).fetchone()

    conn.close()

    messages = []

    if total == 0:
        messages.append("No complaints are available for analysis yet.")
    else:
        messages.append(f"{total} complaint(s) have been recorded.")

        if pending:
            messages.append(
                f"{pending} complaint(s) are awaiting resolution."
            )

        if urgent:
            messages.append(
                f"{urgent} complaint(s) have urgent priority."
            )

        if top_location:
            messages.append(
                f"Most reported location: {top_location['location']} "
                f"({top_location['count']} complaint(s))."
            )

    return jsonify({
        "success": True,
        "insights": messages,
        "engine": "Rule-based complaint analysis",
        "note": "These are rule-based insights, not a live generative AI model."
    }), 200


# ---------------- FEEDBACK ----------------

@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Please send valid JSON data"
        }), 400

    try:
        complaint_id = int(data.get("complaint_id"))
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Valid complaint_id and rating are required"
        }), 400

    if not 1 <= rating <= 5:
        return jsonify({
            "success": False,
            "message": "Rating must be between 1 and 5"
        }), 400

    comment = str(data.get("comment", "")).strip()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()

    try:
        complaint = conn.execute(
            "SELECT id FROM complaints WHERE id = ?",
            (complaint_id,)
        ).fetchone()

        if complaint is None:
            return jsonify({
                "success": False,
                "message": "Complaint not found"
            }), 404

        conn.execute("""
            INSERT INTO feedback (
                complaint_id, rating, comment, created_at
            )
            VALUES (?, ?, ?, ?)
        """, (complaint_id, rating, comment, now))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Feedback submitted successfully"
        }), 201

    except sqlite3.Error as error:
        conn.rollback()
        app.logger.exception("Feedback submission failed")

        return jsonify({
            "success": False,
            "message": "Could not save feedback",
            "error": str(error)
        }), 500

    finally:
        conn.close()


# ---------------- START SERVER ----------------

if __name__ == "__main__":
    initialize_database()
    print("SmartResolve AI backend starting...")
    print("Health check: http://127.0.0.1:5000/api/health")
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
