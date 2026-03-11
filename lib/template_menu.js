const fs = require('fs')
const chalk = require('chalk');
const moment = require('moment-timezone');
const { pickRandom } = require('./function');

async function setTemplateMenu(nimesha, type, m, prefix, setv, db, options = {}) {
	const _dayMap = {
  'Sunday':'ඉරිදා','Monday':'සඳුදා','Tuesday':'අඟහරුවාදා',
  'Wednesday':'බදාදා','Thursday':'බ්‍රහස්පතින්දා',
  'Friday':'සිකුරාදා','Saturday':'සෙනසුරාදා'
};
    const hari = _dayMap[moment.tz('Asia/Colombo').format('dddd')] || moment.tz('Asia/Colombo').format('dddd');
    const tanggal = moment.tz('Asia/Colombo').format('DD/MM/YYYY');
    const jam = moment.tz('Asia/Colombo').format('HH:mm:ss');
	const ucapanWaktu = jam < '05:00:00' ? 'සුබ අලුයමක්🌉' : jam < '11:00:00' ? 'සුභ උදෑසනක් 🌄' : jam < '15:00:00' ? 'සුභ දහවලක් 🏙' : jam < '18:00:00' ? 'සුභ සන්ධ්‍යාවක් 🌅' : jam < '19:00:00' ? 'සුභ සන්ධ්‍යාවක් 🌃' : jam < '23:59:00' ? 'සුභ රාත්‍රියක් 🌌' : 'සුභ රාත්‍රියක් 🌌';
	
	let total = Object.entries(db.hit).sort((a, b) => b[1] - a[1]).slice(0, Math.min(7, Object.keys(db.hit).length)).filter(([command]) => command !== 'totalcmd' && command !== 'todaycmd').slice(0, 5);
	
	let text = `╭──❍「 *ඉහලම මෙනුව* 」❍\n`
	
	if (total && total.length >= 5) {
		total.forEach(([command, hit], index) => {
			text += `│${setv} ${prefix}${command}: ${hit} hits\n`
		})
		text += '╰──────❍'
	} else text += `│${setv} ${prefix}ai
│${setv} ${prefix}brat
│${setv} ${prefix}tiktok
│${setv} ${prefix}cekmati
│${setv} ${prefix}susunkata
╰──────❍`

	if (type == 1 || type == 'buttonMessage') {
		await nimesha.sendButtonMsg(m.chat, {
			text: `හලෝ @${m.sender.split('@')[0]}\n` + text,
			footer: ucapanWaktu,
			mentions: [m.sender],
			contextInfo: {
				forwardingScore: 10,
				isForwarded: true,
			},
			buttons: [{
				buttonId: `${prefix}allmenu`,
				buttonText: { displayText: 'All Menu' },
				type: 1
			},{
				buttonId: `${prefix}sc`,
				buttonText: { displayText: 'SC' },
				type: 1
			}]
		}, { quoted: m })
	} else if (type == 2 || type == 'listMessage') {
		await nimesha.sendButtonMsg(m.chat, {
			text: `හලො @${m.sender.split('@')[0]}\n` + text,
			footer: ucapanWaktu,
			mentions: [m.sender],
			contextInfo: {
				forwardingScore: 10,
				isForwarded: true,
			},
			buttons: [{
				buttonId: `${prefix}allmenu`,
				buttonText: { displayText: 'All Menu' },
				type: 1
			},{
				buttonId: `${prefix}sc`,
				buttonText: { displayText: 'SC' },
				type: 1
			}, {
				buttonId: 'list_button',
				buttonText: { displayText: 'list' },
				nativeFlowInfo: {
					name: 'single_select',
					paramsJson: JSON.stringify({
						title: 'List Menu',
						sections: [{
							title: 'List Menu',
							rows: [{
								title: 'All Menu',
								id: `${prefix}allmenu`
							},{
								title: 'Bot Menu',
								id: `${prefix}botmenu`
							},{
								title: 'Group Menu',
								id: `${prefix}groupmenu`
							},{
								title: 'Search Menu',
								id: `${prefix}searchmenu`
							},{
								title: 'Download Menu',
								id: `${prefix}downloadmenu`
							},{
								title: 'Quotes Menu',
								id: `${prefix}quotesmenu`
							},{
								title: 'Tools Menu',
								id: `${prefix}toolsmenu`
							},{
								title: 'Ai Menu',
								id: `${prefix}aimenu`
							},{
								title: 'Stalker Menu',
								id: `${prefix}stalkermenu`
							},{
								title: 'Random Menu',
								id: `${prefix}randommenu`
							},{
								title: 'Anime Menu',
								id: `${prefix}animemenu`
							},{
								title: 'Game Menu',
								id: `${prefix}gamemenu`
							},{
								title: 'Fun Menu',
								id: `${prefix}funmenu`
							},{
								title: 'Owner Menu',
								id: `${prefix}ownermenu`
							}]
						}]
					})
				},
				type: 2
			}]
		}, { quoted: m })
	} else if (type == 3 || type == 'documentMessage') {
		let profile
		try {
			profile = await nimesha.profilePictureUrl(m.sender, 'image');
		} catch (e) {
			profile = fake.anonim
		}
		const menunya = `
╭──❍「 *පරිශීලක තොරතුරු* 」❍
├ *නම* : ${m.pushName ? m.pushName : 'නමක් නැත'}
├ *හැඳුනුම් පත* : @${m.sender.split('@')[0]}
├ *පරිශීලක* : ${options.isVip ? 'VIP' : options.isPremium ? 'ප්‍රිමියම්' : 'නොමිලේ'}
├ *සීමාව* : ${options.isVip ? 'VIP' : db.users[m.sender].limit }
├ *මුදල්* : ${db.users[m.sender] ? db.users[m.sender].money.toLocaleString('id-ID') : '0'}
╰─┬────❍
╭─┴─❍「 *බොට් තොරතුරු* 」❍
├ *බොට්* : ${db?.set?.[options.botNumber]?.botname || 'Miss Shasikala'}
├ *බලගැන්වූ* : @${'0@s.whatsapp.net'.split('@')[0]}
├ *හිමිකරු* : @${owner[0].split('@')[0]}
├ *ප්‍රකරය* : ${nimesha.public ? 'පොදු' : 'ස්වයං'}
├ *උපසර්ගය* :${db.set[options.botNumber].multiprefix ? '「 බහු - උපසර්ග 」' : ' *'+prefix+'*' }
╰─┬────❍
╭─┴─❍「 *මෙ පිළිබඳ* 」❍
├ *දිනය* : ${tanggal}
├ *දවස* : ${hari}
├ *වෙලාව* : ${jam} WIB
╰──────❍\n`
		await m.reply({
			document: fake.docs,
			fileName: ucapanWaktu,
			mimetype: pickRandom(fake.listfakedocs),
			fileLength: '100000000000000',
			pageCount: '999',
			caption: menunya + text,
			contextInfo: {
				mentionedJid: [m.sender, '0@s.whatsapp.net', owner[0] + '@s.whatsapp.net'],
				forwardingScore: 10,
				isForwarded: true,
				forwardedNewsletterMessageInfo: {
					newsletterJid: my.ch,
					serverMessageId: null,
					newsletterName: 'Miss Shasikala'
				},
				externalAdReply: {
					title: options.author,
					body: options.packname,
					showAdAttribution: false,
					thumbnailUrl: profile,
					mediaType: 1,
					previewType: 0,
					renderLargerThumbnail: true,
					mediaUrl: my.gh,
					sourceUrl: my.gh,
				}
			}
		})
	} else if (type == 4 || type == 'videoMessage') {
		//tambahin sendiri :v
	} else {
		m.reply(`${ucapanWaktu} @${m.sender.split('@')[0]}\nසියළුම මෙනු බැලීමට ${prefix}allmenu\nභාවිතා කරන්න`)
	}
}

module.exports = setTemplateMenu;

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update ${__filename}`))
	delete require.cache[file]
	require(file)
});