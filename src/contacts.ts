export interface Config {
  contacts: Contact[];
  admins?: string[];
  defaultReply?: string;
}

interface Contact {
  name: string;
  phone: string;
  response: string;
}

export interface Responder {
  name: string;
  phone: string;
  chatId: string;
  response: string;
}

export const normalizePhoneNumber = (phone: string | undefined | null): string => {
  const digits = String(phone ?? '').replace(/\D/g, '');

  if (!digits) {
    throw new Error(`Invalid phone number in config: "${phone}"`);
  }

  return digits;
};

export const toChatId = (phone: string): string => {
  return `${normalizePhoneNumber(phone)}@c.us`;
};

export const createResponders = (config: Config): Map<string, Responder> => {
  if (!Array.isArray(config.contacts)) {
    throw new Error('config.json must include a "contacts" array');
  }

  return config.contacts.reduce((contacts, contact) => {
    if (!contact.name) {
      throw new Error('Each contact in config.json must include a name');
    }

    if (!contact.response) {
      throw new Error(`Contact "${contact.name}" must include a response`);
    }

    const phone = normalizePhoneNumber(contact.phone);

    if (contacts.has(phone)) {
      throw new Error(`Duplicated phone number in config.json: "${contact.phone}"`);
    }

    contacts.set(phone, {
      name: contact.name,
      phone,
      chatId: toChatId(phone),
      response: contact.response,
    });

    return contacts;
  }, new Map<string, Responder>());
};

export const createAdmins = (config: Config): Set<string> => {
  if (!config.admins || config.admins.length === 0) {
    return new Set();
  }

  return config.admins.reduce((admins, phone) => {
    admins.add(normalizePhoneNumber(phone));
    return admins;
  }, new Set<string>());
};
