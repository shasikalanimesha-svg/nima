require('../settings');
const fs = require('fs');
const jimp = require('jimp');
const chalk = require('chalk');
const { sleep, clockString } = require('./function')

function pickRandom(list) {
	return list[Math.floor(list.length * Math.random())]
}

const rdGame = (bd, id, tm) => Object.keys(bd).find(a => a.startsWith(id) && a.endsWith(tm));

const iGame = (bd, id) => (a => a && bd[a].id)(Object.keys(bd).find(a => a.startsWith(id)));

const tGame = (bd, id) => (a => a && bd[a].time)(Object.keys(bd).find(a => a.startsWith(id)));

const gameSlot = async (conn, m, db) => {
	if (db.users[m.sender].limit < 1) return m.reply(global.mess.limit)
	const sotoy = ['🍇','🍉','🍋','🍌','🍎','🍑','🍒','🫐','🥥','🥑']
	const slot1 = pickRandom(sotoy)
	const slot2 = pickRandom(sotoy)
	const slot3 = pickRandom(sotoy)
	const listSlot1 = `${pickRandom(sotoy)} : ${pickRandom(sotoy)} : ${pickRandom(sotoy)}`
	const listSlot2 = `${slot1} : ${slot2} : ${slot3}`
	const listSlot3 = `${pickRandom(sotoy)} : ${pickRandom(sotoy)} : ${pickRandom(sotoy)}`
	const randomLimit = Math.floor(Math.random() * 10)
	const botNumber = await conn.decodeJid(conn.user.id)
	try {
		if (slot1 === slot2 && slot2 === slot3) {
			db.users[m.sender].limit -= 1
			db.set[botNumber].limit += 1
			let sloth =`[  🎰 වර්චුවල් ස්ලොට් 🎰  ]\n------------------------\n\n${listSlot1}\n${listSlot2} <=====\n${listSlot3}\n\n------------------------\n[  🎰 වර්චුවල් ස්ලොට් 🎰  ]\n\n*විස්තරය* :\n_ඔබ ජයග්‍රහණය කළා!🎉_ <=====ලිමිට් + ${randomLimit}, මුදල් + ${randomLimit * 500}`
			conn.sendMessage(m.chat, { text: sloth }, { quoted: m })
			db.users[m.sender].limit += randomLimit
			db.users[m.sender].money += randomLimit * 500
		} else {
			db.users[m.sender].limit -= 1
			db.set[botNumber].limit += 1
			let sloth =`[  🎰 වර්චුවල් ස්ලොට් 🎰  ]\n------------------------\n\n${listSlot1}\n${listSlot2} <=====\n${listSlot3}\n\n------------------------\n[  🎰 වර්චුවල් ස්ලොට් 🎰  ]\n\n*විස්තරය* :\n_ඔබ පරාජය වුණා_ <=====\nලිමිට් - 1`
			conn.sendMessage(m.chat, { text: sloth }, { quoted: m })
		}
	} catch (e) {
		m.reply('දෝෂයකි (Error)!')
	}
}

