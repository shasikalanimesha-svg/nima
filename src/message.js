require('../settings');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const chalk = require('chalk');
const crypto = require('crypto');
const FileType = require('file-type');
const PhoneNumber = require('awesome-phonenumber');

const groupMetadataTimers = {};
const { checkStatus } = require('./database');
const { imageToWebp, videoToWebp, writeExif, gifToWebp } = require('../lib/exif');
const { getBuffer, getSizeMedia, fetchJson, sleep, axiosss, fixBytes } = require('../lib/function');
const { jidNormalizedUser, proto, getBinaryNodeChildren, getBinaryNodeChildString, getBinaryNodeChild, generateMessageIDV2, jidEncode, encodeSignedDeviceIdentity, generateWAMessageContent, generateForwardMessageContent, prepareWAMessageMedia, delay, areJidsSameUser, extractMessageContent, generateMessageID, downloadContentFromMessage, generateWAMessageFromContent, jidDecode, generateWAMessage, toBuffer, getContentType, getDevice } = require('baileys');

/*
	* Create By Nimesha Madhushan
	* Follow https://github.com/nimesha206
	* Whatsapp : https://whatsapp.com/channel/0029Vb68g1c3LdQLQDkbAQ3M
*/

async function GroupUpdate(nimesha, m, store) {
	function clearParse(parse) {
		try {
			return JSON.parse(parse);
		} catch {
			return parse;
		}
	}
	if (!m.messageStubType || !m.isGroup) return
	if (global.db?.groups?.[m.chat] && store?.groupMetadata?.[m.chat]) {
		const admin = `@${m.sender.split('@')[0]}`
		const metadata = store.groupMetadata[m.chat];
		const normalizedTarget = clearParse(m.messageStubParameters[0]);
		const type = m.messageStubType;
		const messages = {
			1: 'සමූහයේ ලින්ක් එක අලුත් කරන ලදී!',
			21: `සමූහයේ නම මෙලෙස වෙනස් කරන ලදී :\n*${normalizedTarget}*`,
			22: 'සමූහයේ රූපය (icon) වෙනස් කරන ලදී.',
			23: 'සමූහයේ ලින්ක් එක අලුත් කරන ලදී!',
			24: `සමූහයේ විස්තරය වෙනස් කරන ලදී.\n\n${normalizedTarget}`,
			25: `සමූහයේ තොරතුරු වෙනස් කිරීමේ හැකියාව *${normalizedTarget == 'on' ? 'පරිපාලකවරුන්ට පමණක්' : 'සෑම සාමාජිකයෙකුටම'}* ලබා දෙන ලදී.`,
			26: `සමූහය *${normalizedTarget == 'on' ? 'වසා දමන ලදී' : 'විවෘත කරන ලදී'}*!\nදැන් පණිවිඩ යැවිය හැක්කේ ${normalizedTarget == 'on' ? 'පරිපාලකවරුන්ට පමණක්' : 'සෑම සාමාජිකයෙකුටම'} වේ.`,
			29: `@${normalizedTarget?.id?.split('@')?.[0]} ව පරිපාලකයෙකු (Admin) ලෙස පත් කරන ලදී.`,
			30: `@${normalizedTarget?.id?.split('@')?.[0]} ව පරිපාලක (Admin) ධුරයෙන් ඉවත් කරන ලදී.`,
			72: `තාවකාලික පණිවිඩ කාලය (Ephemeral) *@${normalizedTarget}* ලෙස වෙනස් කරන ලදී.`,
			123: 'තාවකාලික පණිවිඩ අක්‍රිය කරන ලදී.',
			132: 'සමූහයේ ලින්ක් එක අලුත් කරන ලදී!',
		}
		if (nimesha.public && global.db?.groups?.[m.chat]?.setinfo && messages[type]) {
			await nimesha.sendMessage(m.chat, { text: `${admin} ${messages[type]}`, mentions: [m.sender, ...((normalizedTarget?.id || normalizedTarget)?.includes('@') ? [`${normalizedTarget.id || normalizedTarget}`] : [])]}, { ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
		if (type === 20) {
			clearTimeout(groupMetadataTimers[m.chat])
			groupMetadataTimers[m.chat] = setTimeout(async () => {
				store.groupMetadata[m.chat] = await nimesha.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
			}, 5000);
		} else if (type === 29 || type === 30) {
			const target = jidNormalizedUser(normalizedTarget.id || normalizedTarget)
			const newAdminValue = type === 29 ? 'admin' : null
			if (metadata?.participants?.length) {
				metadata.participants = metadata.participants.map(p => {
					const key = metadata.addressingMode === 'lid' ? jidNormalizedUser(p.lid) : jidNormalizedUser(p.id)
					if (key === target) {
						return { ...p, admin: newAdminValue }
					}
					return p
				})
			}
		} else if (type === 27) {
			if (!metadata.participants.some(a => (a.id === (normalizedTarget.id || normalizedTarget) || a.lid === (normalizedTarget.id || normalizedTarget)))) {
				clearTimeout(groupMetadataTimers[m.chat])
				groupMetadataTimers[m.chat] = setTimeout(async () => {
					store.groupMetadata[m.chat] = await nimesha.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
				}, 5000);
			}
		} else if (type === 28 || type === 32) {
			if (m.fromMe && ((jidNormalizedUser(nimesha.user.id) == (normalizedTarget.id || normalizedTarget)) || (jidNormalizedUser(nimesha.user.lid) == (normalizedTarget.id || normalizedTarget)))) {
				delete store.messages[m.chat];
				delete store.presences[m.chat];
				delete store.groupMetadata[m.chat];
			}
			if(!!metadata) metadata.participants = metadata.participants.filter(p => {
				const key = metadata.addressingMode === 'lid' ? jidNormalizedUser(p.lid) : jidNormalizedUser(p.id)
				return key !== (normalizedTarget.id || normalizedTarget)
			});
		} else {
			console.log({
				messageStubType: m.messageStubType, type,
				messageStubParameters: m.messageStubParameters,
			})
		}
	}
}

async function GroupParticipantsUpdate(nimesha, { id, participants, author, action }, store) {
	try {
		function updateAdminStatus(participants, metadataParticipants, status) {
			for (const participant of metadataParticipants) {
				if (participants.includes(jidNormalizedUser(participant.id)) || participants.includes(jidNormalizedUser(participant.lid))) {
					participant.admin = status;
				}
			}
		}
		if (global.db?.groups?.[id] && store?.groupMetadata?.[id]) {
			const metadata = store.groupMetadata[id];
			for (let n of participants) {
				const jid = typeof n === 'string' ? n : (n?.phoneNumber || n?.id || '');
				const participant = metadata.participants.find(a => a.id == jidNormalizedUser(jid))
				let profile;
				try {
					profile = await nimesha.profilePictureUrl(jid, 'image');
				} catch {
					profile = 'https://telegra.ph/file/95670d63378f7f4210f03.png';
				}
				let messageText;
				if (action === 'add') {
					if (db.groups[id].welcome) messageText = db.groups[id]?.text?.setwelcome || `╔══════════════════════╗
║  🌸 *${metadata.subject}* 🌸  ║
╚══════════════════════╝

🇱🇰 *සාදරයෙන් පිළිගනිමු @* 🙏
🇬🇧 *Welcome @* 🙏
🇮🇳 *வரவேற்கிறோம் @* 🙏

━━━━━━━━━━━━━━━━━━━━━━
📝 ${metadata.desc ? metadata.desc : '🌟 ' + metadata.subject}
━━━━━━━━━━━━━━━━━━━━━━

🇱🇰 *සිංහල*
සමූහයට සාදරයෙන් පිළිගනිමු! 
කරුණාකර සමූහ නීති පිළිපදින්න.
හැමෝටම ගරු කරන්න. 💚

🇬🇧 *English*
Welcome to the group!
Please follow the group rules.
Respect all members. 💚

🇮🇳 *தமிழ்*
குழுவிற்கு வரவேற்கிறோம்!
குழு விதிகளை பின்பற்றவும்.
அனைவரையும் மதிக்கவும். 💚

━━━━━━━━━━━━━━━━━━━━━━
🌸 *MISS SHASIKALA BOT* ✨
👑 _By NIMESHA MADHUSHAN_`;
					if (!participant) {
						clearTimeout(groupMetadataTimers[id])
						groupMetadataTimers[id] = setTimeout(async () => {
							store.groupMetadata[id] = await nimesha.groupMetadata(id).catch(e => ({ ...store.groupMetadata[id] }));
						}, 5000);
					}
				} else if (action === 'remove') {
					if (db.groups[id].leave) messageText = db.groups[id]?.text?.setleave || `╔══════════════════╗\n║  👋 *සමූහය හැරගිය!* 👋\n╠══════════════════╣\n║\n║ 😢 @\n║ *${metadata.subject}*\n║ *සමූහයෙන් ඉවත් වී ඇත.*\n║\n║ 🌸 ඔවුන්ට සුභ ගමනක් වේවා!\n╚══════════════════╝`;
					if ((jidNormalizedUser(nimesha.user.lid) == jidNormalizedUser(jid)) || (jidNormalizedUser(nimesha.user.id) == jidNormalizedUser(jid))) {
						delete store.messages[id];
						delete store.presences[id];
						delete store.groupMetadata[id];
					}
					if(metadata) metadata.participants = metadata.participants.filter(p => !participants.includes(metadata.addressingMode === 'lid' ? jidNormalizedUser(p.lid) : jidNormalizedUser(p.id)));
				} else if (action === 'promote') {
					if (db.groups[id].promote) messageText = db.groups[id]?.text?.setpromote || `╔══════════════════╗\n║  👑 *Admin උසස්වීම* 👑\n╠══════════════════╣\n║\n║ 🎉 @\n║ *${metadata.subject}*\n║ *Admin ලෙස පත් කරන ලදී!*\n║\n║ 💪 ගරු Admin!\n║ 🌸 By: @admin\n╚══════════════════╝`;
					updateAdminStatus(participants, metadata.participants, 'admin');
				} else if (action === 'demote') {
					if (db.groups[id].demote) messageText = db.groups[id]?.text?.setdemote || `╔══════════════════╗\n║  🚫 *Admin ධුර ඉවත්කිරීම* 🚫\n╠══════════════════╣\n║\n║ 📉 @\n║ *${metadata.subject}*\n║ *Admin ධුරයෙන් ඉවත් කෙරිණ.*\n║\n║ 🌸 By: @admin\n╚══════════════════╝`;
					updateAdminStatus(participants, metadata.participants, null);
				}
				if (messageText && nimesha.public) {
					await nimesha.sendMessage(id, {
						text: messageText.replace('@subject', author ? `${metadata.subject}` : '@subject').replace('@admin', author ? `@${author.split('@')[0]}` : '@admin').replace(/(?<=\s|^)@(?!\w)/g, `@${jid.split('@')[0]}`),
						contextInfo: {
							mentionedJid: [jid, author],
							externalAdReply: {
								title: action == 'add' ? 'සාදරයෙන් පිළිගනිමු' : action == 'remove' ? 'සමුගැනීම' : action.charAt(0).toUpperCase() + action.slice(1),
								mediaType: 1,
								previewType: 0,
								thumbnailUrl: profile,
								renderLargerThumbnail: true,
								sourceUrl: global.my.gh
							}
						}
					}, { ephemeralExpiration: metadata?.ephemeralDuration || store?.messages[id]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
				}
			}
		}
	} catch (e) {
		throw e;
	}
}

async function LoadDataBase(nimesha, m) {
	try {
		const botNumber = await nimesha.decodeJid(nimesha.user.id);
		let game = global.db.game || {};
		let premium = global.db.premium || [];
		let user = global.db.users[m.sender] || {};
		let setBot = global.db.set[botNumber] || {};
		
		global.db.game = game;
		global.db.users[m.sender] = user;
		global.db.set[botNumber] = setBot;
		
		const defaultSetBot = {
			lang: 'si', // මෙතැන 'id' වෙනුවට 'si' (Sinhala) ලෙස වෙනස් කළා
			limit: 0,
			money: 0,
			status: 0,
			join: false,
			public: true,
			anticall: false,
			original: true,
			readsw: false,
			autobio: false,
			autoread: false,
			antispam: false,
			autotyping: false,
			grouponly: false,
			multiprefix: false,
			privateonly: false,
			didyoumean: true,
			autostatus: false,
			antidelete: false,
			author: global.author || 'Nimesha Madhushan',
			autobackup: false,
			botname: global.botname || 'Miss Shasikala',
			packname: global.packname || 'Miss Shasikala',
			template: 'documentMessage',
			owner: global.owner,
		};
		for (let key in defaultSetBot) {
			if (!(key in setBot)) setBot[key] = defaultSetBot[key];
		}
		
		const limitUser = user.vip ? global.limit.vip : checkStatus(m.sender, premium) ? global.limit.premium : global.limit.free;
		const moneyUser = user.vip ? global.money.vip : checkStatus(m.sender, premium) ? global.money.premium : global.money.free;
		
		const defaultUser = {
			vip: false,
			ban: false,
			afkTime: -1,
			afkReason: '',
			register: false,
			limit: limitUser,
			money: moneyUser,
			lastclaim: Date.now(),
			lastbegal: Date.now(),
			lastrampok: Date.now(),
		};
		for (let key in defaultUser) {
			if (!(key in user)) user[key] = defaultUser[key];
		}
		
		if (m.isGroup) {
			let group = global.db.groups[m.chat] || {};
			global.db.groups[m.chat] = group;
			
			const defaultGroup = {
				url: '',
				text: {},
				warn: {},
				tagsw: {},
				nsfw: false,
				mute: false,
				leave: false,
				setinfo: false,
				antilink: false,
				demote: true,
				antitoxic: false,
				promote: true,
				welcome: false,
				antivirtex: false,
				antitagsw: false,
				antidelete: false,
				antihidetag: false,
				waktusholat: false,
			};
			for (let key in defaultGroup) {
				if (!(key in group)) group[key] = defaultGroup[key];
			}
		}
		
		const defaultGame = {
			suit: {},
			chess: {},
			chat_ai: {},
			menfes: {},
			tekateki: {},
			akinator: {},
			tictactoe: {},
			tebaklirik: {},
			kuismath: {},
			blackjack: {},
			tebaklagu: {},
			tebakkata: {},
			family100: {},
			susunkata: {},
			tebakbom: {},
			ulartangga: {},
			tebakkimia: {},
			caklontong: {},
			tebakangka: {},
			tebaknegara: {},
			tebakgambar: {},
			tebakbendera: {},
			gemini_autoreply: {},
			gemini_history: {},
			private_ai_disabled: true,  // default OFF - .aion ගෙන ON කරන්න
		};
		for (let key in defaultGame) {
			if (!(key in game)) game[key] = defaultGame[key];
		}
		
	} catch (e) {
		throw e
	}
}

async function MessagesUpsert(nimesha, message, store) {
	try {
		let botNumber = await nimesha.decodeJid(nimesha.user.id);
		const msg = message.messages[0];
		const remoteJid = msg.key.remoteJid;
		(store.messages ??= {})[remoteJid] ??= {};
		store.messages[remoteJid].array ??= [];
		store.messages[remoteJid].keyId ??= new Set();
		if (!(store.messages[remoteJid].keyId instanceof Set)) {
			store.messages[remoteJid].keyId = new Set(store.messages[remoteJid].array.map(m => m.key.id));
		}
		if (store.messages[remoteJid].keyId.has(msg.key.id)) return;
		store.messages[remoteJid].array.push(msg);
		store.messages[remoteJid].keyId.add(msg.key.id);
		if (store.messages[remoteJid].array.length > (global.chatLength || 250)) {
			const removed = store.messages[remoteJid].array.shift();
			store.messages[remoteJid].keyId.delete(removed.key.id);
		}
		if (!store.groupMetadata || Object.keys(store.groupMetadata).length === 0) store.groupMetadata ??= await nimesha.groupFetchAllParticipating().catch(e => ({}));
		const type = msg.message ? (getContentType(msg.message) || Object.keys(msg.message)[0]) : '';
		const m = await Serialize(nimesha, msg, store)
		await require('../nima')(nimesha, m, msg, store).catch(e => console.error('[nima error]', e?.message || e));
		await require('../shasikala')(nimesha, m, msg, store).catch(e => console.error('[shasikala error]', e?.message || e));
		if (db?.set?.[botNumber]?.readsw && msg.key.remoteJid === 'status@broadcast') {
			await nimesha.readMessages([msg.key]);
			if (/protocolMessage/i.test(type)) await nimesha.sendFromOwner(global.db?.set?.[botNumber]?.owner || global.owner, '@' + msg.key.participant.split('@')[0] + ' ගේ ස්ටේටස් (Status) එක මකා දමා ඇත.', msg, { mentions: [msg.key.participant] });
			if (/(audioMessage|imageMessage|videoMessage|extendedTextMessage)/i.test(type)) {
				let keke = (type == 'extendedTextMessage') ? `ස්ටේටස් ලේඛනය (Text Story): ${msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : ''}` : (type == 'imageMessage') ? `ස්ටේටස් ඡායාරූපය ${msg.message.imageMessage.caption ? 'විස්තරය (Caption) සමඟ: ' + msg.message.imageMessage.caption : ''}` : (type == 'videoMessage') ? `ස්ටේටස් වීඩියෝව ${msg.message.videoMessage.caption ? 'විස්තරය (Caption) සමඟ: ' + msg.message.videoMessage.caption : ''}` : (type == 'audioMessage') ? 'ස්ටේටස් හඬ පටය (Audio Story)' : '\nනොදන්නා ස්ටේටස් වර්ගයකි, කරුණාකර පරීක්ෂා කරන්න.'
				await nimesha.sendFromOwner(global.db?.set?.[botNumber]?.owner || global.owner, `@${msg.key.participant.split('@')[0]} ගේ ස්ටේටස් එක නරඹන ලදී.\n${keke}`, msg, { mentions: [msg.key.participant] });
			}
		}
	} catch (e) {
		console.error('[MessagesUpsert error]', e?.message || e);
	}
}

async function Solving(nimesha, store) {
	nimesha.serializeM = (m) => MessagesUpsert(nimesha, m, store)
	
	nimesha.decodeJid = (jid) => {
		if (!jid) return jid
		if (/:\d+@/gi.test(jid)) {
			let decode = jidDecode(jid) || {}
			return decode.user && decode.server && decode.user + '@' + decode.server || jid
		} else return jid
	}
	
	nimesha.findJidByLid = (lid, store, resolve = false) => {
		const groupMeta = store?.groupMetadata
		if (groupMeta) {
			for (const g of Object.values(groupMeta)) {
				if (!g?.participants) continue
				for (const contact of g.participants) {
					if (contact?.lid === lid && contact?.id) {
						return contact.id
					}
				}
			}
		}
		const contacts = store?.contacts
		if (contacts) {
			for (const contact of Object.values(contacts)) {
				if (contact?.lid === lid && contact?.id) {
					return contact.id
				}
			}
		}
		if (resolve) return lid
		return null
	}
	
	nimesha.getName = (jid, withoutContact  = false) => {
		const id = nimesha.decodeJid(jid);
		if (id.endsWith('@g.us')) {
			const groupInfo = store.contacts[id] || (store.groupMetadata[id] ? store.groupMetadata[id] : (store.groupMetadata[id] = nimesha.groupMetadata(id))) || {};
			return Promise.resolve(groupInfo.name || groupInfo.subject || PhoneNumber('+' + id.replace('@g.us', '')).getNumber('international'));
		} else {
			if (id === '0@s.whatsapp.net') {
				return 'WhatsApp';
			}
		const contactInfo = store.contacts[id] || {};
		return withoutContact ? '' : contactInfo.name || contactInfo.subject || contactInfo.verifiedName || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international');
		}
	}
	
	nimesha.sendContact = async (jid, kon, quoted = '', opts = {}) => {
		let list = []
		for (let i of kon) {
			list.push({
				displayName: await nimesha.getName(i + '@s.whatsapp.net'),
				vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await nimesha.getName(i + '@s.whatsapp.net')}\nFN:${await nimesha.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:ජංගම\nitem2.ADR:;;ශ්‍රී ලංකාව;;;;\nitem2.X-ABLabel:කලාපය\nEND:VCARD`
			})
		}
		nimesha.sendMessage(jid, { contacts: { displayName: `සම්බන්ධතා ${list.length}`, contacts: list }, ...opts }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	nimesha.profilePictureUrl = async (jid, type = 'image', timeoutMs) => {
		const result = await nimesha.query({
			tag: 'iq',
			attrs: {
				target: jidNormalizedUser(jid),
				to: '@s.whatsapp.net',
				type: 'get',
				xmlns: 'w:profile:picture'
			},
			content: [{
				tag: 'picture',
				attrs: {
					type, query: 'url'
				},
			}]
		}, timeoutMs);
		const child = getBinaryNodeChild(result, 'picture');
		return child?.attrs?.url;
	}
	
	nimesha.setStatus = (status) => {
		nimesha.query({
			tag: 'iq',
			attrs: {
				to: '@s.whatsapp.net',
				type: 'set',
				xmlns: 'status',
			},
			content: [{
				tag: 'status',
				attrs: {},
				content: Buffer.from(status, 'utf-8')
			}]
		})
		return status
	}
	
	nimesha.extractGroupMetadata = (result) => {
		const group = getBinaryNodeChild(result, 'group');
		const descChild = getBinaryNodeChild(group, 'description');
		const desc = descChild ? getBinaryNodeChildString(descChild, 'body') : undefined;
		const descId = descChild?.attrs?.id;
		const groupId = group.attrs.id.includes('@') ? group.attrs.id : jidEncode(group.attrs.id, 'g.us');
		const eph = getBinaryNodeChild(group, 'ephemeral')?.attrs?.expiration;
		const participants = getBinaryNodeChildren(group, 'participant') || [];
		return {
			id: groupId,
			addressingMode: group.attrs.addressing_mode,
			subject: group.attrs.subject,
			subjectOwner: group.attrs.s_o,
			subjectTime: +group.attrs.s_t,
			creation: +group.attrs.creation,
			size: participants.length,
			owner: group.attrs.creator ? jidNormalizedUser(group.attrs.creator) : undefined,
			desc,
			descId,
			linkedParent: getBinaryNodeChild(group, 'linked_parent')?.attrs?.jid,
			restrict: !!getBinaryNodeChild(group, 'locked'),
			announce: !!getBinaryNodeChild(group, 'announcement'),
			isCommunity: !!getBinaryNodeChild(group, 'parent'),
			isCommunityAnnounce: !!getBinaryNodeChild(group, 'default_sub_group'),
			joinApprovalMode: !!getBinaryNodeChild(group, 'membership_approval_mode'),
			memberAddMode: getBinaryNodeChildString(group, 'member_add_mode') === 'all_member_add',
			ephemeralDuration: eph ? +eph : undefined,
			participants: participants.map(({ attrs }) => ({
				id: attrs.jid.endsWith('@lid') ? attrs.phone_number : attrs.jid,
				lid: attrs.jid.endsWith('@lid') ? attrs.jid : attrs.lid,
				admin: attrs.type || null
			}))
		};
	}
	
	
	nimesha.groupMetadata = async (jid) => {
		const result = await nimesha.query({
			tag: 'iq',
			attrs: {
				type: 'get',
				xmlns: 'w:g2',
				to: jid
			},
			content: [{ tag: 'query', attrs: { request: 'interactive' }}]
		});
		return nimesha.extractGroupMetadata(result);
	};
	
	nimesha.groupFetchAllParticipating = async () => {
		const result = await nimesha.query({ tag: 'iq', attrs: { to: '@g.us', xmlns: 'w:g2', type: 'get' }, content: [{ tag: 'participating', attrs: {}, content: [{ tag: 'participants', attrs: {}}, { tag: 'description', attrs: {}}]}]});
		const data = {};
		const groupsChild = getBinaryNodeChild(result, 'groups');
		if (groupsChild) {
			const groups = getBinaryNodeChildren(groupsChild, 'group');
			for (const groupNode of groups) {
				const meta = nimesha.extractGroupMetadata({
					tag: 'result',
					attrs: {},
					content: [groupNode]
				});
				data[meta.id] = meta;
			}
		}
		nimesha.ev.emit('groups.update', Object.values(data));
		return data;
	}
	
	nimesha.relayMessageV2 = async (jid, message, options) => {
		const msg = generateWAMessageFromContent(jid, message, {
			upload: nimesha.waUploadToServer,
			messageId: generateMessageID(),
			...options
		});
		const hasil = await nimesha.relayMessage(jid, msg.message, {
			messageId: msg.key.id,
			...options
		});
		return hasil;
	}

	nimesha.sendPoll = (jid, නාමය = '', values = [], quoted, selectableCount = 1) => {
		return nimesha.sendMessage(jid, { poll: { නාමය, values, selectableCount }}, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	}
	
	nimesha.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
		const quotedOptions = { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 }
		async function getFileUrl(res, mime) {
			if (mime && mime.includes('gif')) {
				return nimesha.sendMessage(jid, { video: res.data, caption: caption, gifPlayback: true, ...options }, quotedOptions);
			} else if (mime && mime === 'application/pdf') {
				return nimesha.sendMessage(jid, { document: res.data, mimetype: 'application/pdf', caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('image')) {
				return nimesha.sendMessage(jid, { image: res.data, caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('video')) {
				return nimesha.sendMessage(jid, { video: res.data, caption: caption, mimetype: 'video/mp4', ...options }, quotedOptions);
			} else if (mime && mime.includes('webp') && !/.jpg|.jpeg|.png/.test(url)) {
				return nimesha.sendAsSticker(jid, res.data, quoted, options);
			} else if (mime && mime.includes('audio')) {
				return nimesha.sendMessage(jid, { audio: res.data, mimetype: 'audio/mpeg', ...options }, quotedOptions);
			}
		}
		
		const res = await axiosss.get(url, { responseType: 'arraybuffer' });
		let mime = res.headers['content-type'];
		if (!mime || mime.includes('octet-stream')) {
			const fileType = await FileType.fromBuffer(res.data);
			mime = fileType ? fileType.mime : null;
		}
		const hasil = await getFileUrl(res, mime);
		return hasil
	}
	
	nimesha.sendGroupInviteV4 = async (jid, participant, inviteCode, inviteExpiration, groupName = 'නොදන්නා විෂයකි', caption = 'මගේ WhatsApp සමූහයට එකතු වීමට ආරාධනා පත්‍රයකි', jpegThumbnail = null, options = {}) => {
		const msg = proto.Message.create({
			groupInviteMessage: {
				inviteCode,
				inviteExpiration: parseInt(inviteExpiration) || + new Date(new Date + (3 * 86400000)),
				groupJid: jid,
				groupName,
				jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ? jpegThumbnail : null,
				caption,
				contextInfo: {
					mentionedJid: options.mentions || []
				}
			}
		});
		const message = generateWAMessageFromContent(participant, msg, options);
		const invite = await nimesha.relayMessage(participant, message.message, { messageId: message.key.id })
		return invite
	}
	
	nimesha.sendFromOwner = async (jids, text, quoted, options = {}) => {
		for (const a of jids) {
			const _jid = a.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
			await nimesha.sendMessage(_jid, { text, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[_jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
	}
	
	nimesha.sendText = async (jid, text, quoted, options = {}) => nimesha.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	
	nimesha.sendAsSticker = async (jid, path, quoted, options = {}) => {
		const buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
		const result = await writeExif(buff, options);
		return nimesha.sendMessage(jid, { sticker: { url: result }, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	nimesha.downloadMediaMessage = async (message) => {
		const msg = message.msg || message;
		msg.mediaKey = fixBytes(msg.mediaKey);
		msg.fileSha256 = fixBytes(msg.fileSha256);
		msg.fileEncSha256 = fixBytes(msg.fileEncSha256);
		const mime = msg.mimetype || '';
		const messageType = (message.type || mime.split('/')[0]).replace(/Message/gi, '');
		const stream = await downloadContentFromMessage(msg, messageType);
		let buffer = Buffer.from([]);
		for await (const chunk of stream) {
			buffer = Buffer.concat([buffer, chunk]);
		}
		return buffer
	}
	
	nimesha.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
		const buffer = await nimesha.downloadMediaMessage(message);
		const type = await FileType.fromBuffer(buffer);
		const dir = './database/temp';
		await fs.promises.mkdir(dir, { recursive: true });
		const trueFileName = attachExtension ? `${dir}/${filename ? filename : Date.now()}.${type.ext}` : filename;
		await fs.promises.writeFile(trueFileName, buffer);
		return trueFileName;
	}
	
	nimesha.getFile = async (PATH, save) => {
		let res;
		let filename;
		let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
		let type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' }
		filename = path.join(__dirname, '../database/temp/' + new Date * 1 + '.' + type.ext)
		if (data && save) fs.promises.writeFile(filename, data)
		return {
			res,
			filename,
			size: await getSizeMedia(data),
...type,
			data
		}
	}
	
	nimesha.appendResponseMessage = async (m, text) => {
		let apb = await generateWAMessage(m.chat, { text, mentions: m.mentionedJid }, { userJid: nimesha.user.id, quoted: m.quoted && m.quoted.fakeObj(), ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
		apb.key = m.key
		apb.key.id = [...Array(32)].map(() => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
		apb.key.fromMe = areJidsSameUser(m.sender, nimesha.user.id);
		if (m.isGroup) apb.participant = m.sender;
		nimesha.ev.emit('messages.upsert', {
			...m,
			messages: [proto.WebMessageInfo.create(apb)],
			type: 'append'
		});
	}
	
	nimesha.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
		const { mime, data, filename } = await nimesha.getFile(path, true);
		const botNumber = nimesha.decodeJid(nimesha.user.id);
		const isWebpSticker = options.asSticker || /webp/.test(mime);
		let type = 'document', mimetype = mime, pathFile = filename;
		if (isWebpSticker) {
			pathFile = await writeExif(data, {
				packname: options.packname || db?.set?.[botNumber]?.packname || 'Bot WhatsApp',
				author: options.author || db?.set?.[botNumber]?.author || 'Nimesha Madhushan',
				categories: options.categories || [],
			})
			await fs.unlinkSync(filename);
			type = 'sticker';
			mimetype = 'image/webp';
		} else if (/image|video|audio/.test(mime)) {
			type = mime.split('/')[0];
			mimetype = type == 'video' ? 'video/mp4' : type == 'audio' ? 'audio/mpeg' : mime
		}
		let anu = await nimesha.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, ...options });
		await fs.unlinkSync(pathFile);
		return anu;
	}
	
	nimesha.sendAlbumMessage = async (jid, content = {}, options = {}) => {
		const { album, mentions, contextInfo, ...others } = content;
		for (const media of album) {
			if (!media.image && !media.video) throw new TypeError(`ඇල්බමය තුළ අනිවාර්යයෙන්ම ඡායාරූප හෝ වීඩියෝ තිබිය යුතුය.`);
		}
		if (album.length < 2) throw new RangeError("අවම වශයෙන් මාධ්‍ය ගොනු 2ක් අවශ්‍ය වේ.");
		const medias = await generateWAMessageFromContent(jid, {
			albumMessage: {
				expectedImageCount: album.filter(m => m.image).length,
				expectedVideoCount: album.filter(m => m.video).length,
			}
		}, { quoted: options?.quoted || null });
		await nimesha.relayMessage(jid, medias.message, { messageId: medias.key.id });
		for (const media of album) {
			const msg = await generateWAMessage(jid, { ...others, ...media }, { upload: nimesha.waUploadToServer });
			msg.message.messageContextInfo = {
				messageAssociation: {
					associationType: 1,
					parentMessageKey: medias.key
				}
			}
			await nimesha.relayMessage(jid, msg.message, { messageId: msg.key.id });
		}
		return medias;
	}
	
	nimesha.sendListMsg = async (jid, content = {}, options = {}) => {
		const { text, caption, footer = '', title, subtitle, ai, contextInfo = {}, buttons = [], messageParamsJson = {}, mentions = [], ...media } = content;
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2,
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: text || caption || '' }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
						header: proto.Message.InteractiveMessage.Header.create({
							title,
							subtitle,
							hasMediaAttachment: Object.keys(media).length > 0,
							...(media && typeof media === 'object' && Object.keys(media).length > 0 ? await generateWAMessageContent(media, {
								upload: nimesha.waUploadToServer
							}) : {})
						}),
						nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
							...(messageParamsJson && typeof messageParamsJson === 'object' && Object.keys(messageParamsJson).length > 0 ? messageParamsJson : {}),
							buttons: buttons.map(a => {
								return {
									name: a.name,
									buttonParamsJson: JSON.stringify(a.buttonParamsJson ? (typeof a.buttonParamsJson === 'string' ? JSON.parse(a.buttonParamsJson) : a.buttonParamsJson) : '')
								}
							})
						}),
						contextInfo: {
							...contextInfo,
							...options.contextInfo,
							mentionedJid: options.mentions || mentions,
							...(options.quoted ? {
								stanzaId: options.quoted.key.id,
								remoteJid: options.quoted.key.remoteJid,
								participant: options.quoted.key.participant || options.quoted.key.remoteJid,
								fromMe: options.quoted.key.fromMe,
								quotedMessage: options.quoted.message
							} : {})
						}
					})
				}
			}
		}, {});
		await nimesha.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [{
				tag: 'biz',
				attrs: {},
				content: [{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [{
						tag: 'native_flow',
						attrs: {
							v: '9',
							name: 'mixed'
						}
					}]
				}]
			}, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
		})
		return msg  // key සහිතව return — edit/delete සඳහා
	}
	
	nimesha.sendButtonMsg = async (jid, content = {}, options = {}) => {
		const { text, caption, footer = '', headerType = 1, ai, contextInfo = {}, buttons = [], mentions = [], ...media } = content;
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2,
					},
					buttonsMessage: {
						...(media && typeof media === 'object' && Object.keys(media).length > 0 ? await generateWAMessageContent(media, {
							upload: nimesha.waUploadToServer
						}) : {}),
						contentText: text || caption || '',
						footerText: footer,
						buttons,
						headerType: media && Object.keys(media).length > 0 ? Math.max(...Object.keys(media).map((a) => ({ document: 3, image: 4, video: 5, location: 6 })[a] || headerType)) : headerType,
						contextInfo: {
							...contextInfo,
							...options.contextInfo,
							mentionedJid: options.mentions || mentions,
							...(options.quoted ? {
								stanzaId: options.quoted.key.id,
								remoteJid: options.quoted.key.remoteJid,
								participant: options.quoted.key.participant || options.quoted.key.remoteJid,
								fromMe: options.quoted.key.fromMe,
								quotedMessage: options.quoted.message
							} : {})
						}
					}
				}
			}
		}, {});
		const hasil = await nimesha.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [{
				tag: 'biz',
				attrs: {},
				content: [{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [{
						tag: 'native_flow',
						attrs: {
							v: '9',
							name: 'mixed'
						}
					}]
				}]
			}, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
		})
		return hasil
	}
	
	nimesha.newsletterMsg = async (key, content = {}, timeout = 5000) => {
		const { type: rawType = 'INFO', නාමය, description = '', picture = null, react, id, newsletter_id = key, ...media } = content;
		const type = rawType.toUpperCase();
		if (react) {
			if (!(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) throw [{ message: 'කරුණාකර නිවැරදි Newsletter Id එක භාවිතා කරන්න.', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			if (!id) throw [{ message: 'කරුණාකර Newsletter පණිවිඩ Id එක භාවිතා කරන්න.', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const hasil = await nimesha.query({
				tag: 'message',
				attrs: {
					to: key,
					type: 'reaction',
					'server_id': id,
					id: generateMessageID()
				},
				content: [{
					tag: 'reaction',
					attrs: {
						code: react
					}
				}]
			});
			return hasil
		} else if (media && typeof media === 'object' && Object.keys(media).length > 0) {
			const msg = await generateWAMessageContent(media, { upload: nimesha.waUploadToServer });
			const anu = await nimesha.query({
				tag: 'message',
				attrs: { to: newsletter_id, type: 'text' in media ? 'text' : 'media' },
				content: [{
					tag: 'plaintext',
					attrs: /image|video|audio|sticker|poll/.test(Object.keys(media).join('|')) ? { mediatype: Object.keys(media).find(key => ['image', 'video', 'audio', 'sticker','poll'].includes(key)) || null } : {},
					content: proto.Message.encode(msg).finish()
				}]
			})
			return anu
		} else {
			if ((/(FOLLOW|UNFOLLOW|DELETE)/.test(type)) && !(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) return [{ message: 'කරුණාකර නිවැරදි Newsletter Id එක භාවිතා කරන්න.', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const _query = await nimesha.query({
				tag: 'iq',
				attrs: {
					to: 's.whatsapp.net',
					type: 'get',
					xmlns: 'w:mex'
				},
				content: [{
					tag: 'query',
					attrs: {
						query_id: type == 'FOLLOW' ? '9926858900719341' : type == 'UNFOLLOW' ? '7238632346214362' : type == 'CREATE' ? '6234210096708695' : type == 'DELETE' ? '8316537688363079' : '6563316087068696'
					},
					content: new TextEncoder().encode(JSON.stringify({
						variables: /(FOLLOW|UNFOLLOW|DELETE)/.test(type) ? { newsletter_id } : type == 'CREATE' ? { newsletter_input: { නාමය, description, picture }} : { fetch_creation_time: true, fetch_full_image: true, fetch_viewer_metadata: false, input: { key, type: (newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)) ? 'JID' : 'INVITE' }}
					}))
				}]
			}, timeout);
			const res = JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_join_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_leave_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_create || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_delete_v2 || JSON.parse(_query.content[0].content)?.errors || JSON.parse(_query.content[0].content)
			res.thread_metadata ? (res.thread_metadata.host = 'https://mmg.whatsapp.net') : null
			return res
		}
	}
	
	nimesha.sendCarouselMsg = async (jid, body = '', footer = '', cards = [], options = {}) => {
		async function getImageMsg(url) {
			const { imageMessage } = await generateWAMessageContent({ image: { url } }, { upload: nimesha.waUploadToServer });
			return imageMessage;
		}
		const cardPromises = cards.map(async (a) => {
			const imageMessage = await getImageMsg(a.url);
			return {
				header: {
					imageMessage: imageMessage,
					hasMediaAttachment: true
				},
				body: { text: a.body },
				footer: { text: a.footer },
				nativeFlowMessage: {
					buttons: a.buttons.map(b => ({
						name: b.name,
						buttonParamsJson: JSON.stringify(b.buttonParamsJson ? JSON.parse(b.buttonParamsJson) : '')
					}))
				}
			};
		});
		
		const cardResults = await Promise.all(cardPromises);
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: body }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
						carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
							cards: cardResults,
							messageVersion: 1
						})
					})
				}
			}
		}, {});
		const hasil = await nimesha.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
		return hasil
	}
	
	if (nimesha.user && nimesha.user.id) {
		const botNumber = nimesha.decodeJid(nimesha.user.id);
		if (global.db?.set[botNumber]) {
			nimesha.public = global.db.set[botNumber].public
		} else nimesha.public = true
	} else nimesha.public = true

	return nimesha
}

/*
	* Create By Nimesha Madhushan
	* Follow https://github.com/nimesha206
	* Whatsapp : https://whatsapp.com/channel/0029Vb68g1c3LdQLQDkbAQ3M
*/

async function Serialize(nimesha, msg, store) {
	const botLid = nimesha.decodeJid(nimesha.user.lid);
	const botNumber = nimesha.decodeJid(nimesha.user.id);
	const m = { ...msg };
	if (!m) return m
	if (m.key) {
		m.id = m.key.id
		m.chat = m.key.remoteJid
		m.fromMe = m.key.fromMe
		m.isBot = ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.id) || false
		m.isGroup = m.chat.endsWith('@g.us')
		if (!m.isGroup && m.chat.endsWith('@lid')) m.chat = nimesha.findJidByLid(m.chat, store) || m.chat;
		m.sender = nimesha.decodeJid(m.fromMe && (global.owner?.[0] ? global.owner[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : nimesha.user.id) || m.key.participant || m.chat || '')
		// lid format නම් real jid එකට convert කරන්න
		if (m.sender && m.sender.endsWith('@lid')) {
			const realJid = nimesha.findJidByLid(m.sender, store)
			if (realJid && !realJid.endsWith('@lid')) m.sender = realJid
		}
		if (m.isGroup) {
			if (!store.groupMetadata) store.groupMetadata = await nimesha.groupFetchAllParticipating().catch(e => ({}));
			let metadata = store.groupMetadata[m.chat] ? store.groupMetadata[m.chat] : (store.groupMetadata[m.chat] = await nimesha.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] })));
			if (!metadata) {
				metadata = await nimesha.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
				store.groupMetadata[m.chat] = metadata
			}
			m.metadata = metadata
			m.metadata.size = (metadata.participants || []).length;
			if (metadata.addressingMode === 'lid') {
				const participant = metadata.participants.find(a => a.lid === m.sender)
				m.key.participant = m.sender = participant?.id || m.sender;
				m.metadata.owner = m.metadata?.participants?.find(p => p.lid === m.metadata.owner)?.id || m.metadata.owner;
				m.metadata.subjectOwner = m.metadata?.participants?.find(p => p.lid === m.metadata.subjectOwner)?.id || m.metadata.subjectOwner;
				store.contacts[m.sender] = { ...store.contacts[m.sender], id: m.sender, lid: m.fromMe && nimesha.user.lid || participant?.lid || m.sender, name: m.pushName };
			}
			m.admins = m.metadata.participants ? (m.metadata.participants.reduce((a, b) => (b.admin ? a.push({ id: b.id, admin: b.admin }) : [...a]) && a, [])) : []
			m.isAdmin = m.admins?.some((b) => b.id === m.sender) || false
			m.participant = m.key.participant
			m.isBotAdmin = !!m.admins?.find((member) => [botNumber, botLid].includes(member.id)) || false
		}
	}
	if (m.message) {
		m.type = getContentType(m.message) || Object.keys(m.message)[0]
		m.msg = (/viewOnceMessage|viewOnceMessageV2Extension|editedMessage|ephemeralMessage/i.test(m.type) ? m.message[m.type].message[getContentType(m.message[m.type].message)] : (extractMessageContent(m.message[m.type]) || m.message[m.type]))
		m.body = m.message?.conversation || m.msg?.text || m.msg?.conversation || m.msg?.caption || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || ''
		m.mentionedJid = m.msg?.contextInfo?.mentionedJid || []
		m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || '';
		m.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.body) ? m.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : ''
		m.command = m.body && m.body.replace(m.prefix, '').trim().split(/ +/).shift()
		m.args = m.body?.trim().replace(new RegExp("^" + m.prefix?.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, '\\$&'), 'i'), '').replace(m.command, '').split(/ +/).filter(a => a) || []
		m.device = getDevice(m.id)
		m.expiration = m.msg?.contextInfo?.expiration || m?.metadata?.ephemeralDuration || store?.messages?.[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0
		m.timestamp = (typeof m.messageTimestamp === "number" ? m.messageTimestamp : m.messageTimestamp.low ? m.messageTimestamp.low : m.messageTimestamp.high) || m.msg.timestampMs * 1000
		m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath
		if (m.isMedia) {
			m.mime = m.msg?.mimetype
			m.size = m.msg?.fileLength
			m.height = m.msg?.height || ''
			m.width = m.msg?.width || ''
			if (/webp/i.test(m.mime)) {
				m.isAnimated = m.msg?.isAnimated
			}
		}
		m.quoted = m.msg?.contextInfo?.quotedMessage || null
		if (m.quoted) {
			let qMsg = JSON.parse(JSON.stringify(m.msg?.contextInfo?.quotedMessage));
			if (m.msg?.contextInfo?.participant?.endsWith('@lid')) m.msg.contextInfo.participant =  m?.metadata?.participants?.find(a => a.lid === m.msg.contextInfo.participant)?.id || m.msg.contextInfo.participant;
			m.quoted = {
				...qMsg,
				message: extractMessageContent(qMsg) || qMsg,
				type: getContentType(qMsg) || Object.keys(qMsg)[0],
				id: m.msg.contextInfo.stanzaId,
				chat: m.msg.contextInfo.remoteJid || m.chat,
				sender: nimesha.decodeJid(m.msg.contextInfo.participant),
				fromMe: nimesha.decodeJid(m.msg.contextInfo.participant) === nimesha.decodeJid(nimesha.user.id),
				text: qMsg?.conversation || qMsg?.caption || '',
			};
			m.quoted.msg = extractMessageContent(qMsg[m.quoted.type]) || qMsg[m.quoted.type];
			m.quoted.device = getDevice(m.quoted.id)
			m.quoted.isBot = m.quoted.id ? ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.quoted.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.quoted.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.quoted.id) : false
			m.quoted.fromMe = m.quoted.sender === nimesha.decodeJid(nimesha.user.id)
			m.quoted.mentionedJid = m.quoted?.msg?.contextInfo?.mentionedJid || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.getQuotedObj = async () => {
				if (!m.quoted.id) return null
				let q = await global.loadMessage(m.chat, m.quoted.id, nimesha)
				if (q) {
					return await Serialize(nimesha, q, store)
				} else {
					return null
				}
			}
			m.quoted.key = {
				remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
				participant: m.quoted.sender,
				fromMe: areJidsSameUser(nimesha.decodeJid(m.msg?.contextInfo?.participant), nimesha.decodeJid(nimesha?.user?.id)),
				id: m.msg?.contextInfo?.stanzaId
			}
			m.quoted.isGroup = m.quoted.chat.endsWith('@g.us')
			m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.quoted.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.quoted.body) ? m.quoted.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : /[\uD800-\uDBFF][\uDC00-\uDFFF]/gi.test(m.quoted.body) ? m.quoted.body.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gi)[0] : ''
			m.quoted.command = m.quoted.body && m.quoted.body.replace(m.quoted.prefix, '').trim().split(/ +/).shift()
			m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath
			if (m.quoted.isMedia) {
				m.quoted.fileSha256 = m.quoted[m.quoted.type]?.fileSha256 || ''
				m.quoted.mime = m.quoted.msg?.mimetype
				m.quoted.size = m.quoted.msg?.fileLength
				m.quoted.height = m.quoted.msg?.height || ''
				m.quoted.width = m.quoted.msg?.width || ''
				if (/webp/i.test(m.quoted.mime)) {
					m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false
				}
			}
			m.quoted.fakeObj = () => ({
				key: {
					remoteJid: m.quoted.chat,
					fromMe: m.quoted.fromMe,
					id: m.quoted.id
				},
				message: m.quoted,
				...(m.isGroup ? { participant: m.quoted.sender } : {})
			});
			m.quoted.download = () => nimesha.downloadMediaMessage(m.quoted)
			m.quoted.delete = () => {
				nimesha.sendMessage(m.quoted.chat, {
					delete: {
						remoteJid: m.quoted.chat,
						fromMe: m.isBotAdmins ? false : true,
						id: m.quoted.id,
						participant: m.quoted.sender
					}
				})
			}
		}
	}
	
	m.download = () => nimesha.downloadMediaMessage(m)
	
	m.copy = () => Serialize(nimesha, JSON.parse(JSON.stringify(m)), store)
	
	m.react = (u) => nimesha.sendMessage(m.chat, { react: { text: u, key: m.key }})
	
	m.reply = async (content, options = {}) => {
		const footer = '\n\n> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN* _';
		const { quoted = m, chat = m.chat, caption = '', ephemeralExpiration = m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, mentions = (typeof content === 'string' || typeof content.text === 'string' || typeof content.caption === 'string') ? [...(content.text || content.caption || content).matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') : [], ...validate } = options;
		if (typeof content === 'object') {
			// Add footer to text/caption/body fields in object replies
			if (typeof content.text === 'string') content.text = content.text + footer;
			else if (typeof content.caption === 'string') content.caption = content.caption + footer;
			else if (content.contextInfo?.externalAdReply && typeof content.contextInfo.externalAdReply.body === 'string') {
				content.contextInfo.externalAdReply.body = content.contextInfo.externalAdReply.body + footer;
			}
			return nimesha.sendMessage(chat, content, { ...options, quoted, ephemeralExpiration })
		} else if (typeof content === 'string') {
			try {
				if (/^https?:\/\//.test(content)) {
					const data = await axios.get(content, { responseType: 'arraybuffer' });
					const mime = data.headers['content-type'] || (await FileType.fromBuffer(data.data)).mime
					if (/gif|image|video|audio|pdf|stream/i.test(mime)) {
						return nimesha.sendMedia(chat, data.data, '', caption, quoted, content)
					} else {
						return nimesha.sendMessage(chat, { text: content + footer, mentions, ...options }, { quoted, ephemeralExpiration })
					}
				} else {
					return nimesha.sendMessage(chat, { text: content + footer, mentions, ...options }, { quoted, ephemeralExpiration })
				}
			} catch (e) {
				return nimesha.sendMessage(chat, { text: content + footer, mentions, ...options }, { quoted, ephemeralExpiration })
			}
		}
	}

	return m
}

module.exports = {
	GroupUpdate,
	GroupParticipantsUpdate,
	LoadDataBase,
	MessagesUpsert,
	Solving
};

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`යාවත්කාලීන කරන ලදී (Updated): ${__filename}`))
	delete require.cache[file]
	require(file)

});
