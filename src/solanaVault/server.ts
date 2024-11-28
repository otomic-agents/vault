import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Keypair, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import logger from '../logger';
import { config } from './config';
import { decrypt, promptText } from '../utils';

const keystoreFile = path.join(config.keystoreFolder, 'solana.json');

export default class Server {
    private hostname: string = '127.0.0.1';
    private port: number;
    private server: http.Server;
    private keypair: Keypair | undefined = undefined;

    constructor() {
        this.port = config.port;
        this.server = http.createServer(this.requestListener.bind(this));
    }

    private async loadPrivateKey() {
        if (!fs.existsSync(keystoreFile)) {
            throw new Error('Keystore file does not exist.');
        }

        const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
        const password = await promptText('Enter the keystore password: ', true);
        const secretKey = decrypt(keystore.secretKey, password);
        this.keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
        logger.log(`Loaded keypair with public key: ${this.keypair.publicKey.toBase58()}`);
    }

    private async signTransaction(serializedTx: string): Promise<string> {
        if (!this.keypair) {
            throw new Error('Keypair is not loaded');
        }

        const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
        tx.partialSign(this.keypair);
        const signedTx = tx.serialize().toString('base64');
        logger.log(`Signed transaction: ${signedTx}`);
        return signedTx;
    }

    private requestListener(req: http.IncomingMessage, res: http.ServerResponse): void {
        logger.log(`Received request: ${req.method} ${req.url}`);
        logger.log(`Headers: ${JSON.stringify(req.headers)}`);

        if (req.url === '/signTx' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { serializedTx } = JSON.parse(body);
                    const signedTx = await this.signTransaction(serializedTx);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ signedTx }));
                } catch (error) {
                    logger.error(`Error signing transaction: ${(error as Error).message}`);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Internal Server Error');
                }
            });
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found\n');
            logger.error('Responded with Not Found');
        }
    }

    public async start(): Promise<void> {
        await this.loadPrivateKey();
        this.server.listen(this.port, this.hostname, () => {
            logger.log(`Server running at http://${this.hostname}:${this.port}/`);
        });
    }
}

const server = new Server();
server.start().catch((error) => {
    logger.error(`Error starting server: ${error.message}`);
});