const gameCasinoSolo = async (conn, m, prefix, db) => {
	try {
		let buatall = 1
		if (db.users[m.sender].limit < 1) return m.reply(global.mess.limit)
		const botNumber = await conn.decodeJid(conn.user.id)
		let randomaku = `${Math.floor(Math.random() * 101)}`.trim()
		let randomkamu = `${Math.floor(Math.random() * 81)}`.trim() 
		let Aku = (randomaku * 1)
		let Kamu = (randomkamu * 1)
		let count = m.args[0]
		count = count ? 'all' === count ? Math.floor(db.users[m.sender].money / buatall) : parseInt(count) : m.args[0] ? parseInt(m.args[0]) : 1
		count = Math.max(1, count)
		if (m.args.length < 1) return m.reply(prefix + 'casino <ප්‍රමාණය>\n' + prefix + 'casino 1000')
		if (isNaN(m.args[0])) return m.reply(`කරුණාකර ප්‍රමාණය ඇතුළත් කරන්න!\nඋදාහරණ : ${prefix + m.command} 1000`)
		if (db.users[m.sender].money >= count * 1) {
			db.users[m.sender].limit -= 1
			db.users[m.sender].money -= count * 1
			db.set[botNumber].money += count * 1
			if (Aku > Kamu) {
				m.reply(`💰 කැසිනෝ 💰\n*ඔබට:* ${Kamu} ලකුණු\n*පරිගණකයට:* ${Aku} ලකුණු\n\n*ඔබ පරාජිතයි*\nඔබට ${count} මුදලක් අහිමි විය.`.trim())
			} else if (Aku < Kamu) {
				db.users[m.sender].money += count * 2
				m.reply(`💰 කැසිනෝ 💰\n*ඔබට:* ${Kamu} ලකුණු\n*පරිගණකයට:* ${Aku} ලකුණු\n\n*ඔබ ජයග්‍රහණය කළා*\nඔබට ${count * 2} මුදලක් ලැබුණා.`.trim())
			} else {
				db.users[m.sender].money += count * 1
				m.reply(`💰 කැසිනෝ 💰\n*ඔබට:* ${Kamu} ලකුණු\n*පරිගණකයට:* ${Aku} ලකුණු\n\n*සම විය*\nඔබේ මුදල (${count}) නැවත ලැබුණා.`.trim())
			}
		} else m.reply(`කැසිනෝ ක්‍රීඩා කිරීමට තරම් ප්‍රමාණවත් මුදල් ඔබ සතුව නැත!`)
	} catch (e) {
		m.reply('දෝෂයකි (Error)!')
	}
}

const gameSamgongSolo = async (conn, m, db) => {
	const suits = ['♥️', '♦️', '♣️', '♠️'];
	const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
	if (db.users[m.sender].limit < 1) return m.reply(global.mess.limit)
	const count = parseInt(m.args[0]);
	if (isNaN(count) || count < 5000) return m.reply('අවම ඔට්ටුව 5000 කි!');
	if (db.users[m.sender].money < count) return m.reply(`සම්ගොන්ග් ක්‍රීඩා කිරීමට තරම් ප්‍රමාණවත් මුදල් ඔබ සතුව නැත!`)
	db.users[m.sender].money -= count;
	db.users[m.sender].limit -= 1
	let { key } = await m.reply('*🃏ක්‍රීඩාව ආරම්භ විය!* කාඩ්පත් බෙදා දෙමින් පවතී...');
	await sleep(5000);
	const deck = ranks.flatMap(rank => suits.map(suit => `${rank} ${suit}`)).sort(() => Math.random() - 0.5);
	const draw = () => [deck.pop(), deck.pop(), deck.pop()];
	const calcScore = hand => hand.reduce((sum, card) => sum + (['J', 'Q', 'K'].includes(card.split(' ')[0]) ? 10 : card.split(' ')[0] === 'A' ? 15 : parseInt(card)), 0);
	
	let playerHand = draw(), botHand = draw();
	let playerScore = calcScore(playerHand), botScore = calcScore(botHand);
	
	await m.reply(`*🃏කාඩ්පත් බෙදා දීම:*\n🤓 *ඔබ:* ${playerHand.join(', ')}\n🤖 *බොට්:* ${botHand.join(', ')}`, { edit: key });
	await sleep(2000);
	while (playerScore < 30 && botScore < 30 && playerHand.length < 4) {
		if (playerScore < 30) playerHand.push(deck.pop());
		if (botScore < 30) botHand.push(deck.pop());
		playerScore = calcScore(playerHand);
		botScore = calcScore(botHand);
	}
	
	let winnings = count * 1.5;
	let result = playerScore > 30 ? '💀 ඔබ පරාජය විය!' : playerScore === botScore ? '🤝 සම විය! ඔට්ටුව නැවත ලබා දෙන ලදී.' : botScore > 30 || playerScore > botScore ? `🎉 ඔබ ජයග්‍රහණය කළා! +${winnings} 💵` : '😞 බොට් ජයග්‍රහණය කළා!';
	if (playerScore <= 30 && (botScore > 30 || playerScore > botScore)) db.users[m.sender].money += (playerScore === botScore ? count : winnings);
	await m.reply(`*🃏අවසාන ප්‍රතිඵලය:*\n🤓 *ඔබ:* ${playerHand.join(', ')} (${playerScore})\n🤖 *බොට්:* ${botHand.join(', ')} (${botScore})\n\n${result}`, { edit: key })
}

