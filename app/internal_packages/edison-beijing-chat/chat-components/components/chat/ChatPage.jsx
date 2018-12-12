import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Route } from 'react-router-dom';
import ConversationsPanel from './conversations/ConversationsPanel';
import NewConversationPanel from './new/NewPanel';
import MessagesPanel from './messages/MessagesPanel';
import Divider from '../common/Divider';

export default class ChatPage extends PureComponent {
  static propTypes = {
    createGroupConversation: PropTypes.func.isRequired,
    createPrivateConversation: PropTypes.func.isRequired,
    deselectConversation: PropTypes.func.isRequired,
    fetchRoster: PropTypes.func.isRequired,
    replace: PropTypes.func.isRequired,
    retrieveAllConversations: PropTypes.func.isRequired,
    retrieveContacts: PropTypes.func.isRequired,
    selectConversation: PropTypes.func.isRequired,
    newConversation: PropTypes.func.isRequired,
    sendMessage: PropTypes.func.isRequired,
    setReferenceTime: PropTypes.func.isRequired,
    availableUsers: PropTypes.arrayOf(PropTypes.string),
    contacts: PropTypes.arrayOf(PropTypes.shape({
      jid: PropTypes.string.isRequired,
      // Warning: Failed prop type
      name: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      avatar: PropTypes.string
    })),
    groupedMessages: PropTypes.arrayOf(
      PropTypes.shape({
        sender: PropTypes.string.isRequired,
        messages: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            conversationJid: PropTypes.string.isRequired,
            sender: PropTypes.string.isRequired,
            body: PropTypes.string.isRequired,
            sentTime: PropTypes.number.isRequired
          })
        ).isRequired
      })
    ),
    conversations: PropTypes.arrayOf(PropTypes.object).isRequired,
    currentUserId: PropTypes.string,
    referenceTime: PropTypes.number,
    selectedConversation: PropTypes.shape({
      isGroup: PropTypes.bool.isRequired,
      jid: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string,//.isRequired,
      avatar: PropTypes.string,
      occupants: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
  }

  static defaultProps = {
    availableUsers: [],
    contacts: [],
    currentUserId: null,
    groupedMessages: [],
    referenceTime: new Date().getTime(),
    selectedConversation: null,
  }

  componentDidMount() {
    if (!this.props.currentUserId) {
      this.props.replace('/');
    } else {
      this.props.setReferenceTime();
    }
  }

  render() {
    const {
      createGroupConversation,
      createPrivateConversation,
      deselectConversation,
      fetchRoster,
      retrieveAllConversations,
      retrieveContacts,
      selectConversation,
      newConversation,
      sendMessage,
      availableUsers,
      contacts,
      conversations,
      currentUserId,
      groupedMessages,
      referenceTime,
      selectedConversation,
      removeConversation,
      isLeft,
      resetHeight,
      onDragStart
    } = this.props;
    const selectedConversationJid = selectedConversation ? selectedConversation.jid : null;

    const conversationsPanelProps = {
      retrieveAllConversations,
      selectConversation,
      newConversation,
      conversations,
      selectedConversationJid,
      referenceTime,
      removeConversation,
    };
    const messagesPanelProps = {
      deselectConversation,
      sendMessage,
      availableUsers,
      currentUserId,
      groupedMessages,
      referenceTime,
      selectedConversation,
      contacts,
      onGroupConversationCompleted: createGroupConversation,
    };
    const newConversationPanelProps = {
      onGroupConversationCompleted: createGroupConversation,
      onPrivateConversationCompleted: createPrivateConversation,
      onMount: () => {
        retrieveContacts();
      },
      contacts,
    };

    const rightPanelStyles = ['rightPanel'];
    if (selectedConversation) {
      rightPanelStyles.push('focused');
    }
    const rightPanelClasses = rightPanelStyles.join(' ');

    return (
      <div className="chatPageContainer">
        <div className="leftPanel" style={{ display: isLeft ? 'block' : 'none' }}>
          <div onDoubleClick={resetHeight} onMouseDown={onDragStart} className="resizeBar"></div>
          <Route
            exact
            path="/chat"
            render={() => (<ConversationsPanel {...conversationsPanelProps} />)}
          />
          <Route
            exact
            path="/chat/new"
            render={() => (<NewConversationPanel {...newConversationPanelProps} />)}
          />
        </div>
        {
          !isLeft ? (
            <div className={rightPanelClasses}>
              <MessagesPanel {...messagesPanelProps} />
            </div>
          ) : null
        }
      </div>
    );
  }
}