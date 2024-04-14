import express, { Express, Request, Response } from 'express';
import { Database } from 'sqlite3';

const app: Express = express();
const port = 8500;

const db = new Database('db.sqlite');

db.exec(`
CREATE TABLE IF NOT EXISTS owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL
)
`)

app.get('/login', (req: Request, res: Response) => {
    db.get('SELECT * FROM owners WHERE username = ?', req.query.username, (_err: Error | null, row: any) => {
        if (!row) {
            db.run('INSERT INTO owners (username, password) VALUES (?, ?)', req.query.username, req.query.password);
            db.get('SELECT * FROM owners WHERE username = ?', req.query.username, (_err: Error | null, row: any) => {
                res.send(row.id.toString());
            });
        } else if (row.password === req.query.password) {
            res.send(row.id.toString());
        } else {
            res.status(400).send('Username taken / Incorrect password');
        }
    });
});

app.listen(port, () => {
    console.log(`[server] Server is running at http://localhost:${port}`);
});