const gameMerampok = async (m, db) => {
	if (db.users[m.sender].limit < 1) return m.reply(global.mess.limit)
	db.users[m.sender].limit -= 1
	let __timers = (new Date - db.users[m.sender].lastrampok)
	let _timers = (3600000 - __timers)
	let timers = clockString(_timers)
	if (new Date - db.users[m.sender].lastrampok > 3600000) {
		let dapat = (Math.floor(Math.random() * 10000))
		let who
		if (m.isGroup) who = m.mentionedJid ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.mentionedJid[0]
		else who = m.chat
		if (!who) return m.reply('කරුණාකර පුද්ගලයෙකු ටැග් (tag) කරන්න.')
		if (!db.users[who]) return m.reply('මෙම පුද්ගලයා දත්ත පද්ධතියේ (database) නැත!')
		if (10000 > db.users[who].money) return m.reply('ඔහු සතුව මංකොල්ලකෑමට තරම් මුදල් නැත.🗿')
		db.users[who].money -= dapat
		db.users[m.sender].money += dapat
		db.users[m.sender].lastrampok = new Date * 1
		m.reply(`ඉලක්කගත පුද්ගලයාගෙන් ${dapat} ක මුදලක් සාර්ථකව මංකොල්ලකෑවා!`)
	} else m.reply(`ඔබ දැනටමත් මංකොල්ලයක් සිදු කර සැඟවී සිටී, නැවත මංකොල්ලකෑමට තව ${timers} ක් රැඳී සිටින්න.`)
}

const gameBegal = async (conn, m, db) => {
	if (db.users[m.sender].limit < 1) return m.reply(global.mess.limit)
	db.users[m.sender].limit -= 1
	let user = db.users[m.sender]
	let __timers = (new Date - user.lastbegal)
	let _timers = (3600000 - __timers)
	let timers = clockString(_timers)
	const botNumber = await conn.decodeJid(conn.user.id)
	const randomUang = Math.floor(Math.random() * 10001)
	let random = [{teks: 'ක්‍රීඩකයා සාර්ථකව පැන ගියා!', no: 0},{teks: 'ක්‍රීඩකයා පළා ගියා!', no: 0},{teks: 'ක්‍රීඩකයා සැඟවී සිටී', no: 0},{teks: 'ක්‍රීඩකයා සියදිවි නසා ගත්තා', no: 2},{teks: 'ක්‍රීඩකයා සාර්ථකව අල්ලා ගත්තා', no: 2},{teks: 'ක්‍රීඩකයා සොයා ගැනීමට නොහැකි විය!', no: 0},{teks: 'ක්‍රීඩකයා ඔබට වඩා ශක්තිමත්!', no: 1},{teks: 'ක්‍රීඩකයා වංචා කළා (Cheat)', no: 1},{teks: 'ක්‍රීඩකයා පොලිසියට පැමිණිලි කළා', no: 0},{teks: 'ක්‍රීඩකයා අත්අඩංගුවට ගත්තා!', no: 2},{teks: 'ක්‍රීඩකයා යටත් විය', no: 2}]
	let teksnya = await pickRandom(random);
	if (new Date - user.lastbegal > 3600000) {
		let { key } = await m.reply('ක්‍රීඩකයෙකු සොයමින් පවතී...')
		await sleep(2000)
		if (teksnya.no === 0) {
			await m.reply({ text: teksnya.teks, edit: key })
			await m.reply('ක්‍රීඩකයා සොයා ගැනීම අසාර්ථකයි, කරුණාකර නැවත උත්සාහ කරන්න.')
		} else if (teksnya.no === 1) {
			await m.reply({ text: teksnya.teks, edit: key })
			await m.reply(`ඔබ ක්‍රීඩකයා විසින් මරා දමන ලදී!\nඔබේ මුදල් *${randomUang}* ක් කොල්ලකන ලදී.`)
			db.users[m.sender].money -= randomUang
			db.set[botNumber].money += randomUang * 1
		} else {
			await m.reply({ text: teksnya.teks, edit: key })
			await m.reply(`මුදල් ලබා ගැනීම සාර්ථකයි: *${randomUang}*`)
			db.users[m.sender].money += randomUang
			db.users[m.sender].lastbegal = new Date * 1
		}
	} else m.reply(`නැවත ක්‍රීඩා කිරීමට කරුණාකර තව *⏱️${timers}* රැඳී සිටින්න.`)
}

