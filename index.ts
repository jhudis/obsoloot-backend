import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import { Database, RunResult } from 'sqlite3';

const app = expressWs(express()).app;
const port = 8500;

const db = new Database('db.sqlite');

db.exec(`
CREATE TABLE IF NOT EXISTS owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS phones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER REFERENCES owners(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'IDLE'
);
`)

app.get('/login', (req: Request, res: Response) => {
    db.get('SELECT * FROM owners WHERE username = ?', req.query.username, (_err: Error | null, row: any) => {
        if (!row) {
            db.run('INSERT INTO owners (username, password) VALUES (?, ?)', req.query.username, req.query.password,
                function(this: RunResult, _err: Error | null) { 
                    res.send(this.lastID.toString());
                }
            );
        } else if (row.password === req.query.password) {
            res.send(row.id.toString());
        } else {
            res.status(400).send('Username taken / Incorrect password');
        }
    });
});

app.get('/register', (req: Request, res: Response) => {
    db.run('INSERT INTO phones (owner_id, nickname) VALUES (?, ?)', req.query.ownerId, req.query.nickname,
        function(this: RunResult, _err: Error | null) { 
            res.send(this.lastID.toString());
        }
    );
});

app.get('/phones', (req: Request, res: Response) => {
    db.all('SELECT * FROM phones WHERE owner_id = ?', req.query.ownerId, (_err: Error | null, rows: unknown[]) => {
        res.send(rows);
    });
});

app.get('/nickname', (req: Request, res: Response) => {
    db.run('UPDATE phones SET nickname = ? WHERE id = ?', req.query.nickname, req.query.phoneId, function (this: RunResult, _err: Error | null) {
        res.send('');
    });
});

app.ws('/loot', (ws: { on: (arg0: string, arg1: (msg: any) => void) => void; send: (arg0: any) => void; }, req: any) => {
    const setStatus = (status: String) => db.run('UPDATE phones SET status = ? WHERE id = ?', status, req.query.phoneId);
    setStatus('ACTIVE')
    ws.on('close', code => {
        setStatus(code === 1000 ? 'IDLE' : 'ERROR')
    });
});

app.listen(port, () => {
    console.log(`[server] Server is running at http://localhost:${port}`);
});
