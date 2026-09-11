# The Multimedia Store

Data Modelling and Multimedia Databases' final project — a web application for
storing, browsing, and managing multimedia content of seven types:

| Type | Upload page | List page |
|---|---|---|
| Books | `/form.html` | `/book-list.html` |
| Videos | `/videos-form.html` | `/video-list.html` |
| Games | `/game-form.html` | `/game-list.html` |
| Paintings | `/painting-form.html` | `/painting-list.html` |
| Articles | `/article-form.html` | `/article-list.html` |
| Newspapers | `/newspaper-form.html` | `/newspaper-list.html` |
| Music | `/music-form.html` | `/music-list.html` |

## Tech stack

- **Backend:** Node.js + Express
- **Database:** SQLite via Sequelize ORM (`database.sqlite`)
- **File uploads:** Multer (images, PDFs, audio stored in `uploads/`)
- **Auth:** JWT with bcrypt password hashing; roles (`admin`/`client`) and
  security-question-based password recovery

Each uploaded item gets a static detail page generated into
`public/<type>/` (e.g. `public/books/book_1743613528327.html`) and a row in the
database.

## Running

```bash
npm install
npm start          # serves on http://localhost:3000
# or on another port:
PORT=3030 npm start
```

On first run, Sequelize creates any missing tables and (if needed) migrates an
older `database.sqlite` by adding the `Music.htmlLink` column.

## Project layout

```
server.js              Express app: routes, auth, HTML page generators
database.js            Sequelize connection (SQLite)
models/                Sequelize models (User, Book, Video, Game, Article,
                       Newspaper, Painting, Music, ContactMessage)
public/                Front-end pages (Bootstrap) + generated detail pages
uploads/               Uploaded media files
```

## Notes

- `JWT_SECRET` environment variable overrides the default token-signing key
  when deploying beyond local development.
