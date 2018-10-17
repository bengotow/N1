import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import uuid from 'uuid/v4';
import CheckIcon from '../../common/icons/CheckIcon';
import {
  MESSAGE_STATUS_DELIVERED,
  getStatusWeight,
} from '../../../db/schemas/message';
import { colorForString } from '../../../utils/colors';
import { buildTimeDescriptor } from '../../../utils/time';

// The number of pixels away from the bottom to be considered as being at the bottom
const BOTTOM_TOLERANCE = 32;

const flattenMsgIds = groupedMessages =>
  groupedMessages
    .map(group => group.messages.map(message => message.id))
    .reduce(
      (acc, curr) => {
        curr.forEach(id => acc.add(id));
        return acc;
      }, new Set()
    );

export default class Messages extends PureComponent {
  static propTypes = {
    currentUserId: PropTypes.string.isRequired,
    groupedMessages: PropTypes.arrayOf(
      PropTypes.shape({
        sender: PropTypes.string.isRequired,
        messages: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            conversationJid: PropTypes.string.isRequired,
            sender: PropTypes.string.isRequired,
            body: PropTypes.string.isRequired,
            sentTime: PropTypes.number.isRequired,
            status: PropTypes.string.isRequired,
          })
        ).isRequired
      })
    ).isRequired,
    referenceTime: PropTypes.number,
    selectedConversation: PropTypes.shape({
      jid: PropTypes.string.isRequired,
      isGroup: PropTypes.bool.isRequired,
    }),
  }

  static defaultProps = {
    referenceTime: new Date().getTime(),
    selectedConversation: { isGroup: false },
  };

  state = {
    shouldScrollBottom: true,
  }

  componentWillReceiveProps(nextProps) {
    const { selectedConversation: currentConv = {} } = this.props;
    const { selectedConversation: nextConv = {} } = nextProps;
    const { jid: currentJid } = currentConv;
    const { jid: nextJid } = nextConv;

    if (currentJid !== nextJid) {
      this.setState({ shouldScrollBottom: true });
      return;
    }

    const msgElem = this.messagesPanel;
    const isAtBottom = (msgElem.scrollHeight - msgElem.scrollTop) <
      (msgElem.clientHeight + BOTTOM_TOLERANCE);
    const { currentUserId } = this.props;
    const { groupedMessages: currentMsgs = [] } = this.props;
    const { groupedMessages: nextMsgs = [] } = nextProps;
    const currentIds = flattenMsgIds(currentMsgs);
    const nextIds = flattenMsgIds(nextMsgs);
    const areNewMessages = currentIds.size !== nextIds.size;
    const isLatestSelf = nextMsgs.length > 0 &&
      nextMsgs[nextMsgs.length - 1].sender === currentUserId;

    this.setState({
      shouldScrollBottom: areNewMessages && (isLatestSelf || isAtBottom),
    });
  }

  componentDidUpdate() {
    if (this.state.shouldScrollBottom) {
      this.scrollToMessagesBottom();
    }
  }

  messagesPanel = null;
  messagePanelEnd = null;

  scrollToMessagesBottom() {
    if (this.messagePanelEnd) {
      this.messagePanelEnd.scrollIntoView({ behavior: 'smooth' });
      this.setState({ shouldScrollBottom: false });
    }
  }

  render() {
    const {
      currentUserId,
      groupedMessages,
      referenceTime,
      selectedConversation: { isGroup },
    } = this.props;
    const timeDescriptor = buildTimeDescriptor(referenceTime);
    const getMessageClasses = message => {
      const messageStyles = ['message'];
      if (message.sender === currentUserId) {
        messageStyles.push('currentUser');
      } else {
        messageStyles.push('otherUser');
      }
      return messageStyles.join(' ');
    };

    return (
      <div
        className="messages"
        ref={element => { this.messagesPanel = element; }}
      >
        {groupedMessages.map(group => (
          <div className="messageGroup" key={uuid()}>
            {group.messages.map((msg, idx) => {
              const color = colorForString(msg.sender);
              return (
                <div
                  key={msg.id}
                  className={getMessageClasses(msg)}
                  style={{ borderColor: color }}
                >
                  {isGroup && msg.sender !== currentUserId && idx === 0 ?
                    <div
                      className="messageSender"
                      style={{ color }}
                    >
                      {msg.sender}
                    </div> : null
                  }
                  <div className="messageContent">
                    <div className="messageBody">{msg.body.indexOf('{') == 0 ? JSON.parse(msg.body).content : msg.body}</div>
                    <div className="messageMeta">
                      {getStatusWeight(msg.status) >= getStatusWeight(MESSAGE_STATUS_DELIVERED) ?
                        <CheckIcon
                          className="messageStatus"
                          size={8}
                          color="white"
                        /> : null
                      }
                      {timeDescriptor(msg.sentTime, true)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
        }
        <div ref={element => { this.messagePanelEnd = element; }} />
      </div>
    );
  }
}