const daily = async (m, db) => {
	let user = db.users[m.sender]
	let __timers = (new Date - user.lastclaim)
	let _timers = (86400000 - __timers)
	let timers = clockString(_timers)
	if (new Date - user.lastclaim > 86400000) {
		m.reply(`*දෛනික ලබා ගැනීම්*\n_සාර්ථකව ලබා ගත්තා_\n- ලිමිට් : 10\n- මුදල් : 10000\n\n_ලබා ගැනීම් රීසෙට් විය._`)
		db.users[m.sender].limit += 10
		db.users[m.sender].money += 10000
		db.users[m.sender].lastclaim = new Date * 1
	} else m.reply(`නැවත ලබා ගැනීමට කරුණාකර තව *⏱️${timers}* රැඳී සිටින්න.`)
}

const buy = async (m, args, db) => {
	if (args[0] === 'limit') {
		if (!args[1]) return m.reply(`ප්‍රමාණය ඇතුළත් කරන්න!\nඋදාහරණ : ${m.prefix + m.command} limit 10`);
		let count = parseInt(args[1])
		if (db.users[m.sender].money >= count * 500) {
			db.users[m.sender].limit += count * 1
			db.users[m.sender].money -= count * 500
			m.reply(`ලිමිට් ${args[1]} ක් මිලදී ගැනීම සාර්ථකයි. මිල: ${args[1] * 500}`);
		} else m.reply(`මිලදී ගැනීමට තරම් මුදල් ඔබ සතුව නැත!\nඉතිරි මුදල : ${db.users[m.sender].money}\nමිල: ${args[1] * 500}`);
	} else m.reply(`ලිමිට් එකක මිල : ප්‍රමාණය x 500\n• ලිමිට් 1 = 500\n• ලිමිට් 2 = 1000\n\nඋදාහරණ : .buy limit 3`);
}

const setLimit = (m, db) => db.users[m.sender].limit -= 1

const addLimit = (jumlah, no, db) => db.users[no].limit += parseInt(jumlah)

const setMoney = (m, db) => db.users[m.sender].money -= 1000

const addMoney = (jumlah, no, db) => db.users[no].money += parseInt(jumlah)

