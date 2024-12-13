import { Interface, Transaction, TransactionDescription, TypedDataDomain, TypedDataField } from 'ethers';
import { config } from './config';
import abi from './abi.json';
import logger from '../logger';

interface TxWhitelistRule {
    ip: string;
    toAddress: string;
    method: string;
    paras: string | undefined;
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
            const [ip, toAddress, method, paras] = rule.split('-');
            return { ip, toAddress, method, paras };
        });
        logger.info(`txRules: ${JSON.stringify(this.txRules, null, 2)}`);
        this.msgRules = config.signMsgWhitelists.map((rule) => {
            const [ip, domain, primaryType] = rule.split('-');
            return { ip, domain, primaryType };
        });
        logger.info(`msgRules: ${JSON.stringify(this.msgRules, null, 2)}`);
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

        const requestedParas = parsedTransaction.args.toArray();
        logger.info(`decoded request: ${ip}-${tx.to}-${parsedTransaction.name}-${JSON.stringify(requestedParas)}`);
        for (const rule of this.txRules) {
            if (
                (rule.ip === '*' || rule.ip === ip) &&
                (rule.toAddress.toLocaleLowerCase() === '*' || rule.toAddress.toLocaleLowerCase() === tx.to) &&
                (rule.method === '*' || rule.method === parsedTransaction.name)
            ) {
                if (!rule.paras) {
                    logger.info(`Transaction meets whitelist rule: ${JSON.stringify(rule)}`);
                    return true;
                }

                let paras = rule.paras.split('|');
                for (let i = 0; i < requestedParas.length; i++) {
                    if (i === paras.length) {
                        logger.info(`Transaction meets whitelist rule: ${JSON.stringify(rule)}`);
                        return true;
                    }

                    if (paras[i] !== '*' && paras[i].toLocaleLowerCase() !== requestedParas[i].toLocaleLowerCase()) {
                        break;
                    }
                }
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
