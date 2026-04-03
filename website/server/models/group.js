// Stub: group/party/guild model removed — pass-through stubs for import compatibility.
// All group-related features (parties, guilds, challenges) have been stripped.

export const TAVERN_ID = '00000000-0000-4000-A000-000000000000';
export const INVITES_LIMIT = 100;
export const PARTY_PENDING_LIMIT = 10;
export const SPAM_MESSAGE_LIMIT = 2;
export const SPAM_WINDOW_LENGTH = 60000;
export const SPAM_MIN_EXEMPT_CONTRIB_LEVEL = 4;
export const MAX_CHAT_COUNT = 400;
export const MAX_SUBBED_GROUP_CHAT_COUNT = 400;
export const basicFields = 'name type privacy leader summary categories';
export const VALID_QUERY_TYPES = ['party', 'guilds', 'privateGuilds', 'tavern'];
export const tavernQuest = {};
export const schema = { paths: {} };

function makeQuery (result) {
  const q = {
    exec: async () => result,
    lean: () => q,
    select: () => q,
    sort: () => q,
    limit: () => q,
    skip: () => q,
    populate: () => q,
  };
  return q;
}

const groupModel = {
  getGroup: async () => null,
  getGroups: async () => [],
  findById: () => makeQuery(null),
  findOne: () => makeQuery(null),
  find: () => makeQuery([]),
  findByIdAndUpdate: async () => null,
  updateMany: async () => ({}),
  updateOne: async () => ({}),
  deleteOne: async () => ({}),
  create: async () => null,
  insertMany: async () => [],
  countDocuments: async () => 0,
};

export const model = groupModel;
