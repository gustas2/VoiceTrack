const Discord = require('discord.js');
const bot = new Discord.Client();
const sqlite3 = require('sqlite3').verbose();

require('dotenv').config();

const token = process.env.Token;

const prefix = '!';
const db_name = 'leaderboard.db';

let servers = [];

bot.login(token);

bot.on('ready', () => {
  console.log('This bot is online!');
});

bot.on('message', message => {
  if (message.content[0] === prefix) {
    let args = message.content.substring(prefix.length).split(' ');
    switch (args[0]) {
      case 'lb':
        showLeaderboard(message, args[1]);
        break;

      case 'me':
        showPersonalStats(message);
        break;
      case 'help':
        showCommands(message.channel);
        break;
    }
  }
});

bot.on('voiceStateUpdate', (oldMember, newMember) => {
  let oldUserChannel = oldMember.channelID;
  let newUserChannel = newMember.channelID;

  if (
    (oldUserChannel === undefined || oldUserChannel === null) &&
    newUserChannel !== undefined &&
    newUserChannel !== null
  ) {
    // User Joins a voice channel
    console.log('joined');
    if (!servers[newUserChannel]) servers[newUserChannel] = {};
    servers[newUserChannel][newMember.id] = new Date().getTime();
  } else if (newUserChannel === undefined || newUserChannel === null) {
    // User leaves a voice channel
    if (servers[oldUserChannel][newMember.id]) {
      let startTime = servers[oldUserChannel][newMember.id];
      updateDB(newMember.id, startTime, newMember.member.user.username);
    }
  }
});

function showLeaderboard(message, lbIndex = 1) {
  lbIndex = parseInt(lbIndex);
  let description = '';
  let db = new sqlite3.Database(db_name);
  let sql = `SELECT * FROM leaderboard`;
  db.all(sql, (err, rows) => {
    if (err) {
      throw err;
    }
    const [members, next] = top10(rows, lbIndex);
    let footer = next
      ? `Type !lb ${lbIndex + 1} to see placements ${lbIndex * 10 + 1}-${
          lbIndex * 10 + 10
        }`
      : '';
    members.forEach(member => {
      let time = parseInt(member.time / 60000);
      time = time >= 60 ? parseInt(time / 60) + 'h' : time + 'min';
      let place = `\`\`${member.place + 1}\`\` `;
      description += `${place}${member.tag} ${time}\n`;
    });
    const lb = new Discord.MessageEmbed()
      .setTitle('📜 Server Leaderboard')
      .setDescription(description)
      .setFooter(footer);
    message.channel.send(lb);
  });
  db.close();
}

function showPersonalStats(message) {
  const member = message.author;
  let db = new sqlite3.Database(db_name);
  let sql = `SELECT * FROM leaderboard`;
  db.all(sql, (err, rows) => {
    if (err) {
      throw err;
    }
    let time;
    let place;
    const members = rows.sort((a, b) => b.time - a.time);
    for (let n = 0; n < members.length; n++) {
      if (members[n].id === parseInt(member.id)) {
        place = n + 1;
        time = parseInt(members[n].time / 60000);
        time = time >= 60 ? parseInt(time / 60) + 'h' : time + 'min';
        break;
      }
    }
    if (place) {
      const lb = new Discord.MessageEmbed()
        .setTitle('📜 Personal Stats')
        .setDescription(
          `**User**: \`\`${
            member.tag
          }\`\`\n\n**Total time**: \`\`${time}\`\`\n\n**Place**: \`\`${toOrdinal(
            place
          )}\`\``
        )
        .setThumbnail(member.avatarURL());
      message.channel.send(lb);
    } else {
      const embed = new Discord.MessageEmbed()
        .setTitle("You don't have time in a voice call")
        .setDescription('Join a voice call get some');
      message.channel.send(embed);
    }
  });
  db.close();
}

function showCommands(channel) {
  const embed = new Discord.MessageEmbed().setTitle('Commands:')
    .setDescription(`\`\`!lb\`\` - server leaderboard
    \`\`!me\`\` - personal stats`);
  channel.send(embed);
}

function updateDB(id, startTime, tag) {
  let db = new sqlite3.Database(db_name);

  let time = new Date().getTime() - startTime;
  let sql = `SELECT time FROM leaderboard WHERE id = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    if (!row) {
      let sql = `INSERT INTO leaderboard VALUES(?, ?, ?)`;
      db.run(sql, [id, tag, time], (err, row) => {
        if (err) {
          return console.error(err.message);
        }
      });
    } else {
      let sql = `UPDATE leaderboard SET tag = ?, time = ? WHERE id = ?`;
      db.run(sql, [tag, time + row.time, id], (err, row) => {
        if (err) {
          return console.error(err.message);
        }
      });
    }
    console.log(row);
  });

  db.close();
}

function top10(rows, lbIndex) {
  let fromIndex = lbIndex * 10 - 10;
  let toIndex = lbIndex * 10;
  rows = rows.sort((a, b) => b.time - a.time);
  let next = rows[toIndex + 1] ? true : false;
  let members = [];
  for (let n = fromIndex; n < rows.length && n < toIndex; n++) {
    members.push({ tag: rows[n].tag, time: rows[n].time, place: n });
  }
  return [members, next];
}

function toOrdinal(n) {
  var s = ['th', 'st', 'nd', 'rd'],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
