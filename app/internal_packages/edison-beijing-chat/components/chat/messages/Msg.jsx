import fs from 'fs';
import path from 'path';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
const a11yEmoji = require('a11y-emoji');
import { colorForString } from '../../../utils/colors';
import { dateFormat } from '../../../utils/time';
import { RetinaImg } from 'mailspring-component-kit';
const { AttachmentStore } = require('mailspring-exports');

import { remote, shell } from 'electron';
const { dialog, Menu, MenuItem } = remote;
import { isJsonStr } from '../../../utils/stringUtils';
import ContactAvatar from '../../common/ContactAvatar';
import MessageEditBar from './MessageEditBar';
import MessageApp from './MessageApp';
import MessagePrivateApp from './MessagePrivateApp';
import { ChatActions } from 'chat-exports';
import { FILE_TYPE } from '../../../utils/filetypes';
import { MessageModel, MessageSend } from 'chat-exports';
import { name } from '../../../utils/name';

export default class Msg extends PureComponent {
  static propTypes = {
    msg: PropTypes.shape({
      id: PropTypes.string.isRequired,
      conversationJid: PropTypes.string.isRequired,
      sender: PropTypes.string.isRequired,
      body: PropTypes.string.isRequired,
      sentTime: PropTypes.number.isRequired,
      status: PropTypes.string.isRequired,
    }).isRequired,
    conversation: PropTypes.shape({
      jid: PropTypes.string.isRequired,
      isGroup: PropTypes.bool.isRequired,
    }),
  };

  constructor(props) {
    super(props);
    this.state = this.receiveProps(props);
  }

  receiveProps = props => {
    const { msg, conversation } = props;
    const msgBody = isJsonStr(msg.body) ? JSON.parse(msg.body) : msg.body;
    const currentUserJid = conversation.curJid;
    if (typeof msgBody !== 'string') {
      if (msg.sender === currentUserJid) {
        msgBody.path = msgBody.localFile || msgBody.path;
      } else {
        msgBody.path = msgBody.path || msgBody.localFile;
      }
    }
    const msgImgPath = msgBody.path;
    return {
      msgBody,
      msgImgPath,
      currentUserJid,
    };
  };

  componentWillReceiveProps = nextProps => {
    const newState = this.receiveProps(nextProps);
    this.setState(newState, () => {
      // if has span tag, that's no need to run emoji process
      if (this.contentEl && this.contentEl.innerHTML.indexOf('<span role="img"') === -1) {
        this.contentEl.innerHTML = a11yEmoji(this.contentEl.innerHTML);
      }
    });
  };

  isImage = type => {
    return type === FILE_TYPE.IMAGE || type === FILE_TYPE.GIF || type === FILE_TYPE.STICKER;
  };

