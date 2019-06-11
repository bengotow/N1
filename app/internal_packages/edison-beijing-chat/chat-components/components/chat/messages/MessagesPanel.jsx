import React, { Component } from 'react';
import path from "path";
const sqlite = require('better-sqlite3');
import { CSSTransitionGroup } from 'react-transition-group';
import PropTypes from 'prop-types';
import MessagesTopBar from './MessagesTopBar';
import NewConversationTopBar from './NewConversationTopBar';
import MessagesSendBar from './MessagesSendBar';
import Messages from './Messages';
import ConversationInfo from '../conversations/ConversationInfo';
import Divider from '../../common/Divider';
import InviteGroupChatList from '../new/InviteGroupChatList';
import xmpp from '../../../xmpp/index';
import chatModel, { saveToLocalStorage } from '../../../store/model';
import { downloadFile, uploadFile } from '../../../utils/awss3';
import uuid from 'uuid/v4';
import { NEW_CONVERSATION } from '../../../actions/chat';
import { FILE_TYPE } from './messageModel';
import registerLoginChatAccounts from '../../../utils/registerLoginChatAccounts';
import { RetinaImg } from 'mailspring-component-kit';
import { ProgressBarStore, ChatActions, MessageStore, ConversationStore, ContactStore, RoomStore } from 'chat-exports';
import FixedPopover from '../../../../../../src/components/fixed-popover';
import { queryProfile, refreshChatAccountTokens } from '../../../utils/restjs';
import { isJsonStr } from '../../../utils/stringUtils';
import { AccountStore } from 'mailspring-exports';

import keyMannager from '../../../../../../src/key-manager';
import MemberProfile from '../conversations/MemberProfile';

import { xmpplogin } from '../../../utils/restjs';
import fs from "fs";
import https from "https";
import http from "http";
import { MESSAGE_STATUS_UPLOAD_FAILED } from '../../../db/schemas/message';
import { beginSendingMessage } from '../../../actions/chat';
import { updateSelectedConversation } from '../../../actions/db/conversation';
import { sendFileMessage } from '../../../utils/message';
import { getToken, getMyApps } from '../../../utils/appmgt';
import { log } from '../../../utils/log-util';

const { exec } = require('child_process');
const GROUP_CHAT_DOMAIN = '@muc.im.edison.tech';

window.registerLoginChatAccounts = registerLoginChatAccounts;

export default class MessagesPanel extends Component {
  static propTypes = {
    sendMessage: PropTypes.func.isRequired,
    currentUserId: PropTypes.string,
    referenceTime: PropTypes.number,
  }

  static defaultProps = {
    availableUsers: [],
    currentUserId: null,
    referenceTime: new Date().getTime(),
  }

  apps = []

  constructor(props) {
    super(props);
    this.state = {
      showConversationInfo: false,
      inviting: false,
      members: [],
      membersTemp: null,
      online: true,
      connecting: false,
      moreBtnEl: null,
      progress: {
        loadConfig: null
      },
      selectedConversation: null,
      contacts: [],
      groupedMessages: []
    }
    this._listenToStore();
  }

  _listenToStore = () => {
    this._unsubs = [];
    this._unsubs.push(ConversationStore.listen(this._onDataChanged));
    this._unsubs.push(MessageStore.listen(this._onDataChanged));
    this._unsubs.push(ContactStore.listen(this._onDataChanged));
  }

  _onDataChanged = async () => {
    const selectedConversation = await ConversationStore.getSelectedConversation();
    const contacts = await ContactStore.getContacts();
    let groupedMessages = [];
    if (selectedConversation) {
      groupedMessages = await MessageStore.getGroupedMessages(selectedConversation.jid);
      const { selectedConversation: currentConv } = this.state;
      if (!currentConv || currentConv.jid !== selectedConversation.jid) {
        await this.refreshRoomMembers({ selectedConversation });
      }
    }
    this.setState({
      selectedConversation,
      groupedMessages,
      contacts
    });
  }

