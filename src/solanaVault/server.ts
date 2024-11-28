import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Keypair, Message, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import logger from '../logger';
import { config } from './config';
import { decrypt } from '../utils';

const keystoreFile = path.join(config.keystoreFolder, config.vaultName);

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
        logger.log(`Loaded keystore from ${keystoreFile}`);
        const secretKey = decrypt(keystore.secretKey, config.vaultPassword);
        this.keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
        logger.log(`Loaded keypair with public key: ${this.keypair.publicKey.toBase58()}`);
    }

    private async signTransaction(unsignedTxBase64: string): Promise<{ signature: string; publicKey: string }> {
        this.loadPrivateKey();
        if (!this.keypair) {
            throw new Error('Keypair is not loaded');
        }

        const messageBytes = Buffer.from(unsignedTxBase64, 'base64');
        const txMessage = Message.from(messageBytes);
        const unsignedTx = Transaction.populate(txMessage); // 从消息重建交易
        unsignedTx.sign(this.keypair);
        const signedTxBuffer = unsignedTx.serialize();
        const signedTx = signedTxBuffer.toString('hex');

        logger.log(`Signed transaction: ${signedTx}`);
        const ret = {
            signature: signedTx,
            publicKey: this.keypair.publicKey.toBase58(),
        };
        this.keypair = undefined;
        return ret;
    }

    private async signMessage(message: string): Promise<{ signature: string; publicKey: string }> {
        await this.loadPrivateKey();
        if (!this.keypair) {
            throw new Error('Keypair is not loaded');
        }

        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = nacl.sign.detached(messageBytes, this.keypair.secretKey);
        const signatureHex = Buffer.from(signatureBytes).toString('hex');
        const ret = {
            signature: signatureHex,
            publicKey: this.keypair.publicKey.toBase58(),
        };
        this.keypair = undefined;
        return ret;
    }

    private requestListener(req: http.IncomingMessage, res: http.ServerResponse): void {
        logger.log(`Received request: ${req.method} ${req.url}`);

        if (req.url === '/signTx' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (!data || !data.txMessage) {
                        throw new Error('Invalid tx data');
                    }
                    const ret = await this.signTransaction(data.txMessage);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                        JSON.stringify({
                            message: 'Transaction signed successfully',
                            signedTx: ret.signature,
                            publicKey: ret.publicKey,
                        }),
                    );
                } catch (error) {
                    if ((error as Error).message === 'Invalid tx data') {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Bad Request');
                    } else {
                        logger.error(`Error signing EIP-712 data: ${JSON.stringify(error, null, 2)}`);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Internal Server Error');
                    }
                }
            });
        } else if (req.url === '/signEIP712' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (!data || !data.message) {
                        throw new Error('Invalid message data');
                    }
                    const ret = await this.signMessage(data.message);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                        JSON.stringify({
                            message: 'Message signed successfully',
                            signature: ret.signature,
                            publicKey: ret.publicKey,
                        }),
                    );
                } catch (error) {
                    if ((error as Error).message === 'Invalid message data') {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Bad Request');
                    } else {
                        logger.error(`Error signing EIP-712 data: ${JSON.stringify(error, null, 2)}`);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Internal Server Error');
                    }
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
            logger.log(`Server running at http://${this.hostname}:${this.port}`);
            // reset wallet after server is started, then load it again when sign request comes
            this.keypair = undefined;
        });
    }
}
