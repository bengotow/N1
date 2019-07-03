import MailspringStore from 'mailspring-store';
import _ from 'underscore';
import { log } from '../utils/log-util';

class OnlineUserStore extends MailspringStore {
  constructor() {
    super();
    this.authingAccounts = {};
    this.onlineUsers = {};
    this.onlineAccounts = {};
    this.allSelfAccounts = {};
    this._triggerDebounced = _.debounce(() => this.trigger(), 20);
  }

  addSelfAccount(jid, account) {
    this.allSelfAccounts[jid] = account;
  }

  getSelfAccountById(jid) {
    return this.allSelfAccounts[jid];
  }

  addOnlineUser(payload) {
    this.onlineUsers[payload.from.bare] = 1;
    this._triggerDebounced();
  }

  removeOnlineUser(payload) {
    this.onlineUsers[payload.from.bare] = 0;
    this._triggerDebounced();
  }

  addOnLineAccount(payload) {
    const jid = payload.from && payload.from.bare || payload.bare;
    this.onlineAccounts[jid] = 1;
    log(`addOnLineAccount: ${jid}, onlineAccounts: ${JSON.stringify(this.onlineAccounts)}`);
    this.authingAccounts[jid] = 0;
    this._triggerDebounced();
  }

  addAuthingAccount(jid) {
    this.authingAccounts[jid] = 1;
    log(`addAuthingAccount: ${jid}, authingAccounts: ${JSON.stringify(this.authingAccounts)}`);
    this._triggerDebounced();
  }

  removeAuthingAccount(jid) {
    this.authingAccounts[jid] = 0;
    log(`removeAuthingAccount: ${jid}, authingAccounts: ${JSON.stringify(this.authingAccounts)}`);
    this._triggerDebounced();
  }

  removeOnLineAccount(payload) {
    if (!payload) {
      const error = new Error();
      log(`removeOnLineAccount: payload is null: ${error.stack}`);
      console.log(`removeOnLineAccount: payload is null: ${error.stack}`, );
      return;
    }
    const jid = payload.curJid;
    this.onlineAccounts[jid] = 0;
    this.authingAccounts = {};
    log(`removeOnLineAccount: ${jid}, onlineAccounts: ${JSON.stringify(this.onlineAccounts)}`);
    this.resetOnlineUsers();
    this._triggerDebounced();
  }

  resetOnlineUsers() {
    this.onlineUsers = {};
    this._triggerDebounced();
  }

  isUserOnline(jid) {
    return this.onlineUsers[jid];
  }
}

module.exports = new OnlineUserStore();
