import * as http from 'http';
import logger from '../logger';
import { config } from '../config';

export default class Server {
    private hostname: string = '127.0.0.1';
    private port: number;
    private server: http.Server;

    constructor() {
        this.port = config.evmVaultPort;
        this.server = http.createServer(this.requestListener.bind(this));
    }

    private requestListener(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.url === '/' && req.method === 'POST') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Hello, World!\n');
            logger.log('Responded with Hello, World!');
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found\n');
            logger.error('Responded with Not Found');
        }
    }

    public start(): void {
        this.server.listen(this.port, this.hostname, () => {
            logger.log(`Server running at http://${this.hostname}:${this.port}/`);
        });
    }
}
