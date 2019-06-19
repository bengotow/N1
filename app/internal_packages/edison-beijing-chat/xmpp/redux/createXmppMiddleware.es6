import { Xmpp } from '..';
import { ChatActions, MessageStore, OnlineUserStore, ConversationStore, RoomStore } from 'chat-exports';

/**
 * Creates a middleware for the XMPP class to dispatch actions to a redux store whenever any events
 * are received
 * @param   {Xmpp}    xmpp            An instance of the Xmpp class
 * @param   {Object}  eventActionMap  An object with keys being the string value of the xmpp event
 *                                    and values being functions that return redux actions
 * @throws  {Error}                   Throws an error if xmpp is not an instance of Xmpp
 * @returns {Middleware}              The redux middleware function
 */
export const createXmppMiddleware = (xmpp, eventActionMap) => store => {
  if (!(xmpp instanceof Xmpp)) {
    throw Error('xmpp must be an instance of Xmpp');
  }
  if (typeof eventActionMap !== 'object') {
    throw Error('eventActionMap must be an object');
  }

  const map = eventActionMap; // Ensure map is not modified while iterating over keys
  if (map) {
    Object.entries(map)
      .forEach(([eventname, action]) => xmpp.on(eventname, data => {
        if (action) {
          store.dispatch(action(data));
        }
      }));
  }
  let saveLastTs = (data) => {
    let jidLocal = data.curJid.split('@')[0];
    let ts = AppEnv.config.get(jidLocal + "_message_ts");
    const msgTs = parseInt(data.ts)
    if (ts < msgTs) {
      AppEnv.config.set(jidLocal + '_message_ts', msgTs);
    }
  }
  // receive group chat
  xmpp.on('groupchat', data => {
    saveLastTs(data);
    MessageStore.reveiveGroupChat(data);

  })
  // receive private chat
  xmpp.on('chat', data => {
    saveLastTs(data);
    MessageStore.reveivePrivateChat(data);
  })
  // user online
  xmpp.on('available', data => {
    OnlineUserStore.addOnlineUser(data);
    ChatActions.userOnlineStatusChanged(data.from.bare);
  })
  // user online
  xmpp.on('unavailable', data => {
    OnlineUserStore.removeOnlineUser(data);
    ChatActions.userOnlineStatusChanged(data.from.bare);
  })
  // Chat account online
  xmpp.on('session:started', data => {
    OnlineUserStore.addOnLineAccount(data);
  })
  // Chat account offline
  xmpp.on('disconnected', data => {
    OnlineUserStore.removeOnLineAccount(data);
  })

  // change conversation name
  xmpp.on('edimucconfig', data => {
    ConversationStore.saveConversationName(data);
  });

  //member join / quit
  xmpp.on('memberschange', data => {
    RoomStore.onMembersChange(data);
  });

  xmpp.on('message:error', async data => {
    console.log(' xmpp.on message:error: ', data);
    if (data.error && data.error.code == 403 && data.id) {
      let msgInDb = await MessageStore.getMessageById(data.id+'$'+data.from.bare);
      console.log(' xmpp.on message:error: msgInDb: ', msgInDb);
      if (!msgInDb) {
        return;
      }
      const msg = msgInDb.get({plain:true});
      console.log(' xmpp.on message:error: msg: ', msg);
      let body = msg.body;
      body = JSON.parse(body);
      body.content = 'You can not send message to this conversation';
      body.type = 'error403';
      body = JSON.stringify(body);
      msg.body = body;
      MessageStore.saveMessagesAndRefresh([msg])
    }
  });
  xmpp.on('message:success', async data => {
    console.log( 'message:success data: ', data);
    let msgInDb = await MessageStore.getMessageById(data.$received.id+'$'+data.from.bare);
    console.log( 'xmpp.on message:success: msgInDb: ', msgInDb);
    if (!msgInDb) {
      console.log( 'something wrong with message:success data: ', data);
      return;
    }
    const msg = msgInDb.get({plain:true});
    console.log( 'xmpp.on message:success: msg: ', msg);
    msg.status = 'MESSAGE_STATUS_DELIVERED';
    MessageStore.saveMessagesAndRefresh([msg]);

  });

  return next => action => next(action);
};

export default createXmppMiddleware;