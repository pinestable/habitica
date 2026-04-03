// Stubbed - mongoose/MongoDB removed
export const schema = { paths: {} };

export const model = {
  beginUserHistoryUpdate (userID, headers = null) {
    return {
      userId: userID,
      data: {
        headers: headers || {},
        armoire: [],
        questInviteResponses: [],
        cron: [],
      },
      withArmoire () { return this; },
      withQuestInviteResponse () { return this; },
      withCron () { return this; },
      async commit () { /* no-op */ }, // eslint-disable-line no-empty-function
    };
  },
};
