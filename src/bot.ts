import { Client, LocalAuth, Message } from 'whatsapp-web.js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrcode = require('qrcode-terminal') as { generate: (qr: string, opts: { small: boolean }) => void };
import config from './config.json';
import { createResponders, createAdmins, normalizePhoneNumber, Responder } from './contacts';

const responders = createResponders(config);
const admins = createAdmins(config);
const defaultReply: string = config.defaultReply ?? '';
const logIncomingMessages = process.env.LOG_INCOMING_MESSAGES === 'true';
const replyInGroups = process.env.REPLY_IN_GROUPS === 'true';
const webVersion = process.env.WWEBJS_WEB_VERSION || '2.3000.1038512107-alpha';
const webVersionRemotePath =
  process.env.WWEBJS_WEB_VERSION_REMOTE_PATH ||
  'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html';
const handledMessageIds = new Set<string>();
const puppeteerOptions: Record<string, unknown> = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

let botEnabled = true;

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    dataPath: process.env.WWEBJS_AUTH_DIR || '.wwebjs_auth',
  }),
  bypassCSP: true,
  webVersion,
  webVersionCache: {
    type: 'remote',
    remotePath: webVersionRemotePath,
    strict: true,
  },
  puppeteer: puppeteerOptions,
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Closing WhatsApp client...`);

  try {
    await whatsappClient.destroy();
  } catch (err) {
    console.error('Error closing WhatsApp client:', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log(`Bot starting. Configured contacts: ${responders.size}. WhatsApp Web version: ${webVersion}`);

whatsappClient.on('qr', (qr: string) => {
  console.log('QR received. Scan it from WhatsApp linked devices.');
  qrcode.generate(qr, { small: true });
});

whatsappClient.on('loading_screen', (percent: number, message: string) => {
  console.log(`Loading WhatsApp Web: ${percent}% ${message}`);
});

whatsappClient.on('authenticated', () => {
  console.log('WhatsApp authenticated');
});

whatsappClient.on('ready', () => {
  console.log(`Bot initialized. Configured contacts: ${responders.size}`);
  console.log(`Known phones: ${Array.from(responders.keys()).join(', ')}`);
});

whatsappClient.on('change_state', (state: string) => {
  console.log(`WhatsApp state changed: ${state}`);
});

const getMessageId = (message: Message): string | undefined => {
  return message.id && (message.id._serialized || message.id.id);
};

const addPhoneCandidate = (phones: string[], value: string | undefined | null) => {
  try {
    phones.push(normalizePhoneNumber(value));
  } catch {
    return;
  }
};

const getSenderCandidates = async (message: Message): Promise<{ contactDetails: string; phones: string[] }> => {
  const phones: string[] = [];
  let contactDetails = '';

  try {
    const contact = await message.getContact();
    const contactId = contact.id && contact.id._serialized ? contact.id._serialized : '';
    const contactUser = contact.id && contact.id.user ? contact.id.user : '';

    addPhoneCandidate(phones, contact.number);
    addPhoneCandidate(phones, contactUser);
    addPhoneCandidate(phones, contactId);

    contactDetails = `contactNumber=${contact.number || '-'} contactId=${contactId || '-'}`;
  } catch (err) {
    console.error(`Error reading sender contact for ${message.from}:`, err);
  }

  addPhoneCandidate(phones, message.author);
  addPhoneCandidate(phones, message.from);

  return {
    contactDetails,
    phones: Array.from(new Set(phones)),
  };
};

const handleIncomingMessage = async (message: Message, eventName: string) => {
  const messageId = getMessageId(message);

  if (messageId) {
    if (handledMessageIds.has(messageId)) return;

    handledMessageIds.add(messageId);

    if (handledMessageIds.size > 1000) {
      handledMessageIds.clear();
    }
  }

  if (message.fromMe) return;

  if (message.from.endsWith('@g.us') && !replyInGroups) {
    if (logIncomingMessages) {
      console.log(`Ignored group message. chat=${message.from} author=${message.author || 'unknown'}`);
    }
    return;
  }

  const { contactDetails, phones } = await getSenderCandidates(message);

  // Admin check: look for any candidate that matches the admins set
  const adminPhone = phones.find((phone) => admins.has(phone));
  const isAdmin = adminPhone !== undefined;

  if (isAdmin) {
    const command = message.body.trim().toLowerCase();

    if (command === 'apagate') {
      botEnabled = false;
      await message.reply('Bot pausado. Escribe "enciende" para reactivar.');
      console.log(`Bot paused by admin (${adminPhone})`);
      return;
    }

    if (command === 'enciende') {
      botEnabled = true;
      await message.reply('Bot activo.');
      console.log(`Bot reactivated by admin (${adminPhone})`);
      return;
    }
  }

  if (!botEnabled) return;

  const senderNumber = phones.find((phone) => responders.has(phone)) || phones[0] || '';
  const responder: Responder | undefined = senderNumber ? responders.get(senderNumber) : undefined;

  if (logIncomingMessages) {
    console.log(
      `Incoming message. event=${eventName} sender=${senderNumber || '-'} candidates=${phones.join(',') || '-'} chat=${message.from} author=${message.author || '-'} matched=${Boolean(responder)} ${contactDetails}`
    );
  }

  if (!responder) {
    if (defaultReply) {
      try {
        await message.reply(defaultReply);
      } catch (err) {
        console.error(`Error sending default reply to ${senderNumber}:`, err);
      }
    }
    return;
  }

  try {
    await message.reply(responder.response);
    console.log(`Replied to ${responder.name} (${senderNumber})`);
  } catch (err) {
    console.error(`Error replying to ${responder.name} (${senderNumber}), trying direct send:`, err);

    try {
      await whatsappClient.sendMessage(responder.chatId, responder.response);
      console.log(`Replied to ${responder.name} (${senderNumber}) using ${responder.chatId}`);
    } catch (sendErr) {
      console.error(`Error sending message to ${responder.name} (${senderNumber}):`, sendErr);
    }
  }
};

whatsappClient.on('message', (message: Message) => {
  handleIncomingMessage(message, 'message');
});

whatsappClient.on('message_create', (message: Message) => {
  handleIncomingMessage(message, 'message_create');
});

whatsappClient.on('auth_failure', (msg: string) => {
  console.error('Authentication error:', msg);
});

whatsappClient.on('disconnected', (reason: string) => {
  console.log('Offline client:', reason);
});

whatsappClient.initialize().catch((err) => {
  console.error('Failed to initialize WhatsApp client:', err);
  process.exit(1);
});
