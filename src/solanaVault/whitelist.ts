import { BorshInstructionCoder, Idl, Instruction } from '@coral-xyz/anchor';
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
        logger.info(`allowed Tx: ${JSON.stringify(tx, null, 2)}`);

        logger.info(`requested IP: ${ip}`);
        const ipFilteredWhitelist = this.txRules.filter((rule) => rule.ip === ip || rule.ip === '*');
        if (ipFilteredWhitelist.length === 0) {
            logger.error(`Request IP does not meet any whitelisted IP`);
            return false;
        }

        for (const ix of tx.instructions) {
            let targetProgramPubkey = ix.programId.toBase58();
            logger.info(`requested contract address: ${targetProgramPubkey}`);

            for (let rule of ipFilteredWhitelist) {
                if (rule.toAddress === targetProgramPubkey || rule.toAddress === '*') {
                    let message: Instruction | null = null;
                    try {
                        message = this.coder.decode(ix.data, 'base58');
                    } catch (error) {
                        logger.error(`Failed to decode transaction data: ${JSON.stringify(error, null, 2)}`);
                    }

                    if (!message) {
                        if (rule.method === '*') {
                            logger.info(
                                `Though failed to decode transaction data, it meets the whitelist rule: ${JSON.stringify(rule)}`,
                            );
                            return true;
                        } else {
                            logger.error(`Failed to decode transaction data: got null result`);
                            return false;
                        }
                    }

                    const method = message.name;

                    logger.info(`requested method name ${method}`);
                    if (rule.method === method || rule.method === '*') {
                        logger.info(`Transaction meets whitelist rule: ${JSON.stringify(rule)}`);
                        return true;
                    }
                }
            }
        }
        logger.error(`Transaction does not meet any whitelist rules`);
        return false;
    }

    public isAllowedMsg(ip: string, msg: string): boolean {
        logger.info(`request: ${ip}-${msg}`);
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