  shouldInlineImg = () => {
    const { msgBody } = this.state;
    let path = msgBody.path;
    return (
      this.isImage(msgBody.type) &&
      ((path && path.match(/^https?:\/\//)) || fs.existsSync(path && path.replace('file://', '')))
    );
  };

  shouldDisplayFileIcon = () => {
    const { msgBody } = this.state;
    return (
      msgBody.mediaObjectId && msgBody.type == FILE_TYPE.OTHER_FILE && !this.isImage(msgBody.type)
    );
  };

  static timer;

  componentDidMount() {
    this.unlisten = ChatActions.updateDownload.listen(this.update, this);
    if (this.contentEl) {
      this.contentEl.innerHTML = a11yEmoji(this.contentEl.innerHTML);
    }
  }

  deleteMessage = () => {
    const { msg, conversation } = this.props;
    const body = this.state.msgBody;
    body.updating = true;
    body.deleted = true;
    MessageSend.sendMessage(body, conversation, msg.id);
    MessageModel.destroy({ where: { id: msg.id, conversationJid: conversation.jid } });
  };

  componentWillUnmount() {
    this.unlisten();
  }

  getContactInfoByJid = jid => {
    return this.props.getContactInfoByJid(jid);
  };

  getContactAvatar = member => {
    const { conversation } = this.props;
    if (member) {
      const memberJid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
      return (
        <ContactAvatar
          jid={memberJid}
          name={member.name}
          conversation={conversation}
          email={member.email}
          avatar={member.avatar}
          size={32}
        />
      );
    }
    return null;
  };

  openFile(filePath) {
    shell.openItem(filePath);
  }

  onKeyDown = event => {
    let keyCode = event.keyCode;
    if (keyCode === 27) {
      // ESC
      event.stopPropagation();
      event.preventDefault();
      this.cancelEdit();
    }
  };
  cancelEdit = () => {
    this.setState({
      isEditing: false,
    });
  };
  update(imgId) {
    const { mediaObjectId, thumbObjectId } = this.state.msgBody;
    if (imgId === mediaObjectId || imgId === thumbObjectId) {
      this.setState({ imgId });
    }
  }
  download = () => {
    const msgBody = this.state.msgBody;
    event.stopPropagation();
    event.preventDefault();
    const fileName = msgBody.path ? path.basename(msgBody.path) : '';
    let pathForSave = dialog.showSaveDialog({ title: `download file`, defaultPath: fileName });
    if (!pathForSave || typeof pathForSave !== 'string') {
      return;
    }
    const loadConfig = {
      msgBody,
      filepath: pathForSave,
      type: 'download',
    };
    const { queueLoadMessage } = this.props;
    queueLoadMessage(loadConfig);
  };

  showPopupMenu = isFile => {
    event.stopPropagation();
    event.preventDefault();
    this.menu = new Menu();
    let menuItem;
    if (!isFile) {
      menuItem = new MenuItem({
        label: 'Edit text',
        click: () => {
          const state = Object.assign({}, this.state, { isEditing: true });
          this.setState(state);
          this.menu.closePopup();
        },
      });
      this.menu.append(menuItem);
    }
    menuItem = new MenuItem({
      label: 'Delete message',
      click: () => {
        this.deleteMessage();
        this.menu.closePopup();
      },
    });
    this.menu.append(menuItem);
    this.menu.popup({ x: event.clientX, y: event.clientY });
  };

  messageToolbar = (msg, msgBody, isFile) => {
    const { currentUserJid } = this.state;
    const isSystemEvent = ['error403', 'memberschange', 'change-group-name'].includes(msgBody.type);

    return (
      <div className="message-toolbar">
        {isFile && (
          <span className="download-img" title={msgBody.path} onClick={() => this.download()}>
            <RetinaImg
              name={'download.svg'}
              style={{ width: 24, height: 24 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </span>
        )}
        {msg.sender === currentUserJid && !isSystemEvent && (
          <span
            className="inplace-edit-img"
            onClick={() => this.showPopupMenu(isFile)}
            onContextMenu={() => this.showPopupMenu(isFile)}
          >
            <RetinaImg
              name={'expand-more.svg'}
              style={{ width: 26, height: 26 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </span>
        )}
      </div>
    );
  };
  getMessageClasses = () => {
    const { currentUserJid } = this.state;
    const { msg } = this.props;
    const messageStyles = ['message'];
    if (msg.sender === currentUserJid) {
      messageStyles.push('currentUser');
    } else {
      messageStyles.push('otherUser');
    }
    return messageStyles.join(' ');
  };
  isUnreadUpdatedMessage = () => {
    const { msg } = this.props;
    if (!msg.updateTime) {
      return false;
    } else {
      const readTime = msg.readTime || 0;
      return readTime < msg.updateTime;
    }
  };
  onClickImage = e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.src) {
      this._previewAttachment(decodeURI(e.target.src).replace('file://', ''));
    }
  };
  _previewAttachment(filePath) {
    const currentWin = AppEnv.getCurrentWindow();
    currentWin.previewFile(filePath);
  }
  msgFile = () => {
    const { msg } = this.props;
    const { msgBody } = this.state;

    if (this.shouldInlineImg()) {
      return (
        <div className="message-image">
          <img
            src={msgBody.path}
            onError={e => {
              e.target.src = '../static/images/chat/image-not-found.png'
            }}
            onClick={this.onClickImage}
          />
          {this.messageToolbar(msg, msgBody, true)}
        </div>
      );
    } else if (this.shouldDisplayFileIcon()) {
      const fileName = msgBody.path ? path.basename(msgBody.path) : '';
      let extName = path.extname(msgBody.path || 'x.doc').slice(1);
      let iconName = '';
      if (msgBody.path) {
        iconName = AttachmentStore.getExtIconName(msgBody.path);
      }
      return (
        <div className="message-file">
          <div className="file-info" onDoubleClick={() => this.openFile(msgBody.path)}>
            <div className="file-icon">
              <RetinaImg name={iconName} isIcon mode={RetinaImg.Mode.ContentIsMask} />
            </div>
            <div>
              <div className="file-name">{fileName}</div>
              <div className="ext">{extName.toUpperCase()}</div>
            </div>
          </div>
          {this.messageToolbar(msg, msgBody, true)}
        </div>
      );
    } else {
      return null;
    }
  };

  senderContact = () => {
    const { msg } = this.props;
    return this.getContactInfoByJid(msg.sender);
  };

  senderName = () => {
    const { msg } = this.props;
    const member = this.senderContact();
    return name(msg.sender) || member.name;
  };

  retrySend = () => {
    const { msg, conversation } = this.props;
    const { msgBody } = this.state;
    if (msgBody.localFile && !msgBody.uploadFailed) {
      const loadConfig = {
        conversation,
        messageId: msg.id,
        msgBody,
        filepath: msgBody.localFile,
        type: 'upload',
      };
      const { queueLoadMessage } = this.props;
      queueLoadMessage(loadConfig);
    } else {
      MessageSend.sendMessage(msgBody, conversation, msg.id);
    }
  };

  render() {
    const { msg, conversation } = this.props;
    const { isEditing, msgImgPath, msgBody, currentUserJid } = this.state;
    const isCurrentUser = msg.sender === currentUserJid;
    const color = colorForString(msg.sender);
    const member = this.senderContact();
    const senderName = this.senderName();
    const msgFile = this.msgFile();
    const messageFail = msg.status === 'MESSAGE_STATUS_TRANSFER_FAILED' && isCurrentUser;
    let textContent = (msgBody.path && path.basename(msgBody.path)) || msgBody.content || msgBody;
    if (msgBody.deleted) {
      return null;
    } else if (msgBody.isAppprivateCommand) {
      return (
        <MessagePrivateApp
          msg={msg}
          userId={currentUserJid}
          conversation={conversation}
          getContactInfoByJid={this.getContactInfoByJid}
          getContactAvatar={this.getContactAvatar}
          key={msg.id}
        />
      );
    } else if (msgBody.appJid) {
      return (
        <MessageApp
          msg={msg}
          userId={currentUserJid}
          conversation={conversation}
          getContactInfoByJid={this.getContactInfoByJid}
          getContactAvatar={this.getContactAvatar}
          key={msg.id}
        />
      );
    } else {
      const isSystemEvent = ['error403', 'memberschange', 'change-group-name'].includes(
        msgBody.type
      );
      return (
        <div
          key={msg.id}
          className={
            this.getMessageClasses() +
            (isEditing ? ' editing' : '') +
            (isSystemEvent ? ' system-event' : '') +
            (messageFail ? ' message-fail' : '')
          }
          style={{ borderColor: color }}
        >
          {!isSystemEvent ? (
            <div className="messageIcons">
              {messageFail ? <div className="messageFailed" title="Not Delivered" /> : null}
              <div className="messageSender">{this.getContactAvatar(member)}</div>
            </div>
          ) : null}
          <div className="message-content">
            <div className="message-header">
              <span className="username">{senderName}</span>
              <span className="time">{dateFormat(msg.sentTime, 'LT')}</span>
            </div>
            {msgBody &&
            (msgBody.isUploading ||
              (msgBody.downloading && !fs.existsSync(msgImgPath.replace('file://', '')))) ? (
              <div className="messageBody loading">
                {msgBody.downloading && (
                  <div>
                    {' '}
                    Downloading...
                    <RetinaImg
                      name="inline-loading-spinner.gif"
                      mode={RetinaImg.Mode.ContentPreserve}
                    />
                  </div>
                )}
                {msgBody.isUploading && (
                  <div>
                    Uploading {msgBody.localFile && path.basename(msgBody.localFile)}
                    <RetinaImg
                      name="inline-loading-spinner.gif"
                      mode={RetinaImg.Mode.ContentPreserve}
                    />
                    {this.isImage(msgBody.type) && (
                      <div className="message-image">
                        <img src={msgBody.localFile} onClick={this.onClickImage} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : isEditing ? (
              <div onKeyDown={this.onKeyDown}>
                <MessageEditBar
                  msg={msg}
                  cancelEdit={this.cancelEdit}
                  value={msgBody.content || msgBody}
                  conversation={conversation}
                  deleteMessage={this.deleteMessage}
                />
              </div>
            ) : (
              <div className="messageBody">
                <div className="text-content">
                  <div className="text" ref={el => (this.contentEl = el)}>
                    {textContent}
                  </div>
                  {!msgFile &&
                    isCurrentUser &&
                    !isEditing &&
                    this.messageToolbar(msg, msgBody, false)}
                </div>
              </div>
            )}

            {msgBody.mediaObjectId && (
              <div className="messageMeta">
                <div>{msgFile}</div>
              </div>
            )}
          </div>
          {messageFail ? (
            <div className="message-retry" onClick={this.retrySend}>
              {' '}
              Try Again{' '}
            </div>
          ) : null}
        </div>
      );
    }
  }
}