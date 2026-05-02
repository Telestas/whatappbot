import config from './config.json';
import { createResponders, createAdmins } from './contacts';

const responders = createResponders(config);
const admins = createAdmins(config);

console.log(`config.json ok. Configured contacts: ${responders.size}. Admins: ${admins.size}.`);
