from flask import Flask, abort, jsonify, render_template, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import date

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///awsquest.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class PlayerProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.String(80), unique=True, nullable=False)
    xp = db.Column(db.Integer, default=0)
    gems = db.Column(db.Integer, default=135)
    hearts = db.Column(db.Integer, default=5)
    streak = db.Column(db.Integer, default=1)
    completed_levels = db.Column(db.Text, default="")
    best_scores = db.Column(db.Text, default="")


LEVELS = [
    {"id": "s3", "emoji": "🗄️", "title": "S3 — Storage Warehouse", "short": "Storage",
     "description": "Store and retrieve shop files with object storage.", "xp": 50},
    {"id": "ec2", "emoji": "💻", "title": "EC2 — Power the Shop", "short": "Compute",
     "description": "Learn the basics of virtual servers and compute capacity.", "xp": 50},
    {"id": "iam", "emoji": "🔐", "title": "IAM — The Security Guard", "short": "Permissions",
     "description": "Control who can access what.", "xp": 50},
    {"id": "lambda", "emoji": "⚡", "title": "Lambda — Automate the Shop", "short": "Serverless Code",
     "description": "Run code in response to events.", "xp": 50},
    {"id": "aurora", "emoji": "🗃️", "title": "Aurora DSQL — Remember the Shop", "short": "Database",
     "description": "Explore shop data, records, and relationships.", "xp": 50},
    {"id": "final", "emoji": "🛒", "title": "Build the Shop", "short": "Final Challenge",
     "description": "Assemble the services into a working shop architecture.", "xp": 100},
]

QUESTIONS = {
    "s3": [
        {"q": "What is Amazon S3 primarily used for?",
         "options": ["Running virtual machines", "Storing and retrieving data", "Managing permissions", "Running serverless functions"],
         "answer": 1, "why": "S3 is an object storage service designed to store and retrieve objects such as images, documents and videos."},
        {"q": "Your shop has 20,000 product images. Which service is designed for storing them?",
         "options": ["Amazon EC2", "AWS IAM", "Amazon S3", "AWS Lambda"],
         "answer": 2, "why": "S3 is designed for object storage, making it a natural fit for product images and other files."},
        {"q": "In S3, what is a bucket?",
         "options": ["A container for objects", "A virtual machine", "A user role", "A serverless function"],
         "answer": 0, "why": "An S3 bucket is a container in which objects are stored."},
        {"q": "Which item is an example of an S3 object?",
         "options": ["A product-image.jpg file", "An IAM policy", "An EC2 instance", "A CPU core"],
         "answer": 0, "why": "Objects are the files and associated metadata stored in S3."},
        {"q": "Which statement best separates storage from compute?",
         "options": ["Storage keeps data; compute provides resources to run workloads.",
                     "Storage always runs code; compute only stores files.",
                     "They are exactly the same thing.", "Neither can be used by a web application."],
         "answer": 0, "why": "Storage services keep data, while compute services provide resources for running applications or workloads."},
    ],
    "ec2": [
        {"q": "What does Amazon EC2 provide?", "options": ["Virtual servers", "Only object storage", "Identity policies", "A relational query language"],
         "answer": 0, "why": "EC2 provides resizable compute capacity in the form of virtual servers."},
        {"q": "A shop website needs compute resources to run its application. Which service fits?", "options": ["S3", "EC2", "IAM", "S3 Glacier"],
         "answer": 1, "why": "EC2 is a compute service that can run application workloads."},
        {"q": "What does scaling generally mean?", "options": ["Adjusting resources to match demand", "Deleting all data", "Changing a password", "Creating a bucket"],
         "answer": 0, "why": "Scaling means adjusting capacity as workload demand changes."},
        {"q": "Which is primarily compute?", "options": ["Amazon EC2", "Amazon S3", "AWS IAM", "An S3 object"],
         "answer": 0, "why": "EC2 is the compute service in this set."},
        {"q": "During a traffic spike, what problem is compute capacity helping address?", "options": ["The application needs more resources to serve workload", "A file needs a new name", "A user needs a role",
                     "A bucket needs a label"], "answer": 0, "why": "More traffic can increase workload demand, requiring suitable compute capacity."},
    ],
    "iam": [
        {"q": "What does IAM primarily control?", "options": ["Identity and access", "Object storage", "Virtual servers", "Image processing"],
         "answer": 0, "why": "AWS IAM helps control authentication and authorization through identities, roles and permissions."},
        {"q": "A warehouse employee needs to upload product images. What should access control allow?", "options": ["The required upload action", "Administrator access to everything", "No access at all", "Deleting all resources"],
         "answer": 0, "why": "Least privilege means granting only the access needed for the task."},
        {"q": "Which is authorization?", "options": ["Checking what an identity is allowed to do", "Storing an image", "Starting a server", "Processing an event"],
         "answer": 0, "why": "Authorization determines which actions an authenticated identity is permitted to perform."},
        {"q": "A customer asks for administrator access. What is the appropriate beginner-level response?", "options": ["Grant it automatically", "Deny it unless there is a legitimate need and authorization", "Give everyone admin", "Put the request in S3"],
         "answer": 1, "why": "Administrative access should not be granted without a legitimate, authorized need."},
        {"q": "What principle says users should receive only the permissions they need?", "options": ["Least privilege", "Object storage", "Autoscaling", "Event sourcing"],
         "answer": 0, "why": "Least privilege reduces unnecessary access by granting only required permissions."},
    ],
    "lambda": [
        {"q": "What is AWS Lambda designed to run?", "options": ["Code in response to events", "Only virtual machines", "Only databases", "IAM users"],
         "answer": 0, "why": "Lambda runs code without requiring you to manage servers, commonly in response to events."},
        {"q": "A customer uploads an image and you want automatic processing. Which combination fits the lesson?", "options": ["S3 + Lambda", "IAM + IAM", "EC2 + IAM only", "S3 + S3"],
         "answer": 0, "why": "An S3 event can trigger Lambda to process the uploaded object."},
        {"q": "What is an event in an event-driven design?", "options": ["Something that happens and can trigger work", "A password", "A database table", "A virtual CPU"],
         "answer": 0, "why": "An event represents something that happened and can initiate downstream processing."},
        {"q": "Which flow is most aligned with the lesson?", "options": ["Upload → S3 → Lambda → Process image", "Upload → IAM → CPU → Bucket", "Upload → Badge → Gem → EC2", "Upload → User → Password → S3"],
         "answer": 0, "why": "S3 can hold the object and an event can trigger Lambda to process it."},
        {"q": "Why is Lambda called serverless?", "options": ["You don't manage the underlying servers for the function", "It has no computers anywhere", "It cannot run code", "It replaces IAM"],
         "answer": 0, "why": "Serverless does not mean no servers; it means the cloud provider manages the underlying infrastructure for you."},
    ],
    "aurora": [
        {"q": "What is a database used for?", "options": ["Organizing and retrieving application data", "Only storing website images", "Granting permissions", "Running every CPU"],
         "answer": 0, "why": "Databases organize application data so it can be stored, retrieved and updated."},
        {"q": "In the shop example, what is an order record?", "options": ["Data describing an order", "A virtual server", "An IAM policy", "A storage bucket"],
         "answer": 0, "why": "A record represents a piece of structured data, such as an individual order."},
        {"q": "Who bought the laptop? Customer 3 is Sam. Which customer is it?", "options": ["Alex", "Jamie", "Sam", "Unknown"],
         "answer": 2, "why": "The fictional shop data links order 102 (Laptop) to customer 3, Sam."},
        {"q": "What is a table?", "options": ["A structured collection of related records", "A server", "A permission", "A browser tab"],
         "answer": 0, "why": "A table organizes related records into a structured form."},
        {"q": "Why do relationships matter in shop data?", "options": ["They connect related records such as customers and orders", "They create CPU cores", "They replace permissions", "They upload images"],
         "answer": 0, "why": "Relationships let applications connect related pieces of information, such as an order to the customer who placed it."},
    ],
}