const transfer = async (m, args, db) => {
	if (args[0] == 'limit') {
		if (!args[1].length > 7) return m.reply(`ට්‍රාන්ස්ෆර් මෙනුව :\nඋදාහරණ : ${m.prefix + m.command} limit @tag 11\n• ${m.prefix + m.command} limit @tag ප්‍රමාණය\n• ${m.prefix + m.command} uang @tag ප්‍රමාණය`);
		let count = parseInt(args[2] && args[2].length > 0 ? Math.min(9999999, Math.max(parseInt(args[2]), 1)) : Math.min(1))
		let who = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : args[1] ? (args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net') : false
		if (!who) return m.reply('කාවද ට්‍රාන්ස්ෆර් කරන්න ඕනේ?')
		if (db.users[who]) {
			if (db.users[m.sender].limit >= count * 1) {
				try {
					db.users[m.sender].limit -= count * 1
					db.users[who].limit += count * 1
					m.reply(`ලිමිට් ${count} ක් @${who.split('@')[0]} වෙත සාර්ථකව ට්‍රාන්ස්ෆර් කළා.`)
				} catch (e) {
					db.users[m.sender].limit += count * 1
					m.reply('ට්‍රාන්ස්ෆර් කිරීම අසාර්ථකයි.')
				}
			} else m.reply(`ලිමිට් ප්‍රමාණවත් නැත!!\nඔබේ ලිමිට් : *${db.users[m.sender].limit}*`)
		} else m.reply(`${who.split('@')[0]} අංකය දත්ත පද්ධතියේ නැත!`)
	} else if (args[0] == 'uang') {
		if (!args[1].length > 7) return m.reply(`ට්‍රාන්ස්ෆර් මෙනුව :\nඋදාහරණ : ${m.prefix + m.command} limit @tag 11\n• ${m.prefix + m.command} limit @tag ප්‍රමාණය\n• ${m.prefix + m.command} uang @tag ප්‍රමාණය`);
		let count = parseInt(args[2] && args[2].length > 0 ? Math.min(9999999, Math.max(parseInt(args[2]), 1)) : Math.min(1))
		let who = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : args[1] ? (args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net') : false
		if (!who) return m.reply('කාවද ට්‍රාන්ස්ෆර් කරන්න ඕනේ?')
		if (db.users[who]) {
			if (db.users[m.sender].money >= count * 1) {
				try {
					db.users[m.sender].money -= count * 1
					db.users[who].money += count * 1
					m.reply(`මුදල් ${count} ක් @${who.split('@')[0]} වෙත සාර්ථකව ට්‍රාන්ස්ෆර් කළා.`)
				} catch (e) {
					db.users[m.sender].money += count * 1
					m.reply('ට්‍රාන්ස්ෆර් කිරීම අසාර්ථකයි.')
				}
			} else m.reply(`මුදල් ප්‍රමාණවත් නැත!!\nඔබ සතු මුදල : *${db.users[m.sender].money}*`)
		} else m.reply(`${who.split('@')[0]} අංකය දත්ත පද්ධතියේ නැත!`)
	} else m.reply(`ට්‍රාන්ස්ෆර් මෙනුව :\nඋදාහරණ : ${m.prefix + m.command} limit @tag 11\n• ${m.prefix + m.command} limit @tag ප්‍රමාණය\n• ${m.prefix + m.command} uang @tag ප්‍රමාණය`);
}

class Blackjack {
	constructor(data) {
		this.id = data.id || '';
		this.skip = data.skip || [];
		this.host = data.host || '';
		this.leader = data.leader || '';
		this.winner = data.winner || [];
		this.players = data.players || [];
		this.started = data.started || false;
		this.startCard = data.startCard || {};
		this.submitCard = data.submitCard || [];
		this.secondDeck = data.secondDeck || [];
		this.deck = data.deck || this.generateDeck();
	}
	
	generateDeck() {
		let deck = [];
		const suits = ['♥️', '♦️', '♣️', '♠️'];
		const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
		for (let suit of suits) {
			for (let rank of ranks) {
				deck.push({ rank: rank, suit: suit });
			}
		}
		return deck;
	}
	
	shuffleDeck() {
		for (let i = this.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
		}
	}
	
	distributeCards() {
		this.shuffleDeck();
		for (let player of this.players) {
			player.cards.push(...this.deck.splice(0, { 2: 10, 3: 7, 4: 7, 5: 6, 6: 6, 7: 5, 8: 5, 9: 4, 10: 4 }[this.players.length]));
		}
		this.startCard = this.deck.shift();
		this.secondDeck.push(this.startCard);
		this.started = true;
	}
	
	hasMatching(player) {
		return this.players.find(p => p.id === player)?.cards?.some(card => card?.suit === this.startCard.suit) || false;
	}
	
	resolveRound() {
		const rankToValue = (rank) => rank === 'A' ? 14 : rank === 'K' ? 13 :  rank === 'Q' ? 12 : rank === 'J' ? 11 : parseInt(rank) || 0;
		let highestCard = this.submitCard[0];
		let leaderId = highestCard.id;
		for (let c of this.submitCard) {
			if (rankToValue(c.card.rank) > rankToValue(highestCard.card.rank)) {
				highestCard = c;
				leaderId = c.id;
			}
		}
		if (leaderId) {
			this.leader = leaderId;
			this.startCard = {};
			this.submitCard = [];
			return `@${leaderId.split('@')[0]} මීළඟ වටයට නායකත්වය දෙයි!`
		}
	}
	
	reuseSubmitCardsForDrinking() {
		const drinkers = this.players.filter(p => !this.hasMatching(p.id) && !this.skip.includes(p.id));
		const cards = this.submitCard.map(s => s.card);
		if ((this.submitCard.length + this.skip.length) === this.players.length && cards.length === 1) {
			const owner = this.submitCard[0].id;
			this.leader = owner;
			for (const player of this.players) {
				if (player.id !== owner) this.skip.push(player.id);
			}
			return {
				msg: `@${owner.split('@')[0]} සතුව පමණක් කාඩ්පත් ඇත, ඔහු නව නායකයා වේ.`,
				continue: true
			}
		} else {
			let index = 0;
			for (const card of cards) {
				if (!drinkers.length) break;
				const player = this.players.find(p => p.id === drinkers[index % drinkers.length].id);
				player.cards.push(card);
				if (!this.skip.find(a => a.id === player.id)) this.skip.push({ id: player.id });
				index++;
			}
			return {
				msg: `කාඩ්පත් බෙදා දෙන ලදී.`,
				continue: true
			}
		}
	}
}

class SnakeLadder {
	constructor(data) {
		this.turn = data.turn || 0;
		this.host = data.host || null;
		this.start = data.start || false;
		this.players = data.players || [];
		this.map = data.map || this.createMap();
	}
	
	rollDice() {
		return Math.floor(Math.random() * 6) + 1;
	}
	
	createMap () {
		const data = [{
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map1.jpg',
			move: { 4: 56, 12: 50, 14: 55, 22: 58, 41: 79, 54: 88, 96: 42, 94: 71, 75: 32, 48: 16, 37: 3, 28: 10 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map2.jpg',
			move: { 7: 36, 21: 58, 31: 51, 34: 84, 54: 89, 63: 82, 96: 72, 78: 59, 66: 12, 56: 20, 43: 24, 33: 5 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map3.jpg',
			move: { 8: 29, 10: 32, 20: 39, 27: 85, 51: 67, 72: 91, 79: 100, 98: 65, 94: 75, 93: 73, 64: 60, 62: 19, 56: 24, 53: 50, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map4.jpg',
			move: { 8: 29, 10: 32, 20: 39, 27: 85, 51: 67, 72: 91, 79: 100, 98: 65, 94: 75, 93: 73, 64: 60, 62: 19, 56: 24, 53: 50, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map5.jpg',
			move: { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 51: 67, 72: 91, 80: 99, 98: 79, 94: 75, 93: 73, 87: 36, 64: 60, 62: 19, 54: 34, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map6.jpg',
			move: { 4: 23, 13: 46, 33: 52, 42: 63, 50: 69, 62: 81, 74: 93, 99: 41, 95: 76, 89: 53, 66: 45, 54: 31, 43: 17, 40: 2, 27: 5 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map7.jpg',
			move: { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 51: 67, 71: 91, 80: 100, 98: 79, 95: 75, 93: 73, 87: 24, 64: 60, 62: 19, 54: 34, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nimesha206/database/master/games/images/map/map8.jpg',
			move: { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 87: 94, 99: 80, 95: 75, 92: 88, 89: 68, 74: 53, 64: 60, 62: 19, 49: 11, 46: 25, 16: 6 },
			mode: ''
		}];
		return data[Math.floor(Math.random() * data.length)];
	}
	
	nextTurn() {
		this.turn = (this.turn + 1) % this.players.length;
	}
	
	async drawBoard(boardUrl, players = []) {
		try {
			const board = await jimp.read(boardUrl);
			board.resize(612, 612);
			const width = board.getWidth();
			const height = board.getHeight();
			const size = Math.min(width, height);
			board.crop((width - size) / 2, (height - size) / 2, size, size);
			const tileSize = size / 10;
			players.filter(a => a.move !== null);
			for (let i = 0; i < players.length; i++) {
				const position = players[i].move;
				const row = Math.floor((position - 1) / 10);
				const col = (row % 2 === 0) ? (position - 1) % 10 : 9 - (position - 1) % 10;
				const x = col * tileSize;
				const y = (9 - row) * tileSize;
				const player = await jimp.read(`https://raw.githubusercontent.com/nimesha206/database/master/games/images/player${i + 1}.png`);
				const pionSize = tileSize * 0.7;
				player.resize(pionSize, pionSize);
				board.composite(player, x + tileSize / 2 - pionSize / 2, y + tileSize / 2 - pionSize / 2, {
					mode: jimp.BLEND_SOURCE_OVER
				});
			}
			const result = await board.getBufferAsync(jimp.MIME_JPEG);
			return result;
		} catch (e) {
			return null;
		}
	}
}

module.exports = {
	rdGame,
	iGame,
	tGame,
	gameSlot,
	gameCasinoSolo,
	gameSamgongSolo,
	gameMerampok,
	gameBegal,
	daily,
	buy,
	setLimit,
	addLimit,
	addMoney,
	setMoney,
	transfer,
	Blackjack,
	SnakeLadder
}
