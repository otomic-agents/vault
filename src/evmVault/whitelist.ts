import { Interface, Transaction, TransactionDescription, TypedDataDomain, TypedDataField } from 'ethers';
import { config } from './config';
import abi from './abi.json';
import logger from '../logger';

interface TxWhitelistRule {
    ip: string;
    toAddress: string;
    method: string;
}

interface MsgWhitelistRule {
    ip: string;
    domain: string;
    primaryType: string;
}

export interface EIP712Data {
    domain: TypedDataDomain;
    types: Record<string, TypedDataField[]>;
    signData: Record<string, any>;
}

export class Whitelist {
    private txRules: TxWhitelistRule[];
    private msgRules: MsgWhitelistRule[];
    private iface: Interface;

    constructor() {
        this.txRules = config.signTxWhitelists.map((rule) => {
            const [ip, toAddress, method] = rule.split('-');
            return { ip, toAddress, method };
        });
        this.msgRules = config.signMsgWhitelists.map((rule) => {
            const [ip, domain, primaryType] = rule.split('-');
            return { ip, domain, primaryType };
        });
        this.iface = new Interface(abi);
    }

    public isAllowedTx(ip: string, tx: Transaction): boolean {
        let parsedTransaction: TransactionDescription | null;
        try {
            parsedTransaction = this.iface.parseTransaction({ data: tx.data });
        } catch (error) {
            logger.error(`Failed to decode transaction data: ${JSON.stringify(error, null, 2)}`);
            return false;
        }

        if (!parsedTransaction) {
            logger.error(`Failed to decode transaction data: got null result`);
            return false;
        }

        logger.info(`decoded request: ${ip}-${tx.to}-${parsedTransaction.name}`);
        for (const rule of this.txRules) {
            if (
                (rule.ip === '*' || rule.ip === ip) &&
                (rule.toAddress === '*' || rule.toAddress === tx.to) &&
                (rule.method === '*' || rule.method === parsedTransaction.name)
            ) {
                logger.info(`Transaction meets whitelist rule`);
                return true;
            }
        }
        logger.error(`Transaction does not meet any whitelist rules`);
        return false;
    }

    public isAllowedMsg(ip: string, msg: EIP712Data): boolean {
        let allTypes = Object.keys(msg.types);

        logger.info(`request msg: ${ip}-${msg.domain.name}-${JSON.stringify(allTypes)}`);
        for (const rule of this.msgRules) {
            if (
                (rule.ip === '*' || rule.ip === ip) &&
                (rule.domain === '*' || rule.domain === msg.domain.name) &&
                (rule.primaryType === '*' || allTypes.includes(rule.primaryType))
            ) {
                logger.info(`Msg meets whitelist rule`);
                return true;
            }
        }
        logger.error(`Msg does not meet any whitelist rules`);
        return false;
    }
}
