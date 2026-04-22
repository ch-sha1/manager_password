import CryptoJS from 'crypto-js';

export function createShareToken(items, sharePassword) {
    const payload = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        items
    };

    const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(payload),
        sharePassword
    ).toString();

    return encodeURIComponent(encrypted);
}

export function decryptShareToken(token, sharePassword) {
    try {
        const decoded = decodeURIComponent(token);
        const bytes = CryptoJS.AES.decrypt(decoded, sharePassword);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedText) {
            throw new Error('INVALID_PASSWORD');
        }

        const parsed = JSON.parse(decryptedText);

        if (!parsed?.items || !Array.isArray(parsed.items)) {
            throw new Error('INVALID_PAYLOAD');
        }

        return parsed;
    } catch (error) {
        throw new Error('DECRYPT_FAILED');
    }
}