import type { EmergencyTicketDto, EmergencyTicketReplyDto } from '@/types/dto';

export type ChatBubble = {
  id: string;
  body: string;
  fromSuperAdmin: boolean;
  createdAt?: string;
};

const createdById = (ticket: EmergencyTicketDto) => {
  const author = ticket.createdBy;
  if (!author) return '';
  if (typeof author === 'object') return author._id;
  return String(author);
};

export const replyFromSuperAdmin = (ticket: EmergencyTicketDto, reply: EmergencyTicketReplyDto) => {
  if (reply.fromRole) return reply.fromRole === 'SUPER_ADMIN';
  const authorId = String(reply.authorId || '');
  const ownerId = createdById(ticket);
  if (ticket.source === 'SUPER_ADMIN') return Boolean(authorId) && authorId === ownerId;
  return Boolean(authorId) && authorId !== ownerId;
};

export const getLatestIncomingMessageTimestamp = (ticket: EmergencyTicketDto): string | undefined => {
  const replies = ticket.replies ?? [];
  if (replies.length > 0) {
    const lastReply = replies[replies.length - 1];
    if (replyFromSuperAdmin(ticket, lastReply)) {
      return lastReply.createdAt;
    }
    return undefined;
  }
  if (ticket.source === 'SUPER_ADMIN') {
    return ticket.createdAt;
  }
  return undefined;
};

export const ticketToBubbles = (ticket: EmergencyTicketDto): ChatBubble[] => {
  const bubbles: ChatBubble[] = [
    {
      id: `${ticket._id}-root`,
      body: ticket.body,
      fromSuperAdmin: ticket.source === 'SUPER_ADMIN',
      createdAt: ticket.createdAt,
    },
  ];
  (ticket.replies ?? []).forEach((reply, index) => {
    bubbles.push({
      id: `${ticket._id}-reply-${index}`,
      body: reply.body,
      fromSuperAdmin: replyFromSuperAdmin(ticket, reply),
      createdAt: reply.createdAt,
    });
  });
  return bubbles;
};

export const formatChatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const lastMessagePreview = (ticket: EmergencyTicketDto) => {
  const replies = ticket.replies ?? [];
  if (replies.length > 0) return replies[replies.length - 1]?.body || ticket.body;
  return ticket.body;
};