  onUpdateGroup = async (contacts) => {
    this.setState(Object.assign({}, this.state, { inviting: false }));
    const { selectedConversation } = this.state;
    if (contacts && contacts.length > 0) {
      if (selectedConversation.isGroup) {
        await Promise.all(contacts.map(contact => (
          xmpp.addMember(selectedConversation.jid, contact.jid, selectedConversation.curJid)
        )));
        this.refreshRoomMembers();
      } else {
        const roomId = uuid() + GROUP_CHAT_DOMAIN;
        if (!contacts.filter(item => item.jid === selectedConversation.curJid).length) {
          const other = await ContactStore.findContactByJid(selectedConversation.curJid);
          if (other) {
            contacts.unshift(other);
          } else {
            contacts.unshift({ jid: selectedConversation.jid, name: '' });
          }
        }
        if (!contacts.filter(item => item.jid === selectedConversation.curJid).length) {
          const owner = await ContactStore.findContactByJid(selectedConversation.curJid);
          if (owner) {
            contacts.unshift(owner);
          } else {
            contacts.unshift({ jid: selectedConversation.curJid, name: '' });
          }
        }
        const names = contacts.map(item => item.name);
        const chatName = names.slice(0, names.length - 1).join(', ') + ' & ' + names[names.length - 1];
        // const { onGroupConversationCompleted } = this.props;
        ConversationStore.createGroupConversation({ contacts, roomId, name: chatName, curJid: selectedConversation.curJid });
      }
    }
  }

  componentWillMount() {
  }
  componentDidMount = async () => {
    await this.refreshRoomMembers();
    this.getEmailContacts();
    window.addEventListener("online", this.onLine);
    window.addEventListener("offline", this.offLine);
    const state = Object.assign({}, this.state, { online: navigator.onLine });
    this.setState(state);
  }
  componentWillUnmount() {
    window.removeEventListener("online", this.onLine);
    window.removeEventListener("offline", this.offLine);
    for (const unsub of this._unsubs) {
      unsub();
    };
  }

  getApps = () => {
    const { selectedConversation } = this.state;
    if (!selectedConversation || !selectedConversation.curJid) {
      return;
    }
    //curJid is necessary for app to create a new conversation
    const { curJid } = selectedConversation;
    const userId = curJid.split('@')[0];
    let apps = [];

    const myApps = getMyApps(userId);
    if (!myApps) {
      return;
    }
    let uapps = myApps.apps;
    try {
      if (uapps && uapps.length > 0) {
        for (let app of uapps) {
          app = Object.assign({}, app);
          app.jid = app.id + '@app.im.edison.tech';
          app.email = app.jid;
          app.curJid = curJid;
          apps.push(app)
        }
      }
      this.apps = apps;
    } catch (e) {
      console.error(e, myApps, uapps);
    }
  }

  _getTokenByCurJid = async () => {
    const { selectedConversation } = this.state;
    let currentUserId = selectedConversation && selectedConversation.curJid;
    if (currentUserId) {
      currentUserId = currentUserId.split('@')[0];
      const chatAccounts = AppEnv.config.get('chatAccounts');
      for (const email in chatAccounts) {
        if (chatAccounts[email].userId === currentUserId) {
          return await keyMannager.getAccessTokenByEmail(email);
        }
      }
    }
    return null;
  }

  getEmailContacts = async () => {
    let configDirPath = AppEnv.getConfigDirPath();
    let dbpath = path.join(configDirPath, 'edisonmail.db');
    const sqldb = sqlite(dbpath);
    const stmt = sqldb.prepare('SELECT * FROM contact where sendToCount >= 1 and recvFromCount > 1');
    let emailContacts = stmt.all();
    sqldb.close();
    const chatAccounts = AppEnv.config.get('chatAccounts') || {};
    const email = Object.keys(chatAccounts)[0];
    await refreshChatAccountTokens()
    let accessToken = await keyMannager.getAccessTokenByEmail(email);
    const emails = emailContacts.map(contact => contact.email);
    queryProfile({ accessToken, emails }, (err, res) => {
      if (!res) {
        console.log('fail to login to queryProfile');
        return;
      }
      if (isJsonStr(res)) {
        res = JSON.parse(res);
      }
      emailContacts = emailContacts.map((contact, index) => {
        contact = Object.assign(contact, res.data ? res.data.users[index] : {})
        if (contact.userId) {
          contact.jid = contact.userId + '@im.edison.tech'
        } else {
          contact.jid = contact.email.replace('@', '^at^') + '@im.edison.tech'
        }
        contact.curJid = this.getCurJidByAccountId(contact.accountId, chatAccounts);
        return contact;
      });
      emailContacts = emailContacts.filter(contact => !!contact.curJid);
      const state = Object.assign({}, this.state, { emailContacts });
      this.setState(state);
    })
  }

