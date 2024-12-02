import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Keypair, Message, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import logger from '../logger';
import { config } from './config';
import { decrypt } from '../utils';

import { Whitelist } from './whitelist';
import { getNormalizedIp } from '../utils';

const keystoreFile = path.join(config.keystoreFolder, config.vaultName);

export default class Server {
    private hostname: string = '0.0.0.0';
    private port: number;
    private server: http.Server;
    private keypair: Keypair | undefined = undefined;
    private whitelist: Whitelist;

    constructor() {
        this.port = config.port;
        this.server = http.createServer(this.requestListener.bind(this));
        this.whitelist = new Whitelist();
    }

    private async loadPrivateKey() {
        if (!fs.existsSync(keystoreFile)) {
            logger.log(keystoreFile)
            throw new Error(`Keystore file does not exist.${keystoreFile}`);
        }

        const keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf-8'));
        logger.log(`Loaded keystore from ${keystoreFile}`);
        const secretKey = decrypt(keystore.secretKey, config.vaultPassword);
        this.keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
        logger.log(`Loaded keypair with public key: ${this.keypair.publicKey.toBase58()}`);
    }

    private async signTransaction(
        unsignedTxBase64: string,
        normalizedIp: string,
    ): Promise<{ signature: string; publicKey: string }> {
        this.loadPrivateKey();
        if (!this.keypair) {
            throw new Error('Keypair is not loaded');
        }

        const messageBytes = Buffer.from(unsignedTxBase64, 'base64');
        const txMessage = Message.from(messageBytes);
        const unsignedTx = Transaction.populate(txMessage);

        let isValid = this.whitelist.isAllowedTx(normalizedIp, unsignedTx);
        if (!isValid) {
            throw new Error('Transaction is not allowed');
        }

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

    private async signMessage(
        message: string,
        normalizedIp: string,
    ): Promise<{ signature: string; publicKey: string }> {
        await this.loadPrivateKey();
        if (!this.keypair) {
            throw new Error('Keypair is not loaded');
        }

        let isValid = this.whitelist.isAllowedMsg(normalizedIp, message);
        if (!isValid) {
            throw new Error('Msg is not allowed');
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
        const normalizedIp = getNormalizedIp(req);
        logger.log(`Received request: ${req.method} ${req.url} from ${normalizedIp}`);

        if (!normalizedIp) {
            logger.error('Failed to get normalized IP');
            res.statusCode = 403;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Forbidden');
            return;
        }

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
                    const ret = await this.signTransaction(data.txMessage, normalizedIp);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                        JSON.stringify({
                            message: 'Transaction signed successfully',
                            signature: ret.signature,
                            publicKey: ret.publicKey,
                        }),
                    );
                } catch (error) {
                    if ((error as Error).message === 'Invalid tx data') {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Bad Request');
                    } else if ((error as Error).message === 'Transaction is not allowed') {
                        res.statusCode = 403;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Forbidden');
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
                    const ret = await this.signMessage(data.message, normalizedIp);
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
                    } else if ((error as Error).message === 'Msg is not allowed') {
                        res.statusCode = 403;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('Forbidden');
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
