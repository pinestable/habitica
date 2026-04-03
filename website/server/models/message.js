// Stubbed - mongoose/MongoDB removed
import { v4 as uuid } from 'uuid';
import { defaults } from 'lodash';
import removeMd from 'remove-markdown';
import shared from '../../common';

export const chatModel = null;
export const inboxModel = null;

export function setUserStyles (newMessage, user) {
  const userStyles = {};
  userStyles.items = { gear: {} };

  let userCopy = user;
  if (user.toObject) userCopy = user.toObject();

  if (userCopy.items) {
    userStyles.items.gear = {};
    if (userCopy.preferences && userCopy.preferences.costume) {
      userStyles.items.gear.costume = { ...userCopy.items.gear.costume };
    } else {
      userStyles.items.gear.equipped = { ...userCopy.items.gear.equipped };
    }

    userStyles.items.currentMount = userCopy.items.currentMount;
    userStyles.items.currentPet = userCopy.items.currentPet;
  }

  if (userCopy.preferences) {
    userStyles.preferences = {};
    if (userCopy.preferences.style) userStyles.preferences.style = userCopy.preferences.style;
    userStyles.preferences.hair = userCopy.preferences.hair;
    userStyles.preferences.skin = userCopy.preferences.skin;
    userStyles.preferences.shirt = userCopy.preferences.shirt;
    userStyles.preferences.chair = userCopy.preferences.chair;
    userStyles.preferences.size = userCopy.preferences.size;
    userStyles.preferences.chair = userCopy.preferences.chair;
    userStyles.preferences.background = userCopy.preferences.background;
    userStyles.preferences.costume = userCopy.preferences.costume;
  }

  if (userCopy.stats) {
    userStyles.stats = {};
    userStyles.stats.class = userCopy.stats.class;
    if (userCopy.stats.buffs) {
      userStyles.stats.buffs = {
        seafoam: userCopy.stats.buffs.seafoam,
        shinySeed: userCopy.stats.buffs.shinySeed,
        spookySparkles: userCopy.stats.buffs.spookySparkles,
        snowball: userCopy.stats.buffs.snowball,
      };
    }
  }

  let contributorCopy = user.contributor;
  if (contributorCopy && contributorCopy.toObject) {
    contributorCopy = contributorCopy.toObject();
  }

  newMessage.contributor = contributorCopy;
  newMessage.userStyles = userStyles;

  if (newMessage.markModified) {
    newMessage.markModified('userStyles contributor');
  }
}

export function sanitizeText (msg) {
  return msg.substring(0, shared.constants.MAX_MESSAGE_LENGTH);
}

export function messageDefaults (msg, user, client, flagCount = 0, info = {}) {
  const id = uuid();
  const message = {
    id,
    _id: id,
    text: msg,
    unformattedText: removeMd(msg),
    info,
    timestamp: Number(new Date()),
    likes: {},
    flags: {},
    flagCount,
    client,
  };

  if (user) {
    defaults(message, {
      uuid: user._id,
      contributor: user.contributor && user.contributor.toObject
        ? user.contributor.toObject() : user.contributor,
      backer: user.backer && user.backer.toObject
        ? user.backer.toObject() : user.backer,
      user: user.profile.name,
      username: user.flags && user.flags.verifiedUsername
        && user.auth && user.auth.local && user.auth.local.username,
    });
  } else {
    message.uuid = 'system';
  }

  return message;
}

export function mapInboxMessage (msg, user) {
  if (msg.sent) {
    msg.toUUID = msg.uuid;
    msg.toUser = msg.user;
    msg.toUserName = msg.username;
    msg.toUserContributor = msg.contributor;
    msg.toUserBacker = msg.backer;
    msg.uuid = user._id;
    msg.user = user.profile.name;
    msg.username = user.auth.local.username;
    msg.contributor = user.contributor;
    msg.backer = user.backer;
  }

  return msg;
}
