import { BorshInstructionCoder, Idl } from '@coral-xyz/anchor';
import { Transaction } from '@solana/web3.js';
import { config } from './config';
import idl from './idl.json';
import logger from '../logger';

interface TxWhitelistRule {
    ip: string;
    toAddress: string;
    method: string;
}

interface MsgWhitelistRule {
    ip: string;
    substring: string;
}

export class Whitelist {
    private txRules: TxWhitelistRule[];
    private msgRules: MsgWhitelistRule[];
    private coder: BorshInstructionCoder;

    constructor() {
        this.txRules = config.signTxWhitelists.map((rule) => {
            const [ip, toAddress, method] = rule.split('-');
            return { ip, toAddress, method };
        });
        logger.info(`txRules: ${JSON.stringify(this.txRules, null, 2)}`);
        this.msgRules = config.signMsgWhitelists.map((rule) => {
            const [ip, substring] = rule.split('-');
            return { ip, substring };
        });
        logger.info(`msgRules: ${JSON.stringify(this.msgRules, null, 2)}`);
        this.coder = new BorshInstructionCoder(idl as Idl);
    }

    public isAllowedTx(ip: string, tx: Transaction): boolean {
        for (const ix of tx.instructions) {
            const message = this.coder.decode(ix.data, 'base58');
            if (message === null) {
                logger.error(`Failed to decode transaction data`);
                return false;
            }

            const method = message.name;

            const keyAccounts = ix.keys.map((key) => key.pubkey.toBase58());

            logger.info(`decoded request: ${ip}-${JSON.stringify(keyAccounts)}-${method}`);
            for (const rule of this.txRules) {
                if (
                    (rule.ip === '*' || rule.ip === ip) &&
                    (rule.toAddress === '*' || keyAccounts.includes(rule.toAddress)) &&
                    (rule.method === '*' || rule.method === method)
                ) {
                    logger.info(`Transaction meets whitelist rule`);
                    return true;
                }
            }
        }
        logger.error(`Transaction does not meet any whitelist rules`);
        return false;
    }

    public isAllowedMsg(ip: string, msg: string): boolean {
        for (const rule of this.msgRules) {
            if ((rule.ip === '*' || rule.ip === ip) && (rule.substring === '*' || msg.includes(rule.substring))) {
                logger.info(`Msg meets whitelist rule`);
                return true;
            }
        }
        logger.error(`Msg does not meet any whitelist rules`);
        return false;
    }
}
