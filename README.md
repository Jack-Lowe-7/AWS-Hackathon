# AWS Quest — Flask MVP

A playable, Duolingo-inspired AWS learning game built with **Python Flask + Jinja + vanilla JavaScript + CSS + SQLite**.

This version intentionally adapts the supplied brief's preferred React/Node stack to a simple Flask/HTML repository so it can be copied directly into GitHub and run with Python. The core MVP includes:

- AWS Quest map
- Guest player progress
- XP, gems, hearts and streak HUD
- Complete S3 lesson with 5 questions
- Explanations after every answer
- S3 "Sort the Warehouse" mini-game
- Level completion + unlock progression
- EC2, IAM, Lambda and Aurora DSQL lessons
- Final Shop Challenge
- Responsive, accessible UI
- SQLite-backed progress API

The source brief explicitly prioritizes a working game, map, S3 level, questions, XP/gems/hearts, S3 mini-game, level completion, then the remaining AWS levels and final challenge. fileciteturn0file0L1007-L1042

## Run locally

```bash
python -m venv .venv
```

### macOS/Linux
```bash
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Windows
```powershell
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

## Project structure

```text
aws-quest-flask/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── templates/
│   ├── base.html
│   ├── index.html
│   └── level.html
└── static/
    ├── app.js
    └── style.css
```

## Notes

- SQLite is used for a zero-configuration development database.
- Guest progress is identified by a browser-generated player ID.
- No real AWS credentials are required.
- All learning scenarios use fictional shop data.
- This is an educational game, not an AWS console or official AWS product.
