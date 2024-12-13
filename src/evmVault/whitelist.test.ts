import { Whitelist } from './whitelist';
import { Transaction } from 'ethers';

describe('Whitelist', () => {
    it('should allow a transaction that meets the whitelist rules', () => {
        const whitelist = new Whitelist();

        let serializedTx =
            '0xf86a8085012a05f200830186a09455d398326f99059ff775485246999027b319795580b844095ea7b30000000000000000000000006f12fed6cd5bebfa3351c447f7873b76178b1b840000000000000000000000000000000000000000000000056bc75e2d63100000388080';
        let tx = Transaction.from(serializedTx);

        let requestIp = '192.168.0.1';
        let isValid = whitelist.isAllowedTx(requestIp, tx);
        expect(isValid).toBe(true);
    });
});
