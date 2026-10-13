function clientKey(record) {
  if (record.clientId) return `client:${record.clientId}`;
  const name = String(record.client || "").trim().toLocaleLowerCase();
  if (!name || name === "walk-in" || name === "walk-in / anonymous") return "";
  return `name:${name}`;
}

export function groupTodayPosVisits(appointments, transactions, date, branch, openCarts = []) {
  const visits = [];
  const byClient = new Map();
  const byAppointment = new Map();

  for (const appointment of appointments) {
    if (appointment.date !== date || appointment.branch !== branch) continue;
    const key = clientKey(appointment) || `appointment:${appointment.id}`;
    let visit = byClient.get(key);
    if (!visit) {
      visit = { key, client: appointment.client || "Walk-in", appointment, appointments: [], transactions: [], openCarts: [] };
      visits.push(visit);
      byClient.set(key, visit);
    }
    visit.appointments.push(appointment);
    byAppointment.set(appointment.id, visit);
  }

  for (const cart of openCarts) {
    if ((cart.saleDate || date) !== date || cart.branch !== branch) continue;
    const linkedIds = (Array.isArray(cart.items) ? cart.items : []).map((item) => item.appointmentId).filter(Boolean);
    let visit = linkedIds.map((id) => byAppointment.get(id)).find(Boolean);
    const key = clientKey(cart);
    if (!visit && key) visit = byClient.get(key);
    if (!visit) {
      visit = {
        key: key || `cart:${cart.id}`,
        client: cart.client || "Walk-in",
        appointment: null,
        appointments: [],
        transactions: [],
        openCarts: [],
      };
      visits.push(visit);
      if (key) byClient.set(key, visit);
    }
    visit.openCarts.push(cart);
  }

  for (const transaction of transactions) {
    if (transaction.date !== date || transaction.branch !== branch) continue;
    const linkedIds = [transaction.appointmentId, ...(Array.isArray(transaction.appointmentIds) ? transaction.appointmentIds : [])];
    let visit = linkedIds.map((id) => byAppointment.get(id)).find(Boolean);
    const key = clientKey(transaction);
    if (!visit && key) visit = byClient.get(key);
    if (!visit) {
      visit = {
        key: key || `transaction:${transaction.id}`,
        client: transaction.client || "Walk-in",
        appointment: null,
        appointments: [],
        transactions: [],
        openCarts: [],
      };
      visits.push(visit);
      if (key) byClient.set(key, visit);
    }
    visit.transactions.push(transaction);
  }

  return visits;
}