FINAL_QUESTIONS = [
    ("Where should product images be stored?", "Amazon S3"),
    ("Where can your web application run?", "Amazon EC2"),
    ("Which service can run code in response to an event?", "AWS Lambda"),
    ("Which service handles permissions and access control?", "AWS IAM"),
    ("Where can application data be stored?", "Amazon Aurora DSQL"),
]

AUDIO_FILES = {
    "lobby": "Beatbox Lobby Theme.mp3",
    "quiz": "In Game Music (90 Second Countdown).mp3",
}


def get_player(player_id):
    player = PlayerProgress.query.filter_by(player_id=player_id).first()
    if not player:
        player = PlayerProgress(player_id=player_id)
        db.session.add(player)
        db.session.commit()
    return player


@app.get("/")
def index():
    return render_template("index.html", levels=LEVELS)


@app.get("/audio/<audio_name>")
def audio_file(audio_name):
    filename = AUDIO_FILES.get(audio_name)
    if not filename:
        abort(404)
    return send_from_directory(app.root_path, filename, mimetype="audio/mpeg", conditional=True)


@app.get("/level/<level_id>")
def level(level_id):
    level_data = next((x for x in LEVELS if x["id"] == level_id), None)
    if not level_data:
        return "Level not found", 404
    return render_template("level.html", level=level_data, questions=QUESTIONS.get(level_id, []),
                           final_questions=FINAL_QUESTIONS if level_id == "final" else [])


@app.get("/api/levels")
def api_levels():
    return jsonify(LEVELS)


@app.get("/api/player/progress")
def api_progress():
    player_id = request.args.get("player_id", "guest")
    p = get_player(player_id)
    return jsonify({"xp": p.xp, "gems": p.gems, "hearts": p.hearts, "streak": p.streak,
                    "completed_levels": p.completed_levels.split(",") if p.completed_levels else [],
                    "best_scores": p.best_scores})


@app.post("/api/player/rewards")
def rewards():
    data = request.get_json() or {}
    player_id = data.get("player_id", "guest")
    p = get_player(player_id)
    p.xp += int(data.get("xp", 0))
    p.gems += int(data.get("gems", 0))
    if "hearts" in data:
        p.hearts = max(0, min(5, int(data["hearts"])))
    db.session.commit()
    return jsonify({"xp": p.xp, "gems": p.gems, "hearts": p.hearts})


@app.post("/api/player/complete")
def complete():
    data = request.get_json() or {}
    p = get_player(data.get("player_id", "guest"))
    level_id = data.get("level_id")
    done = set(filter(None, p.completed_levels.split(",")))
    done.add(level_id)
    p.completed_levels = ",".join(done)
    p.xp += int(data.get("xp", 50))
    p.gems += int(data.get("gems", 25))
    p.hearts = 5
    db.session.commit()
    return jsonify({"ok": True, "completed_levels": list(done), "xp": p.xp, "gems": p.gems})


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=True)
