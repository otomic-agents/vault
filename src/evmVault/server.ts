import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { HDNodeWallet, Wallet, TransactionRequest, TypedDataDomain, TypedDataField } from 'ethers';
import logger from '../logger';
import { config } from '../config';

const keystoreFile = path.join(config.keystorePath, 'evm.json');

interface EIP712Data {
    domain: TypedDataDomain;
    types: Record<string, TypedDataField[]>;
    message: Record<string, any>;
}
export default class Server {
    private hostname: string = '127.0.0.1';
    private port: number;
    private server: http.Server;
    private wallet: Wallet | HDNodeWallet | undefined = undefined;

    constructor() {
        this.port = config.evmVaultPort;
        this.server = http.createServer(this.requestListener.bind(this));
    }

    private async loadPrivateKey() {
        const keystore = fs.readFileSync(keystoreFile, 'utf-8');
        logger.log(`Loaded keystore from ${keystoreFile}`);
        const wallet = await Wallet.fromEncryptedJson(keystore, config.evmWalletPassword);
        this.wallet = wallet;
        if (!this.wallet) {
            throw new Error('Failed to load wallet');
        }
        logger.log(`Loaded wallet with address: ${this.wallet.address}`);
    }

    private async signTransaction(unsignedTx: TransactionRequest): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet is not loaded');
        }

        //TODO: Implement the security check

        const signedTx = await this.wallet.signTransaction(unsignedTx);
        logger.log(`Signed transaction: ${signedTx}`);
        return signedTx;
    }

    private async signEIP712(data: EIP712Data): Promise<string> {
        if (!this.wallet) {
            throw new Error('Wallet is not loaded');
        }

        //TODO: Implement the security check

        const signedData = await this.wallet.signTypedData(data.domain, data.types, data.message);
        logger.log(`Signed EIP-712 data: ${signedData}`);
        return signedData;
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
                    const unsignedTx = JSON.parse(body);
                    const signedTx = await this.signTransaction(unsignedTx);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ signedTx }));
                } catch (error) {
                    logger.error(`Error signing transaction: ${JSON.stringify(error)}`);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end('Internal Server Error');
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
                    const signedData = await this.signEIP712(data);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ signedData }));
                } catch (error) {
                    logger.error(`Error signing EIP-712 data: ${JSON.stringify(error)}`);
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
