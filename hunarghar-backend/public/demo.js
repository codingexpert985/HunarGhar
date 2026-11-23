'use strict';
const $ = (id) => document.getElementById(id);
function add(log, text, cls) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls; d.textContent = text;
  log.appendChild(d); log.scrollTop = log.scrollHeight;
}

// ---------------- chatbot ----------------
async function askBot() {
  const text = $('botInput').value.trim();
  if (!text) return;
  add($('botLog'), text, 'me'); $('botInput').value = '';
  try {
    const r = await fetch('/api/chatbot/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
    const d = await r.json();
    let out = d.reply || d.message;
    if (d.suggestions && d.suggestions.providers) {
      out += '\n' + d.suggestions.providers.map((p) => `• ${p.name} (${p.city}) ★${p.avg_rating} from PKR ${p.min_price}`).join('\n');
      out += `\nSearch link: ${d.suggestions.searchLink}`;
    }
    if (d.disclaimer) out += `\n\n${d.disclaimer}`;
    if (d.intent) out += `\n[intent: ${d.intent}, confidence: ${d.confidence}]`;
    add($('botLog'), out, 'them');
  } catch (e) { add($('botLog'), 'Could not reach the server.', 'them'); }
}
$('botSend').onclick = askBot;
$('botInput').onkeydown = (e) => { if (e.key === 'Enter') askBot(); };
add($('botLog'), 'Hello! Ask me about HunarGhar or tell me what service you need.', 'them');

// ---------------- login + live chat ----------------
let token = null, me = null, socket = null, current = null;

$('loginBtn').onclick = async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: $('email').value, password: $('password').value }) });
  const d = await r.json();
  if (!d.success) { $('status').innerHTML = `<small>${d.message}</small>`; return; }
  token = d.token; me = d.user;
  $('status').innerHTML = `<small>Signed in as ${me.full_name} (${me.role})</small>`;
  const b = await (await fetch('/api/bookings', { headers: { Authorization: 'Bearer ' + token } })).json();
  const sel = $('bookingSel'); sel.innerHTML = '<option value="">— my bookings —</option>';
  (b.bookings || []).forEach((x) => {
    const o = document.createElement('option'); o.value = x.booking_id;
    o.textContent = `${x.category} · ${x.status} · ${x.customer_name} / ${x.provider_name}`; sel.appendChild(o);
  });
  if (socket) socket.disconnect();
  socket = io({ auth: { token } });
  socket.on('connect_error', (e) => add($('chatLog'), 'Connection problem: ' + e.message, 'them'));
  socket.on('new_message', (m) => { if (m.booking_id === current) add($('chatLog'), `${m.sender_name}: ${m.content}`, m.sender_id === me.user_id ? 'me' : 'them'); });
  socket.on('booking_status', (s) => add($('chatLog'), `Booking status changed to ${s.status}`, 'them'));
};

$('bookingSel').onchange = async (e) => {
  current = e.target.value; $('chatLog').innerHTML = '';
  if (!current || !socket) return;
  socket.emit('join_booking', current, async (ack) => {
    if (!ack.ok) return add($('chatLog'), ack.error, 'them');
    const r = await (await fetch(`/api/bookings/${current}/messages`, { headers: { Authorization: 'Bearer ' + token } })).json();
    (r.messages || []).forEach((m) => add($('chatLog'), `${m.sender_name}: ${m.content}`, m.sender_id === me.user_id ? 'me' : 'them'));
  });
};

function sendChat() {
  const content = $('chatInput').value.trim();
  if (!content || !current || !socket) return;
  socket.emit('send_message', { bookingId: current, content }, (ack) => {
    if (!ack.ok) add($('chatLog'), 'Not sent: ' + ack.error, 'them');   // never show unsent messages as sent
  });
  $('chatInput').value = '';
}
$('chatSend').onclick = sendChat;
$('chatInput').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
