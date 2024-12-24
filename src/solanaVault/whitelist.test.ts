import { Whitelist } from './whitelist';
import { Message, Transaction } from '@solana/web3.js';

describe('Whitelist', () => {
    it('should allow a transaction that meets the whitelist rules', () => {
        const whitelist = new Whitelist();

        let unsignedTxBase64 =
            'AQAFDLjzmThLvxt0RWhb6dgBeqlFLaUCtEWKwjbdg9iUuatlJh1h5gHp9ZgSZabzO8l4ij9j7ccTQz2qUZL7qg+87uRcSFI7gkdOapXi/Ur8ZN60cNEjnZl9OOozIifu+EEH3WeB+J/eZ222afaLOPIUVbcBaCrLNZoIehRXLwbvVm6hclDO2luN+xnIS+0HiuGPP/TIPH/D2SNM8+BSHTxAm5/omQOwGWL1ogcURigGgo4eoMFkwLWRwtRzS3K3s8bjeu8Hx77p/LTFnJ1xZxpfrXWJN8DwSwtRHl13n39iUqzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAAM51vvXlszAPmRyddW+GKYK7gB7AduaLk9H5yCRr7H6r0ojEUXOcPIldEvWQrSb/WeLqJ/y23uAG4rH6HhLO/MoG3fbh12Whk9nL4UbO63msHLSF7V9bN5E6jPWFfv8AqSgmik5jZx8QivyXVK73bcWXbX3DAwkoLlWe6h4lrnDTAwgACQMACT0AAAAAAAgABQI8CwEACgsAAAIEBgEJBQMHC0muAQ/VA76DAAMYo7rdOCuI8vVEMOUmuZy+OqeCfTVjsYA4b05G0BkJKrbASKggC9r8+R0EuP8bxnHu9qvn1ku5mH3pyfTWQwAA';
        const messageBytes = Buffer.from(unsignedTxBase64, 'base64');
        const txMessage = Message.from(messageBytes);
        const unsignedTx = Transaction.populate(txMessage);

        const requestIp = '192.168.0.1';
        const isValid = whitelist.isAllowedTx(requestIp, unsignedTx);
        expect(isValid).toBe(true);
    });
});
