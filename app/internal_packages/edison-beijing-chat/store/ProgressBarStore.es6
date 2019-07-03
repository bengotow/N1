import MailspringStore from 'mailspring-store';
class FailMessageStore extends MailspringStore {
  constructor() {
    super();
    this.msg = null;
    this.visible = false;
    return;
  }

  SetMsg(msg) {
    this.msg = msg;
    this.visible = true;
    this.trigger();
  }
  hidez() {
    this.visible = false;
  }
}

module.exports = new FailMessageStore();
