import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import { Database, RunResult } from 'sqlite3';
import { Queue } from 'typescript-collections';

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

CREATE TABLE IF NOT EXISTS tasks (
    name TEXT PRIMARY KEY,
    method TEXT,
    code TEXT
);
`)

interface Invocation {
    name: string;
    args: string;
    callback: (result: string) => void;
}

class Worker {
    id: number;
    ws: { on: (arg0: string, arg1: (msg: any) => void) => void; send: (arg0: any) => void; };
    queue: Queue<Invocation>;
    active: boolean;

    constructor(id: number, ws: any, queue: Queue<Invocation>, active: boolean) {
        this.id = id;
        this.ws = ws;
        this.queue = queue;
        this.active = active;
    }
}

let workers: Worker[] = [];

function assignInvocation(invocation: Invocation) {
    const activeWorkers = workers.filter(worker => worker.active);
    activeWorkers.sort((a, b) => a.queue.size() - b.queue.size());
    const assignedWorker = activeWorkers[0];
    assignedWorker.queue.add(invocation);
}

app.use(express.text())

app.listen(port, () => {
    console.log(`[server] Server is running at http://localhost:${port}`);
});

app.post('/login', (req: Request, res: Response) => {
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

app.post('/register', (req: Request, res: Response) => {
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

app.put('/nickname', (req: Request, res: Response) => {
    db.run('UPDATE phones SET nickname = ? WHERE id = ?', req.query.nickname, req.query.phoneId, function (this: RunResult, _err: Error | null) {
        res.send('');
    });
});

app.ws('/loot', (ws: { on: (arg0: string, arg1: (msg: any) => void) => void; send: (arg0: any) => void; }, req: any) => {
    const phoneId = req.query.phoneId;
    const setStatus = (status: String) => db.run('UPDATE phones SET status = ? WHERE id = ?', status, phoneId);
    setStatus('ACTIVE');
    let worker = workers.find(worker => worker.id === phoneId);
    if (worker) {
        worker.active = true;
        worker.ws = ws;
        worker.queue = new Queue();
    } else {
        workers.push(new Worker(phoneId, ws, new Queue(), true));
        worker = workers.slice(-1)[0];
    }
    let invoking = false;
    const interval = setInterval(() => {
        if (worker.queue.isEmpty() || invoking) return;
        const invocation = worker.queue.peek();
        ws.send(invocation?.name);
        ws.send(invocation?.args);
        invoking = true;
    }, 1);
    ws.on('close', code => {
        clearInterval(interval);
        setStatus(code === 1000 ? 'IDLE' : 'ERROR');
        worker.active = false;
        while (!worker.queue.isEmpty()) {
            assignInvocation(worker.queue.dequeue()!);
        }
    });
    ws.on('message', msg => {
        const invocation = worker.queue.dequeue();
        invocation?.callback(msg);
        invoking = false;
    });
});

app.post('/upload', (req: Request, res: Response) => {
    db.run('INSERT OR IGNORE INTO tasks VALUES (?, ?, ?)', req.query.name, req.query.method, req.body,
        function(this: RunResult, _err: Error | null) { 
            res.send('');
        }
    );
});

app.get('/invoke', (req: Request, res: Response) => {
    assignInvocation({ name: req.query.name as string, args: req.query.args as string, callback: (result) => {
        res.send(result);
    }});
});

app.get('/task', (req: Request, res: Response) => {
    db.get('SELECT * FROM tasks WHERE name = ?', req.query.name, (_err: Error | null, row: any) => {
        res.send(row);
    });
});
