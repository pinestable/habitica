import { Resend } from 'resend';
import nconf from 'nconf';

const apiKey = nconf.get('RESEND_API_KEY');
const fromEmail = nconf.get('RESEND_FROM_EMAIL') || 'reminders@habitica.local';

const resend = apiKey ? new Resend(apiKey) : null;

export { resend, fromEmail };
