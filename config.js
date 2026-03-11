const crypto = require('crypto');

const MasterKey = crypto.createHash('sha256').update('Miss_Shasikala_Ultra_Secret_Encryption_2024_Nimesha_Madhushan_Secure_Config').digest();
const EncryptionIV = crypto.createHash('md5').update('Shasikala_Bot_IV').digest();

function EncryptData(data) {
	const cipher = crypto.createCipheriv('aes-256-cbc', MasterKey, EncryptionIV);
	let encrypted = cipher.update(String(data), 'utf8', 'hex');
	encrypted += cipher.final('hex');
	return encrypted;
}

function DecryptData(encryptedData) {
	const decipher = crypto.createDecipheriv('aes-256-cbc', MasterKey, EncryptionIV);
	let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}

const EncryptedDatabase = {
	s1: EncryptData('94726800969'),
	s2: EncryptData('Nimesha Madhushan'),
	s3: EncryptData('Miss Shasikala'),
	s4: EncryptData('https://github.com/nimesha206/nimabw.git'),
	s5: EncryptData('> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN*_ '),
	s6: EncryptData('120363419075720962@newsletter'),
	s7: EncryptData('AIzaSyARjH2TwsNEpQ3vPHzDecf5a7v7evmQmZc'),
	s8: EncryptData('nz-8ce9753907'),
	h1: crypto.createHash('sha256').update(EncryptData('94726800969')).digest('hex'),
	h2: crypto.createHash('sha256').update(EncryptData('Nimesha Madhushan')).digest('hex'),
	h3: crypto.createHash('sha256').update(EncryptData('Miss Shasikala')).digest('hex'),
	h4: crypto.createHash('sha256').update(EncryptData('https://github.com/nimesha206/nimabw.git')).digest('hex'),
	h5: crypto.createHash('sha256').update(EncryptData('> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN*_ ')).digest('hex'),
	h6: crypto.createHash('sha256').update(EncryptData('120363419075720962@newsletter')).digest('hex'),
	h7: crypto.createHash('sha256').update(EncryptData('AIzaSyARjH2TwsNEpQ3vPHzDecf5a7v7evmQmZc')).digest('hex'),
	h8: crypto.createHash('sha256').update(EncryptData('nz-8ce9753907')).digest('hex'),
};

const VerifyHash = (encData, hash) => {
	return crypto.createHash('sha256').update(encData).digest('hex') === hash;
};

const SecureConfig = {
	get ownerNumber() {
		if (!VerifyHash(EncryptedDatabase.s1, EncryptedDatabase.h1)) throw new Error('Integrity Failed');
		return [DecryptData(EncryptedDatabase.s1), '224653129842714'];
	},
	get ownerName() {
		if (!VerifyHash(EncryptedDatabase.s2, EncryptedDatabase.h2)) throw new Error('Integrity Failed');
		return DecryptData(EncryptedDatabase.s2);
	},
	get botName() {
		if (!VerifyHash(EncryptedDatabase.s3, EncryptedDatabase.h3)) throw new Error('Integrity Failed');
		return DecryptData(EncryptedDatabase.s3);
	},
	get repository() {
		if (!VerifyHash(EncryptedDatabase.s4, EncryptedDatabase.h4)) throw new Error('Integrity Failed');
		return DecryptData(EncryptedDatabase.s4);
	},
	get footer() {
		if (!VerifyHash(EncryptedDatabase.s5, EncryptedDatabase.h5)) throw new Error('Integrity Failed');
		return DecryptData(EncryptedDatabase.s5);
	},
	get groupJid() {
		if (!VerifyHash(EncryptedDatabase.s6, EncryptedDatabase.h6)) throw new Error('Integrity Failed');
		return DecryptData(EncryptedDatabase.s6);
	},
	get geminiApiKey() {
		if (!VerifyHash(EncryptedDatabase.s7, EncryptedDatabase.h7)) throw new Error('Integrity Failed');
		return DecryptData(EncryptedDatabase.s7);
	},
	get apiKey() {
		if (!VerifyHash(EncryptedDatabase.s8, EncryptedDatabase.h8)) throw new Error('Integrity Failed');
		return DecryptData(EncryptedDatabase.s8);
	}
};

module.exports = SecureConfig;