  getCurJidByAccountId(aid, chatAccounts) {
    const contact = AccountStore.accountForId(aid);
    const chatAcc = contact ? chatAccounts[contact.emailAddress] : null;
    return chatAcc ? chatAcc.userId + '@im.edison.tech' : null;
  }

  onLine = () => {
    log(`MessagePanel: chat online`);
    // connect to chat server
    if (!this.props.chat_online) {
      this.reconnect();
    }
    ChatActions.updateProgress({ offline: false });
    this.setState({
      online: true
    })
  };

  offLine = () => {
    log(`MessagePanel: chat offline`);
    ChatActions.updateProgress({ offline: true, failed: true });
    this.setState({
      online: false
    })
  };

  componentWillReceiveProps = (nextProps, nextState) => {
    this.refreshRoomMembers(nextState);
  }

  refreshRoomMembers = async (nextState) => {
    this.setState({ loadingMembers: true });
    const members = await this.getRoomMembers(nextState);
    this.setState({
      members,
      loadingMembers: false
    });
  }

  getRoomMembers = async (nextState) => {
    const { selectedConversation: conversation } = nextState || this.state;
    if (conversation && conversation.isGroup) {
      return await RoomStore.getRoomMembers(conversation.jid, conversation.curJid, true);
    }
    return [];
  }

  saveRoomMembersForTemp = (members) => {
    this.setState({ membersTemp: members })
  }

  toggleInvite = (moreBtnEl) => {
    this.setState({ inviting: !this.state.inviting, moreBtnEl });
  }

  onDragOver = (event) => {
    const state = Object.assign({}, this.state, { dragover: true });
    this.setState(state);
  }

  onDragEnd = (event) => {
    const state = Object.assign({}, this.state, { dragover: false });
    this.setState(state);
  }

  onDrop = (event) => {
    let tranFiles = event.dataTransfer.files,
      files = [];
    for (let i = 0; i < tranFiles.length; i++) {
      files.push(tranFiles[i].path);
    }
    const state = Object.assign({}, this.state, { dragover: false });
    this.setState(state);
    this.sendFile(files);
  }

  sendFile(files) {
    const { selectedConversation } = this.state;
    const onMessageSubmitted = this.props.sendMessage;
    const atIndex = selectedConversation.jid.indexOf('@');

    let jidLocal = selectedConversation.jid.slice(0, atIndex);

    files.map((file, index) => sendFileMessage(file, index, this, ' '));
  }

  createRoom = () => {
    const members = this.state.membersTemp;
    if (members && members.length) {
      if (members.length > 4) {
        const roomId = uuid() + GROUP_CHAT_DOMAIN;
        const names = members.map(item => item.name);
        const chatName = names.slice(0, 3).join(', ') + ' & ' + `${names.length - 3} others`;
        ConversationStore.createGroupConversation({ contacts: members, roomId, name: chatName, curJid: members[0].curJid });
      }
      else if (members.length > 1) {
        if (members.some((member) => member.jid.match(/@app/))) {
          window.alert('plugin app should only create private conversation with single member!');
          return;
        }
        const roomId = uuid() + GROUP_CHAT_DOMAIN;
        const names = members.map(item => item.name);
        const chatName = names.slice(0, names.length - 1).join(', ') + ' & ' + names[names.length - 1];
        ConversationStore.createGroupConversation({ contacts: members, roomId, name: chatName, curJid: members[0].curJid });
      }
      else if (members.length == 1) {
        ConversationStore.createPrivateConversation(members[0]);
      }
    }
  }

  removeMember = member => {
    const conversation = this.state.selectedConversation;
    if (member.affiliation === 'owner') {
      alert('you can not remove the owner of the group chat!');
      return;
    }
    const jid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
    xmpp.leaveRoom(conversation.jid, jid);
    if (jid == conversation.curJid) {
      ChatActions.removeConversation(conversation.jid);
      ChatActions.deselectConversation();
    } else {
      this.refreshRoomMembers();
    }
  };

