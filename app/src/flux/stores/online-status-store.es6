import MailspringStore from 'mailspring-store';
import { ExponentialBackoffScheduler } from '../../backoff-schedulers';
import Actions from '../actions';
import DatabaseStore from './database-store';
import Message from '../models/message';
import ThreadCounts from '../models/thread-counts';
import Folder from '../models/folder';
import Label from '../models/label';

let isOnlineModule = null;

const CHECK_ONLINE_INTERVAL = 30 * 1000;

class OnlineStatusStore extends MailspringStore {
  constructor() {
    super();
    this._online = true;
    this._countdownSeconds = 0;

    this._interval = null;
    this._timeout = null;
    this._timeoutTargetTime = null;
    this._backoffScheduler = new ExponentialBackoffScheduler({ jitter: false });

    if (AppEnv.isMainWindow()) {
      Actions.checkOnlineStatus.listen(this._checkOnlineStatus);
      setTimeout(this._checkOnlineStatus, 3 * 1000); // initial check
    }
    this._interestedClasses = [Message.name, ThreadCounts.name, Folder.name, Label.name];

  }

  _onDataChange(change) {
    if (this._interestedClasses.includes(change.objectClass)) {
      this._online = true;
      this._backoffScheduler.reset();
      this._timeoutTargetTime = Date.now() + CHECK_ONLINE_INTERVAL;
      this._timeout = setTimeout(this._checkOnlineStatus, CHECK_ONLINE_INTERVAL);
      this.trigger({
        onlineDidChange: true,
        wakingFromSleep: false,
        countdownDidChange: false,
      });
      this.stopListeningTo(DatabaseStore);
    }
  }

  isOnline() {
    return this._online;
  }

  retryingInSeconds() {
    return this._countdownSeconds;
  }

  _checkOnlineStatus = async () => {
    isOnlineModule = isOnlineModule || require('is-online'); //eslint-disable-line
    clearInterval(this._interval);
    clearTimeout(this._timeout);

    // If we're more than a minute "late", we probably went to sleep
    // and are now waking.
    const wakingFromSleep =
      this._timeoutTargetTime && Date.now() > this._timeoutTargetTime + 1000 * 60;
    this._timeoutTargetTime = null;

    // If we are currently offline, this trigger will show `Retrying now...`
    if (this._countdownSeconds > 0) {
      this._countdownSeconds = 0;
      this.trigger({
        onlineDidChange: false,
        wakingFromSleep: false,
        countdownDidChange: true,
      });
    }

    const nextIsOnline = await isOnlineModule({ timeout: 10000 });
    const onlineDidChange = this._online !== nextIsOnline;
    this._online = nextIsOnline;

    if (wakingFromSleep || onlineDidChange) {
      this.trigger({
        onlineDidChange,
        wakingFromSleep,
        countdownDidChange: false,
      });
    }

    if (this._online) {
      // just check again later
      this.stopListeningTo(DatabaseStore);
      this._backoffScheduler.reset();
      this._timeoutTargetTime = Date.now() + CHECK_ONLINE_INTERVAL;
      this._timeout = setTimeout(this._checkOnlineStatus, CHECK_ONLINE_INTERVAL);
    } else {
      this.listenTo(DatabaseStore, this._onDataChange);
      // count down an inreasing delay and check again
      this._countdownSeconds = Math.ceil(this._backoffScheduler.nextDelay() / 1000);
      clearInterval(this._interval);
      this._interval = setInterval(() => {
        const next = Math.max(0, this._countdownSeconds - 1);
        if (next === 0) {
          return this._checkOnlineStatus();
        }

        this._countdownSeconds = next;
        // if the countdown is greater than 10 seconds we only update every 5
        // seconds just for a tiny, tiny offline performance improvement
        // 45, 30, 15, 10, 9, 8, 7...
        if (this._countdownSeconds > 30 && this._countdownSeconds % 15 !== 0) {
          return;
        }
        if (this._countdownSeconds > 10 && this._countdownSeconds % 5 !== 0) {
          return;
        }
        this.trigger({
          onlineDidChange: false,
          wakingFromSleep: false,
          countdownDidChange: true,
        });
      }, 1000);
    }
  };
}

export default new OnlineStatusStore();