  editProfile = member => {
    const { profile } = this;
    profile.clickSame = member && member === profile.state.member;
    setTimeout(() => {
      this.profile.setMember(member);
    }, 10);
  }

  exitProfile = async member => {
    if (!member) {
      return;
    }
    const jid = member.jid.bare || member.jid;
    const nicknames = chatModel.chatStorage.nicknames;
    if (nicknames[jid] != member.nickname) {
      nicknames[jid] = member.nickname;
      saveToLocalStorage();
    }
    this.profile.setMember(null);
  }

  reconnect = () => {
    registerLoginChatAccounts();
  }

  queueLoadMessage = (loadConfig) => {
    let { progress } = ProgressBarStore;
    progress = Object.assign({}, progress);
    let { loading } = progress;
    if (loading) {
      loadConfig = progress.loadConfig;
      const loadText = loadConfig.type === 'upload' ? 'An upload' : ' A download';
      window.alert(`${loadText} is processing, please wait it to be finished!`);
      return;
    }
    ChatActions.updateProgress({ loadConfig, loading: true, visible: true },
      { onCancel: this.cancelLoadMessage, onRetry: this.retryLoadMessage });
    if (!loading) {
      this.loadMessage();
    }
  };

  loadMessage = () => {
    const { progress } = ProgressBarStore;
    let { loadConfig } = progress;
    ChatActions.updateProgress({ loading: true, percent: 0, finished: false, failed: false, visible: true });
    const { msgBody, filepath } = loadConfig;

    const loadCallback = (...args) => {
      ChatActions.updateProgress({ loading: false, finished: true, visible: true });
      clearInterval(this.loadTimer);
      if (loadConfig.type === 'upload') {
        const onMessageSubmitted = this.props.sendMessage;
        const [err, _, myKey, size] = args;
        const conversation = loadConfig.conversation;
        const messageId = loadConfig.messageId;
        let body = loadConfig.msgBody;
        body.type = FILE_TYPE.OTHER_FILE;
        body.isUploading = false;
        body.mediaObjectId = myKey;
        body = JSON.stringify(body);
        if (err) {
          console.error(`${conversation.name}:\nfile(${filepath}) transfer failed because error: ${err}`);
          const message = {
            id: messageId,
            conversationJid: conversation.jid,
            body,
            sender: conversation.curJid,
            sentTime: (new Date()).getTime() + chatModel.diffTime,
            status: MESSAGE_STATUS_UPLOAD_FAILED,
          };
          chatModel.store.dispatch(beginStoringMessage(message));
          chatModel.store.dispatch(updateSelectedConversation(conversation));
          return;
        } else {
          onMessageSubmitted(conversation, body, messageId, false);
        }
      }
    }

    const loadProgressCallback = progress => {
      const { loaded, total } = progress;
      const percent = Math.floor(+loaded * 100.0 / (+total));
      if (loadConfig.type === 'upload' && +loaded === +total) {
        const onMessageSubmitted = this.props.sendMessage;
        const conversation = loadConfig.conversation;
        const messageId = loadConfig.messageId;
        let body = loadConfig.msgBody;
        body.isUploading = false;
        body = JSON.stringify(body);
        ChatActions.updateProgress({ percent, visible: true });
        onMessageSubmitted(conversation, body, messageId, false);
      }
      ChatActions.updateProgress({ percent });
    }
    if (loadConfig.type === 'upload') {
      const conversation = loadConfig.conversation;
      const atIndex = conversation.jid.indexOf('@');
      let jidLocal = conversation.jid.slice(0, atIndex);
      try {
        loadConfig.request = uploadFile(jidLocal, null, loadConfig.filepath, loadCallback, loadProgressCallback);
      } catch (e) {
        console.error('upload file:', e);
        window.alert(`failed to send file: ${loadConfig.filepath}: ${e}`);
        this.cancelLoadMessage();
        ChatActions.updateProgress({ failed: true, loading: false, visible: false });
        return;
      }
    } else if (msgBody.path && !msgBody.path.match(/^((http:)|(https:))/)) {
      // the file is an image and it has been downloaded to local while the message was received
      let imgpath = msgBody.path.replace('file://', '');
      if (imgpath !== filepath) {
        fs.copyFileSync(imgpath, filepath);
      }
      loadCallback();
    } else if (!msgBody.mediaObjectId.match(/^https?:\/\//)) {
      // the file is on aws
      loadConfig.request = downloadFile(msgBody.aes, msgBody.mediaObjectId, filepath, loadCallback, loadProgressCallback);
    } else {
      // the file is a link to the web outside aws
      let request;
      if (msgBody.mediaObjectId.match(/^https/)) {
        request = https;
      } else {
        request = http;
      }
      request.get(msgBody.mediaObjectId, function (res) {
        var imgData = '';
        res.setEncoding('binary');
        res.on('data', function (chunk) {
          imgData += chunk;
        });
        res.on('end', function () {
          fs.writeFile(filepath, imgData, 'binary', function (err) {
            if (err) {
              console.error('down fail', err);
            } else {
              console.log('down success');
            }
            loadCallback();
          });
        });
      });
    }

    if (this.loadTimer) {
      clearInterval(this.loadTimer);
    }
    this.loadTimer = setInterval(() => {
      if (loadConfig && loadConfig.request && loadConfig.request.failed) {
        ChatActions.updateProgress({ failed: true });
      }
    }, 10000);
  }

  cancelLoadMessage = () => {
    const { progress } = ProgressBarStore;
    let { loadConfig } = progress;
    if (!loadConfig) {
      return;
    }
    if (loadConfig && loadConfig.request && loadConfig.request.abort) {
      try {
        loadConfig.request.abort();
      } catch (e) {
        console.log('abort loading:', e);
      }
    }
    if (loadConfig && loadConfig.type === 'upload') {
      const conversation = loadConfig.conversation;
      const messageId = loadConfig.messageId;
      let body = loadConfig.msgBody;
      body.isUploading = false;
      body.path = body.localFile;
      //body.localFile = null;
      body = JSON.stringify(body);
      chatModel.store.dispatch(beginSendingMessage(conversation, body, messageId, false, false));
    }
    ChatActions.updateProgress({ loading: false, failed: true });
    clearInterval(this.loadTimer);
  }

  retryLoadMessage = () => {
    ChatActions.updateProgress({ failed: false });
    setTimeout(() => {
      this.loadMessage();
    })
  };

  installApp = async (e) => {
    const conv = this.state.selectedConversation;
    const { curJid } = conv;
    const userId = curJid.split('@')[0];
    let token = await getToken(userId);
    xmpplogin(userId, token, (err, data) => {
      if (data) {
        data = JSON.parse(data);
        if (data.data && data.data.url) {
          exec('open ' + data.data.url);
        } else {
          window.alert('fail to open the app store page');
        }
      }
    })
  }

  render() {
    this.getApps();
    const { showConversationInfo, inviting, members, contacts } = this.state;
    const {
      sendMessage,
      availableUsers,
      referenceTime,
    } = this.props;
    const { groupedMessages, selectedConversation } = this.state;
    groupedMessages.map(group => group.messages.map(message => {
      members.map(member => {
        const jid = member.jid.bare || member.jid;
        if (jid === message.sender) {
          message.senderNickname = member.nickname || message.senderNickname;
        }
      });
    }));
    const currentUserId = selectedConversation && selectedConversation.curJid ? selectedConversation.curJid : NEW_CONVERSATION;
    const topBarProps = {
      onBackPressed: () => {
        ChatActions.deselectConversation()();
        this.setState({ showConversationInfo: false });
      },
      onInfoPressed: () =>
        this.setState({ showConversationInfo: !this.state.showConversationInfo }),
      toggleInvite: this.toggleInvite,
      availableUsers,
      infoActive: showConversationInfo,
      selectedConversation,
      inviting: this.state.inviting
    };
    const messagesProps = {
      currentUserId,
      groupedMessages,
      referenceTime,
      selectedConversation,
      onMessageSubmitted: sendMessage,
      queueLoadMessage: this.queueLoadMessage,
      members: this.state.members,
    };
    const sendBarProps = {
      onMessageSubmitted: sendMessage,
      selectedConversation,
      queueLoadMessage: this.queueLoadMessage,
    };
    const infoProps = {
      selectedConversation,
      toggleInvite: this.toggleInvite,
      members: this.state.members,
      loadingMembers: this.state.loadingMembers,
      getRoomMembers: this.getRoomMembers,
      refreshRoomMembers: this.refreshRoomMembers,
      removeMember: this.removeMember,
      editProfile: this.editProfile,
      exitProfile: this.exitProfile,
    };
    const contactsSet = {};
    contacts.forEach(contact => {
      contactsSet[contact.email] = 1;
      return
    });
    let allContacts = contacts.slice();
    this.state.emailContacts && this.state.emailContacts.forEach(contact => {
      if (contactsSet[contact.email]) {
        return;
      } else {
        contactsSet[contact.email] = 1;
        allContacts.push(contact);
      }
    });
    this.apps && allContacts.push.apply(allContacts, this.apps);
    const newConversationProps = {
      contacts: allContacts,
      saveRoomMembersForTemp: this.saveRoomMembersForTemp,
      // deselectConversation,
      createRoom: this.createRoom
    }
    let className = '';
    if (selectedConversation && selectedConversation.jid === NEW_CONVERSATION) {
      className = 'new-conversation-popup'
    }

    const isOffLine = !this.state.online || !this.props.chat_online;

    return (
      <div className={`panel ${isOffLine ? 'offline' : ''}`}
        onDragOverCapture={this.onDragOver}
        onDragEnd={this.onDragEnd}
        onMouseLeave={this.onDragEnd}
        onDrop={this.onDrop}
      >
        {selectedConversation ?
          <div className="chat">
            <div className={`split-panel ${className}`}>
              {
                selectedConversation.jid === NEW_CONVERSATION ? (
                  <div className="chatPanel">
                    <NewConversationTopBar {...newConversationProps} />
                  </div>
                ) : (
                    <div className="chatPanel">
                      <MessagesTopBar {...topBarProps} />
                      <Messages {...messagesProps} sendBarProps={sendBarProps} />
                      {this.state.dragover && (
                        <div id="message-dragdrop-override"></div>
                      )}
                      <div>
                        <MessagesSendBar {...sendBarProps} />
                      </div>
                    </div>
                  )
              }
              <Divider type="vertical" />
              <CSSTransitionGroup
                transitionName="transition-slide"
                transitionLeaveTimeout={250}
                transitionEnterTimeout={250}
              >
                {showConversationInfo && selectedConversation.jid !== NEW_CONVERSATION && (
                  <div className="infoPanel">
                    <ConversationInfo {...infoProps} />
                  </div>
                )}
              </CSSTransitionGroup>
            </div>
          </div> :
          <div className="unselectedHint">
            <span>
              <RetinaImg name={`EmptyChat.png`} mode={RetinaImg.Mode.ContentPreserve} />
            </span>
          </div>
        }
        {isOffLine && (
          <div className="network-offline">
            {this.state.online ? (
              this.props.isAuthenticating ? (
                <div>
                  <RetinaImg name={'no-network.svg'}
                    style={{ width: 16 }}
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask} />
                  <span>Your computer appears to be disconnected. Edison Mail is trying to reconnect. </span>
                </div>
              ) : (
                  <div>
                    <RetinaImg name={'no-network.svg'}
                      style={{ width: 16 }}
                      isIcon
                      mode={RetinaImg.Mode.ContentIsMask} />
                    <span>There appears to be a problem with your connection. Please click to reconnect: </span>
                    <span className="reconnect" onClick={this.reconnect}>Reconnect Now</span>
                  </div>
                )
            ) : (<div>
              <RetinaImg name={'no-network.svg'}
                style={{ width: 16 }}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask} />
              <span>Your computer appears to be offline. Please check your network connection.</span>
            </div>)}
          </div>
        )}
        {inviting && selectedConversation.jid !== NEW_CONVERSATION && (
          <FixedPopover {...{
            direction: 'down',
            originRect: {
              width: 350,
              height: 430,
              top: this.state.moreBtnEl.getBoundingClientRect().top,
              left: this.state.moreBtnEl.getBoundingClientRect().left,
            },
            closeOnAppBlur: false,
            onClose: () => {
              this.setState({ inviting: false });
            },
          }}>
            <InviteGroupChatList contacts={allContacts} groupMode={true} onUpdateGroup={this.onUpdateGroup} />
          </FixedPopover>
        )}
        <MemberProfile conversation={selectedConversation}
          exitProfile={this.exitProfile}
          panel={this}>
        </MemberProfile>
      </div>
    );
  }
}
